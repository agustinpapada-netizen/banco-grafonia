const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let usuarios = {};
let transferencias = [];
app.get("/api/usuarios", (req, res) => {
    res.json(usuarios);
});
app.post("/api/usuarios", (req, res) => {
    const { nombre } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: "Falta el nombre" });
    }

    if (nombre === "AdminGrafonia") {
        return res.status(400).json({ error: "Ese nombre está reservado" });
    }

    if (nombre in usuarios) {
        return res.status(400).json({ error: "Ese usuario ya existe" });
    }

    usuarios[nombre] = 1000;

    res.json({
        mensaje: "Usuario creado",
        usuarios: usuarios
    });
});
app.post("/api/usuarios", (req, res) => {
    const { nombre } = req.body;

    if (!nombre) {
        return res.status(400).json({
            error: "Falta el nombre"
        });
    }

    if (nombre === "AdminGrafonia") {
        return res.status(400).json({
            error: "Ese nombre está reservado"
        });
    }

    if (nombre in usuarios) {
        return res.status(400).json({
            error: "Ese usuario ya existe"
        });
    }

    usuarios[nombre] = 1000;

    res.json({
        mensaje: "Usuario creado",
        usuarios: usuarios
    });
});
app.post("/api/transferir", (req, res) => {
    const { remitente, destinatario, cantidad } = req.body;

    if (!remitente || !destinatario || !cantidad) {
        return res.status(400).json({
            error: "Faltan datos"
        });
    }

    if (!(remitente in usuarios)) {
        return res.status(404).json({
            error: "El remitente no existe"
        });
    }

    if (!(destinatario in usuarios)) {
        return res.status(404).json({
            error: "El destinatario no existe"
        });
    }

    if (remitente === destinatario) {
        return res.status(400).json({
            error: "No podés transferirte dinero a vos mismo"
        });
    }

    if (cantidad <= 0) {
        return res.status(400).json({
            error: "La cantidad debe ser mayor que 0"
        });
    }

    if (usuarios[remitente] < cantidad) {
        return res.status(400).json({
            error: "No tenés suficiente dinero"
        });
    }

    usuarios[remitente] -= cantidad;
    usuarios[destinatario] += cantidad;

    transferencias.push({
    remitente: remitente,
    destinatario: destinatario,
    cantidad: cantidad,
    fecha: new Date().toLocaleString("es-AR")
});
    
    res.json({
        mensaje: "Transferencia realizada",
        usuarios: usuarios
    });
});

app.get("/api/transferencias", (req, res) => {
    res.json(transferencias);
});
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Banco Grafonia iniciado en el puerto ${PORT}`);
});
