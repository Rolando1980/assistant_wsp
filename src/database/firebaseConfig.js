import admin from "firebase-admin";
import serviceAccount from "./firebase-credentials.json" assert { type: "json" };

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
