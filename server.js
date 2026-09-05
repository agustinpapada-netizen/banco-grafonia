const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
async function prepararBaseDeDatos() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            nombre TEXT PRIMARY KEY,
            dinero INTEGER NOT NULL DEFAULT 1000
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS transferencias (
            id SERIAL PRIMARY KEY,
            remitente TEXT NOT NULL,
            destinatario TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Base de datos preparada 🗄️");
}
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let usuarios = {};

app.get("/api/usuarios", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT nombre, dinero FROM usuarios"
        );

        const usuarios = {};

        resultado.rows.forEach(function(usuario) {
            usuarios[usuario.nombre] = usuario.dinero;
        });

        res.json(usuarios);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error al cargar usuarios"
        });
    }
}); 
app.post("/api/usuarios", async (req, res) => {
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

    try {
        const existe = await pool.query(
            "SELECT nombre FROM usuarios WHERE nombre = $1",
            [nombre]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({
                error: "Ese usuario ya existe"
            });
        }

        await pool.query(
            "INSERT INTO usuarios (nombre, dinero) VALUES ($1, $2)",
            [nombre, 1000]
        );

        const resultado = await pool.query(
            "SELECT nombre, dinero FROM usuarios"
        );

        const usuarios = {};

        resultado.rows.forEach(function(usuario) {
            usuarios[usuario.nombre] = usuario.dinero;
        });

        res.json({
            mensaje: "Usuario creado",
            usuarios: usuarios
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al crear el usuario"
        });
    }
});
// =========================
// RUTAS DE TRANSFERENCIAS
// =========================

app.get("/api/transferencias", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT remitente, destinatario, cantidad, TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') as fecha FROM transferencias ORDER BY id ASC"
        );
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al cargar el historial" });
    }
});

app.post("/api/transferir", async (req, res) => {
    const { remitente, destinatario, cantidad } = req.body;

    if (!remitente || !destinatario || !cantidad || cantidad <= 0) {
        return res.status(400).json({ error: "Datos de transferencia inválidos" });
    }

    try {
        await pool.query("BEGIN");

        // Verificar saldo del remitente
        const resRemitente = await pool.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1",
            [remitente]
        );

        if (resRemitente.rows.length === 0 || resRemitente.rows[0].dinero < cantidad) {
            await pool.query("ROLLBACK");
            return res.status(400).json({ error: "No tenés suficiente dinero" });
        }

        // Verificar si existe el destinatario
        const resDestinatario = await pool.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1",
            [destinatario]
        );

        if (resDestinatario.rows.length === 0) {
            await pool.query("ROLLBACK");
            return res.status(400).json({ error: "El destinatario no existe" });
        }

        // Descontar al remitente
        await pool.query(
            "UPDATE usuarios SET dinero = dinero - $1 WHERE nombre = $2",
            [cantidad, remitente]
        );

        // Sumar al destinatario
        await pool.query(
            "UPDATE usuarios SET dinero = dinero + $1 WHERE nombre = $2",
            [cantidad, destinatario]
        );

        // Registrar la transferencia
        await pool.query(
            "INSERT INTO transferencias (remitente, destinatario, cantidad) VALUES ($1, $2, $3)",
            [remitente, destinatario, cantidad]
        );

        await pool.query("COMMIT");

        // Devolver usuarios actualizados
        const resultadoUsuarios = await pool.query("SELECT nombre, dinero FROM usuarios");
        const usuarios = {};
        resultadoUsuarios.rows.forEach(u => {
            usuarios[u.nombre] = u.dinero;
        });

        res.json({ mensaje: "Transferencia exitosa", usuarios });

    } catch (error) {
        await pool.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ error: "Error al procesar la transferencia" });
    }
});
prepararBaseDeDatos().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Banco Grafonia iniciado en el puerto ${PORT}`);
    });
});
