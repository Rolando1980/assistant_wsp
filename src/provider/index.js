import pkg from '@bot-whatsapp/bot';
import QRPortalWeb from '@bot-whatsapp/portal';
import { getOpenAIResponse } from '../services/ai.js';
import { db } from "../database/firebaseConfig.js"; // 🔹 Importamos la configuración de Firebase

const { createBot, createFlow, addKeyword } = pkg;

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

const getConversationHistory = async (userNumber) => {
    const snapshot = await db.ref(`conversations/${userNumber}`).limitToLast(10).once('value');
    const history = [];
    
    snapshot.forEach(childSnapshot => {
        const data = childSnapshot.val();
        if (data.userMessage) {
            history.push({ role: 'user', content: data.userMessage });
        }
        if (data.botResponse) {
            history.push({ role: 'assistant', content: data.botResponse });
        }
    });

    return history;
};

const summarizeConversation = (history) => {
    return history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
};

export const startWhatsAppBot = async () => {
    const { BaileysProvider } = await import('@bot-whatsapp/provider-baileys');
    const adapterProvider = new BaileysProvider();

    adapterProvider.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const [messageCtx] = messages;
        
        const messageType = getMessageType(messageCtx);
        if (messageType !== 'text') {
            console.log(`Mensaje de tipo "${messageType}" recibido y omitido.`);
            return;
        }

        let payload = {
            ...messageCtx,
            body: messageCtx?.message?.extendedTextMessage?.text ?? messageCtx?.message?.conversation,
            name: messageCtx?.pushName,
            from: messageCtx?.key?.remoteJid,
        };

        if (payload.from === 'status@broadcast') return;
        adapterProvider.emit('message', payload);
    });

    const handleIncomingMessage = async (message) => {
        const userNumber = message.from;
        const formattedNumber = `${userNumber}@s.whatsapp.net`;

        if (!userNumber.startsWith("51")) {
            const botResponse = "Hola, si eres de un país que no es Perú, sigue este enlace para un asesor técnico: https://wa.me/+51971449752?text=Hola%20Lizbeth%20solicito%20info";
            
            await db.ref(`conversations/${userNumber}`).push({
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                userMessage: message.body || '',
                userNumber,
                userName: message.name || 'Desconocido',
                botResponse,
            });

            await adapterProvider.sendText(formattedNumber, botResponse);
            return;
        }

        try {
            const history = await getConversationHistory(userNumber);
            history.push({ role: 'user', content: message.body });

            const prompt = summarizeConversation(history);
            const fullMessage = await getOpenAIResponse(prompt, userNumber, message.name);

            await db.ref(`conversations/${userNumber}`).push({
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                userMessage: message.body || '',
                userNumber,
                userName: message.name || 'Desconocido',
                botResponse: fullMessage,
            });

            await adapterProvider.sendText(formattedNumber, fullMessage);
        } catch (error) {
            console.error('Error durante el manejo del mensaje:', error);
            const errorMessage = 'Lo siento, ha ocurrido un error. Por favor, intenta nuevamente más tarde.';
            
            await db.ref(`conversations/${userNumber}`).push({
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                userMessage: message.body || '',
                userNumber,
                userName: message.name || 'Desconocido',
                botResponse: errorMessage,
            });

            await adapterProvider.sendText(formattedNumber, errorMessage);
        }
    };

    createBot({
        flow: createFlow([addKeyword('hi').addAnswer('¡Hola! ¿Cómo puedo ayudarte hoy?')]),
        provider: adapterProvider,
        database: undefined, // 🔹 Eliminamos el JsonFileAdapter
    });

    QRPortalWeb();
    adapterProvider.on('message', handleIncomingMessage);
};
