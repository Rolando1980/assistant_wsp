import admin from "firebase-admin";

// Cargar las credenciales de Firebase
import serviceAccount from "./firebase-credentials.json" assert { type: "json" };

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ememsa-bot-default-rtdb.firebaseio.com/", 
});

// Referencia a la base de datos
const db = admin.database();

// Prueba de conexión
const testRef = db.ref("test_connection");
testRef
  .set({ message: "Firebase conectado correctamente" })
  .then(() => console.log("✅ Prueba de conexión exitosa"))
  .catch((error) => console.error("❌ Error al conectar con Firebase:", error));
