const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// =========================
// SESIONES DE ADMIN
// =========================

const sesionesAdmin = new Map();

// =========================
// BASE DE DATOS
// =========================

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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS auditoria (
            id SERIAL PRIMARY KEY,
            tipo TEXT NOT NULL,
            actor TEXT NOT NULL,
            usuario TEXT,
            cantidad INTEGER,
            detalle TEXT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Base de datos preparada 🗄️");
}

// =========================
// CONFIGURACIÓN
// =========================

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =========================
// AUTENTICACIÓN ADMIN
// =========================

function verificarAdmin(req, res, next) {
    const token = req.headers["x-admin-token"];

    if (!token || !sesionesAdmin.has(token)) {
        return res.status(403).json({
            error: "Acceso de administrador requerido"
        });
    }

    next();
}

// =========================
// LOGIN ADMIN
// =========================

app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;

    const passwordCorrecta = process.env.ADMIN_PASSWORD;

    if (!passwordCorrecta) {
        return res.status(500).json({
            error: "ADMIN_PASSWORD no está configurada en el servidor"
        });
    }

    if (password !== passwordCorrecta) {
        return res.status(401).json({
            error: "Contraseña incorrecta"
        });
    }

    const token = crypto.randomBytes(32).toString("hex");

    sesionesAdmin.set(token, {
        creado: Date.now()
    });

    res.json({
        mensaje: "Administrador autenticado",
        token
    });
});

// =========================
// CERRAR SESIÓN ADMIN
// =========================

app.post("/api/admin/logout", verificarAdmin, (req, res) => {
    const token = req.headers["x-admin-token"];

    sesionesAdmin.delete(token);

    res.json({
        mensaje: "Sesión cerrada"
    });
});

// =========================
// USUARIOS
// =========================

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

// =========================
// CREAR USUARIO
// =========================

app.post("/api/usuarios", async (req, res) => {
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
        return res.status(400).json({
            error: "Falta el nombre"
        });
    }

    const nombreLimpio = nombre.trim();

    if (nombreLimpio === "AdminGrafonia") {
        return res.status(400).json({
            error: "Ese nombre está reservado"
        });
    }

    try {
        const existe = await pool.query(
            "SELECT nombre FROM usuarios WHERE nombre = $1",
            [nombreLimpio]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({
                error: "Ese usuario ya existe"
            });
        }

        await pool.query(
            "INSERT INTO usuarios (nombre, dinero) VALUES ($1, $2)",
            [nombreLimpio, 1000]
        );

        await pool.query(
            `
            INSERT INTO auditoria
            (tipo, actor, usuario, cantidad, detalle)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                "CREACION_USUARIO",
                nombreLimpio,
                nombreLimpio,
                1000,
                "Usuario creado con saldo inicial"
            ]
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
            usuarios
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al crear el usuario"
        });
    }
});

// =========================
// TRANSFERENCIAS
// =========================

// Historial personal
app.get("/api/transferencias/mias", async (req, res) => {
    const { usuario } = req.query;

    if (!usuario) {
        return res.status(400).json({
            error: "Falta el usuario"
        });
    }

    try {
        const resultado = await pool.query(
            `
            SELECT
                remitente,
                destinatario,
                cantidad,
                TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') AS fecha
            FROM transferencias
            WHERE remitente = $1 OR destinatario = $1
            ORDER BY id DESC
            `,
            [usuario]
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al cargar el historial"
        });
    }
});

// Historial GLOBAL — SOLO ADMIN
app.get("/api/transferencias", verificarAdmin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT
                id,
                remitente,
                destinatario,
                cantidad,
                TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI') AS fecha
            FROM transferencias
            ORDER BY id DESC
            `
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al cargar el historial"
        });
    }
});

// =========================
// HACER TRANSFERENCIA
// =========================

