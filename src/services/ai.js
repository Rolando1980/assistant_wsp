import dotenv from 'dotenv';
dotenv.config();  // Cargar las variables de entorno
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { json } from 'express';

// Ruta del archivo de instrucciones
const INSTRUCTION_FILE_PATH = path.resolve('instruction.txt');  

// Clave API de OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (OPENAI_API_KEY) {
    console.log("Conectado a OpenAI");  // Mostrar solo un mensaje de éxito
} else {
    console.error("Error: La clave API de OpenAI no está definida.");
}

// Función para obtener respuesta de OpenAI
export const getOpenAIResponse = async (userMessage, userNumber, userName) => {
    if (!OPENAI_API_KEY) {
        console.error('La clave API de OpenAI no está definida.');
        throw new Error('La clave API de OpenAI no está definida.');
    }

    try {
        // Leer la instrucción desde el archivo
        let instruction = '';
        try {
            instruction = await fs.promises.readFile(INSTRUCTION_FILE_PATH, 'utf-8');
        } catch (error) {
            console.error('Error al leer el archivo de instrucciones:', error.message);
            throw new Error('No se pudo leer el archivo de instrucciones.');
        }

        const response = await axios({
            method: 'post',
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            data: {
                model: "gpt-4o-mini",  // Ajusta el modelo si es necesario
                messages: [
                    { role: "system", content: instruction },
                    { role: "user", content: `Hola, soy ${userName}. ${userMessage}` }  // Incluir el nombre en el mensaje
                ],
                temperature: 0.5,
                frequency_penalty: 0.5, 
                presence_penalty: 0, 
                max_tokens: 150
            }
        });

        // Cambiar el console.log para mostrar la interacción
        console.log(`Interacción: Usuario: "${userMessage}", OpenAI: "${response.data.choices[0].message.content}"`); // Log de la interacción

        // Verificar la existencia de 'choices' y 'message'
        if (response.data.choices && response.data.choices.length > 0 && response.data.choices[0].message) {
            const fullMessage = response.data.choices[0].message.content;

            if (!fullMessage || fullMessage.trim().length === 0) {
                throw new Error('Respuesta vacía recibida de OpenAI.');
            }

            const uniqueId = uuidv4();
            const timestamp = new Date().toISOString();

            const newEntry = {
                id: uniqueId,
                timestamp: timestamp,
                userMessage: userMessage,
                userNumber: userNumber,
                userName: userName,
                botResponse: fullMessage
            };

            // Leer el archivo existente
            let existingData = [];
            try {
                const fileContent = await fs.promises.readFile('response.txt', 'utf-8');
                try {
                existingData = JSON.parse(fileContent);
                } catch (jsonError) {
                    console.error('Error al parsear JSON del archivo response.txt. Reinicializando el historial.');
                    existingData = [];
                }
                if (!Array.isArray(existingData)) {
                    console.error('El contenido del archivo no es un array válido. Inicializando como un array vacío.');
                    existingData = [];
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Si el archivo no existe, inicializamos con un array vacío.
                    existingData = [];
                } else {
                    console.error('Error al leer el archivo:', error.message);
                    throw error;
                }
            }

            // Agregar la nueva entrada al historial
            existingData.push(newEntry);

            // Guardar el historial actualizado en el archivo
            await fs.promises.writeFile('response.txt', JSON.stringify(existingData, null, 2));

            return fullMessage;
        } else {
            console.error('Formato de respuesta de OpenAI inesperado:', response.data);
            throw new Error('Formato de respuesta de OpenAI inesperado.');
        }
    } catch (error) {
        console.error('Error durante la solicitud a OpenAI:', error.response?.data || error.message);
        throw error;
    }
};
