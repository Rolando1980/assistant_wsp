// src/utils/generateRefprovider.js

/**
 * Genera una referencia única basada en un prefijo y un timestamp.
 * @param {string} prefix - Prefijo para la referencia.
 * @returns {string} - Referencia generada.
 */
export const generateRefprovider = (prefix) => {
    const timestamp = Date.now();
    return `${prefix}_${timestamp}`;
};

/**
 * Limpia o procesa una imagen según sea necesario.
 * @param {string} imagePath - Ruta del archivo de imagen a procesar.
 */
export const cleanImage = (imagePath) => {
    // Implementa la lógica para limpiar o procesar la imagen
    console.log(`Limpiando imagen en: ${imagePath}`);
};
