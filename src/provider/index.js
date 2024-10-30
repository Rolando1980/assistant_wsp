import pkg from '@bot-whatsapp/bot';
import QRPortalWeb from '@bot-whatsapp/portal';
import { JsonFileAdapter } from '@bot-whatsapp/database-json';
import { getOpenAIResponse } from '../services/ai.js';

const { createBot, createFlow, addKeyword } = pkg;

const conversations = {}; // Almacena el historial de conversaciones

export const startWhatsAppBot = async () => {
    const { BaileysProvider } = await import('@bot-whatsapp/provider-baileys');

    const adapterDB = new JsonFileAdapter();
    const adapterProvider = new BaileysProvider();

    // Sobrescribir el evento 'messages.upsert' para manejarlo correctamente
    adapterProvider.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const [messageCtx] = messages;

        let payload = {
            ...messageCtx,
            body: messageCtx?.message?.extendedTextMessage?.text ?? messageCtx?.message?.conversation,
            name: messageCtx?.pushName,
            from: messageCtx?.key?.remoteJid,
        };

        // Filtrar mensajes que no provienen de un número individual
        if (payload.from === 'status@broadcast') return;

        // Emitir el evento 'message' para continuar con el procesamiento
        adapterProvider.emit('message', payload);
    });

    // Función para resumir el historial de mensajes
    const summarizeConversation = (history) => {
        // Aquí puedes implementar la lógica para resumir el historial
        // Por ejemplo, podrías concatenar solo las partes relevantes
        const summary = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        return summary; // Puedes modificar esto para hacer un resumen más sofisticado
    };

    const handleIncomingMessage = async (message) => {
        const userNumber = message.from;

        // Verificar si hay un historial de conversación existente
        if (!conversations[userNumber]) {
            conversations[userNumber] = [];
        }

        // Agregar el nuevo mensaje al historial
        conversations[userNumber].push({ role: 'user', content: message.body });

        // Limitar el tamaño del historial
        if (conversations[userNumber].length > 10) {
            conversations[userNumber].shift(); // Eliminar el mensaje más antiguo
        }

        try {
            // Crear un resumen a partir del historial
            const prompt = summarizeConversation(conversations[userNumber]);

            // Obtener la respuesta de OpenAI con el resumen
            const fullMessage = await getOpenAIResponse(prompt, userNumber, message.name);
            conversations[userNumber].push({ role: 'assistant', content: fullMessage }); // Agregar respuesta al historial

            const formattedNumber = `${userNumber}@s.whatsapp.net`;
            await adapterProvider.sendText(formattedNumber, fullMessage);
        } catch (error) {
            console.error('Error durante el manejo del mensaje:', error);
            const errorMessage = 'Lo siento, ha ocurrido un error. Por favor, intenta nuevamente más tarde.';
            const formattedNumber = `${userNumber}@s.whatsapp.net`;
            await adapterProvider.sendText(formattedNumber, errorMessage);
        }
    };

    createBot({
        flow: createFlow([addKeyword('hi').addAnswer('¡Hola! ¿Cómo puedo ayudarte hoy?')]),
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
    adapterProvider.on('message', handleIncomingMessage);
};
