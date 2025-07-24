import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Obtener la ruta absoluta del archivo de credenciales
const credentialsPath = path.resolve("src/database/firebase-credentials.json");

// Leer las credenciales de Firebase desde el archivo JSON
const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

// Validación básica de credenciales
if (!serviceAccount || !serviceAccount.project_id) {
    throw new Error("❌ ERROR: Credenciales de Firebase inválidas o archivo corrupto.");
}

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ememsa-bot-default-rtdb.firebaseio.com/",
});

// Exportar la base de datos para usarla en otros archivos
export const db = admin.database();