app.post("/api/transferir", async (req, res) => {
    const { remitente, destinatario, cantidad } = req.body;

    if (!remitente || !destinatario || !cantidad || cantidad <= 0) {
        return res.status(400).json({
            error: "Datos de transferencia inválidos"
        });
    }

    if (remitente === destinatario) {
        return res.status(400).json({
            error: "No podés transferirte dinero a vos mismo"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const resRemitente = await client.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1 FOR UPDATE",
            [remitente]
        );

        if (
            resRemitente.rows.length === 0 ||
            resRemitente.rows[0].dinero < cantidad
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "No tenés suficiente dinero"
            });
        }

        const resDestinatario = await client.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1 FOR UPDATE",
            [destinatario]
        );

        if (resDestinatario.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "El destinatario no existe"
            });
        }

        await client.query(
            "UPDATE usuarios SET dinero = dinero - $1 WHERE nombre = $2",
            [cantidad, remitente]
        );

        await client.query(
            "UPDATE usuarios SET dinero = dinero + $1 WHERE nombre = $2",
            [cantidad, destinatario]
        );

        await client.query(
            `
            INSERT INTO transferencias
            (remitente, destinatario, cantidad)
            VALUES ($1, $2, $3)
            `,
            [remitente, destinatario, cantidad]
        );

        await client.query("COMMIT");

        const resultadoUsuarios = await pool.query(
            "SELECT nombre, dinero FROM usuarios"
        );

        const usuarios = {};

        resultadoUsuarios.rows.forEach(function(usuario) {
            usuarios[usuario.nombre] = usuario.dinero;
        });

        res.json({
            mensaje: "Transferencia exitosa",
            usuarios
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: "Error al procesar la transferencia"
        });

    } finally {
        client.release();
    }
});

// =========================
// ADMIN — AGREGAR DINERO
// =========================

app.post("/api/admin/agregar-dinero", verificarAdmin, async (req, res) => {
    const { nombre, cantidad } = req.body;

    if (!nombre || !cantidad || cantidad <= 0) {
        return res.status(400).json({
            error: "Datos inválidos"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const resultado = await client.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1 FOR UPDATE",
            [nombre]
        );

        if (resultado.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Ese usuario no existe"
            });
        }

        const saldoAnterior = resultado.rows[0].dinero;
        const saldoNuevo = saldoAnterior + cantidad;

        await client.query(
            "UPDATE usuarios SET dinero = $1 WHERE nombre = $2",
            [saldoNuevo, nombre]
        );

        await client.query(
            `
            INSERT INTO auditoria
            (tipo, actor, usuario, cantidad, detalle)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                "DINERO_AGREGADO",
                "AdminGrafonia",
                nombre,
                cantidad,
                `Saldo anterior: ₲${saldoAnterior} | Saldo nuevo: ₲${saldoNuevo}`
            ]
        );

        await client.query("COMMIT");

        res.json({
            mensaje: "Dinero agregado",
            saldo: saldoNuevo
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: "Error al agregar dinero"
        });

    } finally {
        client.release();
    }
});

// =========================
// ADMIN — QUITAR DINERO
// =========================

app.post("/api/admin/quitar-dinero", verificarAdmin, async (req, res) => {
    const { nombre, cantidad } = req.body;

    if (!nombre || !cantidad || cantidad <= 0) {
        return res.status(400).json({
            error: "Datos inválidos"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const resultado = await client.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1 FOR UPDATE",
            [nombre]
        );

        if (resultado.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Ese usuario no existe"
            });
        }

        const saldoAnterior = resultado.rows[0].dinero;

        if (saldoAnterior < cantidad) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Ese usuario no tiene suficiente dinero"
            });
        }

        const saldoNuevo = saldoAnterior - cantidad;

        await client.query(
            "UPDATE usuarios SET dinero = $1 WHERE nombre = $2",
            [saldoNuevo, nombre]
        );

        await client.query(
            `
            INSERT INTO auditoria
            (tipo, actor, usuario, cantidad, detalle)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                "DINERO_QUITADO",
                "AdminGrafonia",
                nombre,
                cantidad,
                `Saldo anterior: ₲${saldoAnterior} | Saldo nuevo: ₲${saldoNuevo}`
            ]
        );

        await client.query("COMMIT");

        res.json({
            mensaje: "Dinero quitado",
            saldo: saldoNuevo
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: "Error al quitar dinero"
        });

    } finally {
        client.release();
    }
});

