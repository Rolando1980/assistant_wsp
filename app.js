import express from 'express';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { startWhatsAppBot } from './src/provider/index.js';

// Inicia el bot de WhatsApp
startWhatsAppBot().catch(error => {
    console.error('Error al iniciar el bot de WhatsApp:', error);
});

// Agrega un servidor Express para evitar el error en Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('El bot de WhatsApp está corriendo.');
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
