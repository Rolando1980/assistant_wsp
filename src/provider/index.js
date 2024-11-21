import pkg from '@bot-whatsapp/bot';
import QRPortalWeb from '@bot-whatsapp/portal';
import { JsonFileAdapter } from '@bot-whatsapp/database-json';
import { getOpenAIResponse } from '../services/ai.js';
import fs from 'fs';

const { createBot, createFlow, addKeyword } = pkg;

// Ruta relativa al archivo 'response.txt'
const responseFilePath = '../../response.txt';

const conversations = {}; // Almacena el historial de conversaciones

const getMessageType = (messageCtx) => {
    if (messageCtx.message?.audioMessage) return 'audio';
    if (messageCtx.message?.stickerMessage) return 'sticker';
    if (messageCtx.message?.videoMessage) return 'video';
    if (messageCtx.message?.imageMessage) return 'image';
    if (messageCtx.message?.documentMessage) return 'document';
    if (messageCtx.message?.locationMessage) return 'location';
    if (messageCtx.message?.conversation) return 'text';
    return 'other';
};

export const startWhatsAppBot = async () => {
    const { BaileysProvider } = await import('@bot-whatsapp/provider-baileys');

    const adapterDB = new JsonFileAdapter();
    const adapterProvider = new BaileysProvider();

    // Sobrescribir el evento 'messages.upsert' para manejarlo correctamente
    adapterProvider.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const [messageCtx] = messages;

        // Identificar el tipo de mensaje
        const messageType = getMessageType(messageCtx);

        // Filtrar mensajes no deseados (que no sean texto)
        if (messageType !== 'text') {
        console.log(`Mensaje de tipo "${messageType}" recibido y omitido.`);
        return; // Omitir el procesamiento de este mensaje
        }

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
        const summary = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        return summary; // Puedes modificar esto para hacer un resumen más sofisticado
    };

    const handleIncomingMessage = async (message) => {
        const userNumber = message.from;

        // Verificar si el número no comienza con "51"
        if (!userNumber.startsWith("51")) {
            const formattedNumber = `${userNumber}@s.whatsapp.net`;

            // Guardar en el archivo response.txt
            const responseEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                userMessage: message.body || '',
                userNumber: userNumber,
                userName: message.name || 'Desconocido',
                botResponse:
                    "Hola, si eres de un país que no es Perú, sigue este enlace para un asesor técnico: https://wa.me/+51971449752?text=Hola%20Lizbeth%20solicito%20info",
            };
            fs.appendFileSync(responseFilePath, JSON.stringify(responseEntry) + '\n', 'utf8');

            await adapterProvider.sendText(
                formattedNumber,
                "Hola, si eres de un país que no es Perú, sigue este enlace para un asesor técnico: https://wa.me/+51971449752?text=Hola%20Lizbeth%20solicito%20info"
            );
            return; // Omitir el procesamiento adicional
        }

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