// =========================
// ADMIN — ELIMINAR USUARIO
// =========================

app.delete("/api/admin/usuarios/:nombre", verificarAdmin, async (req, res) => {
    const nombre = req.params.nombre;

    try {
        const resultado = await pool.query(
            "SELECT dinero FROM usuarios WHERE nombre = $1",
            [nombre]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Ese usuario no existe"
            });
        }

        const saldo = resultado.rows[0].dinero;

        await pool.query(
            "DELETE FROM usuarios WHERE nombre = $1",
            [nombre]
        );

        await pool.query(
            `
            INSERT INTO auditoria
            (tipo, actor, usuario, cantidad, detalle)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                "USUARIO_ELIMINADO",
                "AdminGrafonia",
                nombre,
                saldo,
                `Usuario eliminado. Saldo que tenía: ₲${saldo}`
            ]
        );

        res.json({
            mensaje: "Usuario eliminado"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al eliminar usuario"
        });
    }
});

// =========================
// ADMIN — ELIMINAR CUENTAS SIN NOMBRE
// =========================

app.delete("/api/admin/usuarios-sin-nombre", verificarAdmin, async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT nombre, dinero FROM usuarios WHERE nombre = ''"
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "No hay cuentas sin nombre"
            });
        }

        const cantidadEliminadas = resultado.rows.length;
        const dineroEliminado = resultado.rows.reduce(
            (total, usuario) => total + usuario.dinero,
            0
        );

        await pool.query(
            "DELETE FROM usuarios WHERE nombre = ''"
        );

        await pool.query(
            `
            INSERT INTO auditoria
            (tipo, actor, usuario, cantidad, detalle)
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                "USUARIO_SIN_NOMBRE_ELIMINADO",
                "AdminGrafonia",
                "(sin nombre)",
                dineroEliminado,
                `${cantidadEliminadas} cuenta(s) sin nombre eliminada(s)`
            ]
        );

        res.json({
            mensaje: `${cantidadEliminadas} cuenta(s) sin nombre eliminada(s)`,
            dineroEliminado
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al eliminar cuentas sin nombre"
        });
    }
});

// =========================
// ADMIN — AUDITORÍA
// =========================

app.get("/api/admin/auditoria", verificarAdmin, async (req, res) => {
    try {
        const resultado = await pool.query(
            `
            SELECT
                id,
                tipo,
                actor,
                usuario,
                cantidad,
                detalle,
                TO_CHAR(fecha, 'DD/MM/YYYY HH24:MI:SS') AS fecha
            FROM auditoria
            ORDER BY id DESC
            `
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al cargar la auditoría"
        });
    }
});

// =========================
// ADMIN — ESTADÍSTICAS
// =========================

app.get("/api/admin/estadisticas", verificarAdmin, async (req, res) => {
    try {
        const usuarios = await pool.query(
            "SELECT COUNT(*)::INTEGER AS cantidad FROM usuarios"
        );

        const dinero = await pool.query(
            "SELECT COALESCE(SUM(dinero), 0)::INTEGER AS total FROM usuarios"
        );

        const transferencias = await pool.query(
            "SELECT COUNT(*)::INTEGER AS cantidad FROM transferencias"
        );

        const dineroTransferido = await pool.query(
            "SELECT COALESCE(SUM(cantidad), 0)::INTEGER AS total FROM transferencias"
        );

        res.json({
            usuarios: usuarios.rows[0].cantidad,
            dineroEnCirculacion: dinero.rows[0].total,
            transferencias: transferencias.rows[0].cantidad,
            dineroTransferido: dineroTransferido.rows[0].total
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al cargar estadísticas"
        });
    }
});

// =========================
// INICIAR SERVIDOR
// =========================

prepararBaseDeDatos()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                `Banco Grafonia iniciado en el puerto ${PORT}`
            );
        });
    })
    .catch(error => {
        console.error(
            "No se pudo preparar la base de datos:",
            error
        );
    });
