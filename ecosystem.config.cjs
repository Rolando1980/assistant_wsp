/** 
 * Archivo de configuración PM2 con CommonJS 
 * para iniciar assistant_wsp
 */
module.exports = {
    apps: [
      {
        name: 'assistant_wsp',        // Nombre del proceso
        script: './app.js',           // Ruta al archivo principal de tu app
        instances: 1,                 // Número de procesos (1 para fork mode)
        autorestart: true,            // Reiniciar si falla
        watch: false,                 // No usar watch para evitar reinicios automáticos
        max_memory_restart: '700M',  // Reiniciar si consume más de 700MB
        env: {
          NODE_ENV: 'production'      // Variable de entorno para producción
        }
      }
    ]
  }
  