import pkg from '@bot-whatsapp/bot';
import QRPortalWeb from '@bot-whatsapp/portal';
import { getOpenAIResponse } from '../services/ai.js';
import { db } from "../database/firebaseConfig.js";

const { createBot, createFlow, addKeyword } = pkg;

// Función para identificar el tipo de mensaje recibido
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

// Función para obtener el historial de conversación de un usuario
const getConversationHistory = async (userNumber) => {
  try {
    const snapshot = await db.ref(`conversations/${userNumber}`)
      .orderByChild('timestamp')
      .limitToLast(10)
      .once('value');
    const history = [];
    snapshot.forEach(childSnapshot => {
      const data = childSnapshot.val();
      if (data.userMessage) history.push({ role: 'user', content: data.userMessage });
      if (data.botResponse) history.push({ role: 'assistant', content: data.botResponse });
    });
    return history.length ? history : [{ role: 'assistant', content: 'No hay historial disponible.' }];
  } catch (error) {
    console.error('Error al obtener el historial de conversaciones:', error);
    return [{ role: 'assistant', content: 'Error al recuperar el historial.' }];
  }
};

// Función para resumir la conversación en un string
const summarizeConversation = (history) => {
  return history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
};

export const startWhatsAppBot = async () => {
  const { BaileysProvider } = await import('@bot-whatsapp/provider-baileys');
  const adapterProvider = new BaileysProvider();

  // Define firebaseAdapter como objeto literal con los métodos requeridos
  const firebaseAdapter = {
    async getPrevByNumber(number) {
      try {
        const snapshot = await db.ref(`conversations/${number}`)
          .orderByChild('timestamp')
          .limitToLast(1)
          .once('value');
        const data = snapshot.val() || {};
        return Object.values(data)[0]?.message || null;
      } catch (error) {
        console.error('Error al obtener la conversación anterior:', error);
        return null;
      }
    },
    
    async save(from, answer, ctx) {
      try {
        const messageBody = ctx?.body || answer || '';
        
        await db.ref(`conversations/${from}`).push({
          timestamp: new Date().toISOString(),
          message: messageBody,
          response: answer,
        });
      } catch (error) {
        console.error('Error al guardar la conversación:', error);
      }
    }

  };

  // Creamos el bot y capturamos la instancia
  const bot = createBot({
    flow: createFlow([addKeyword('hi').addAnswer('¡Hola! ¿Cómo puedo ayudarte hoy?')]),
    provider: adapterProvider,
    database: firebaseAdapter,
  });

  // Forzamos que la instancia tenga la propiedad databaseClass
  if (!bot.databaseClass) {
    bot.databaseClass = firebaseAdapter;
    console.log("Se asignó manualmente bot.databaseClass");
  }

  console.log("Bot:", bot);
  console.log("Existe bot.databaseClass.getPrevByNumber:", typeof bot.databaseClass.getPrevByNumber === 'function');

  // Configuración de recepción de mensajes entrantes
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

  // Función para manejar los mensajes entrantes
  const handleIncomingMessage = async (message) => {
    try {
      const userNumber = message.from;
      const formattedNumber = `${userNumber}@s.whatsapp.net`;

      if (!userNumber.startsWith("51")) {
        const botResponse = "Hola, si eres de un país que no es Perú, sigue este enlace para un asesor técnico: https://wa.me/+51971449752?text=Hola%20Lizbeth%20solicito%20info";
        await db.ref(`conversations/${userNumber}`).push({
          timestamp: new Date().toISOString(),
          userMessage: message.body || '',
          botResponse,
        });
        await adapterProvider.sendText(formattedNumber, botResponse);
        return;
      }

      const history = await getConversationHistory(userNumber);
      history.push({ role: 'user', content: message.body });
      const prompt = summarizeConversation(history);
      const fullMessage = await getOpenAIResponse(prompt, userNumber, message.name);
      await db.ref(`conversations/${userNumber}`).push({
        timestamp: new Date().toISOString(),
        userMessage: message.body || '',
        userName: message.name || 'Desconocido',
        botResponse: fullMessage,
      });

      await adapterProvider.sendText(formattedNumber, fullMessage);
    } catch (error) {
      console.error('Error durante el manejo del mensaje:', error);
      const errorMessage = 'Lo siento, ha ocurrido un error. Por favor, intenta nuevamente más tarde.';
      await db.ref(`conversations/${message.from}`).push({
        timestamp: new Date().toISOString(),
        userMessage: message.body || '',
        botResponse: errorMessage,
      });
      await adapterProvider.sendText(`${message.from}@s.whatsapp.net`, errorMessage);
    }
  };

  QRPortalWeb();
  adapterProvider.on('message', handleIncomingMessage);
};
