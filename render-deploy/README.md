# Apex Striker 3D - Despliegue en Render.com

Videojuego Shooter en Tercera Persona (3D WebGL / Three.js) con arquitectura multijugador en tiempo real basada en Node.js, Express y Socket.IO.

## Estructura de Archivos para Render:
- `index.html`: Cliente completo y autocontenido con Three.js vía CDN, Socket.IO client, interfaz Glassmorphic, 3 mapas, armería, audio procedural Web Audio API y controles tácticos.
- `server.js`: Servidor de producción en Node.js con Express y Socket.IO, gestor de salas públicas/privadas, sincronización de posiciones con latencia ultrabaja y bots tácticos con IA.
- `package.json`: Archivo de dependencias (`express` y `socket.io`) listo para ejecución en Cloud.

## Pasos para desplegar en Render.com:
1. Crea un nuevo repositorio en GitHub con el contenido de esta carpeta (`index.html`, `server.js`, `package.json`).
2. Entra en tu panel de control de [Render.com](https://render.com/) y haz clic en **New +** -> **Web Service**.
3. Selecciona tu repositorio de GitHub.
4. En la configuración del servicio:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
5. Haz clic en **Create Web Service**. ¡En 60 segundos tu servidor de juego estará online con URL pública https://tu-app.onrender.com!
