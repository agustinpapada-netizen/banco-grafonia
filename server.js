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