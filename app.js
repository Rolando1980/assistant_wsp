import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { startWhatsAppBot } from './src/provider/index.js'; // Importa la función startWhatsAppBot

// Inicia el bot de WhatsApp
startWhatsAppBot().catch(error => {
    console.error('Error al iniciar el bot de WhatsApp:', error);
});
