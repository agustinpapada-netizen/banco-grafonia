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
// CONFIGURACIÓN TINCOIN
// =========================

const TINCOIN_INTERVALO =
    3 * 60 * 60 * 1000;

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
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS ahorro INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS trabajo TEXT NOT NULL DEFAULT 'Sin empleo'
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS sueldo INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS ultimo_pago TIMESTAMP
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
        ALTER TABLE transferencias
        ADD COLUMN IF NOT EXISTS concepto TEXT DEFAULT ''
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

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
            id SERIAL PRIMARY KEY,
            usuario TEXT NOT NULL,
            titulo TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            leida BOOLEAN NOT NULL DEFAULT FALSE,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS solicitudes (
            id SERIAL PRIMARY KEY,
            solicitante TEXT NOT NULL,
            destinatario TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            motivo TEXT DEFAULT '',
            estado TEXT NOT NULL DEFAULT 'PENDIENTE',
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // =========================
    // TINCOIN
    // =========================

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tincoin_config (
            id INTEGER PRIMARY KEY,
            precio NUMERIC(20,4) NOT NULL DEFAULT 1,
            ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            proxima_actualizacion TIMESTAMP
        )
    `);

    await pool.query(`
        ALTER TABLE tincoin_config
        ADD COLUMN IF NOT EXISTS proxima_actualizacion TIMESTAMP
    `);

    await pool.query(`
        INSERT INTO tincoin_config
        (
            id,
            precio,
            ultima_actualizacion,
            proxima_actualizacion
        )
        VALUES
        (
            1,
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '3 hours'
        )
        ON CONFLICT (id) DO NOTHING
    `);

    await pool.query(`
        UPDATE tincoin_config
        SET proxima_actualizacion =
            CASE
                WHEN proxima_actualizacion IS NULL
                THEN CURRENT_TIMESTAMP + INTERVAL '3 hours'
                ELSE proxima_actualizacion
            END
        WHERE id = 1
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tincoin_historial (
            id SERIAL PRIMARY KEY,
            precio NUMERIC(20,4) NOT NULL,
            porcentaje NUMERIC(10,4) NOT NULL,
            tipo TEXT NOT NULL,
            actor TEXT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tincoin_saldos (
            usuario TEXT PRIMARY KEY,
            cantidad NUMERIC(20,8) NOT NULL DEFAULT 0,
            capital_invertido NUMERIC(20,4) NOT NULL DEFAULT 0
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tincoin_operaciones (
            id SERIAL PRIMARY KEY,
            usuario TEXT NOT NULL,
            tipo TEXT NOT NULL,
            dinero NUMERIC(20,4) NOT NULL,
            tincoins NUMERIC(20,8) NOT NULL,
            precio NUMERIC(20,4) NOT NULL,
            resultado NUMERIC(20,4),
            ganancia NUMERIC(20,4),
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Si la tabla ya existía de una versión anterior
    await pool.query(`
        ALTER TABLE tincoin_operaciones
        ADD COLUMN IF NOT EXISTS ganancia NUMERIC(20,4)
    `);

    // Crear primer punto del gráfico
    const historialTinCoin =
        await pool.query(`
            SELECT id
            FROM tincoin_historial
            LIMIT 1
        `);

    if (historialTinCoin.rows.length === 0) {

        const precioInicial =
            await pool.query(`
                SELECT precio
                FROM tincoin_config
                WHERE id = 1
            `);

        await pool.query(`
            INSERT INTO tincoin_historial
            (
                precio,
                porcentaje,
                tipo,
                actor
            )
            VALUES
            ($1, 0, 'INICIAL', 'SISTEMA')
        `, [
            Number(precioInicial.rows[0].precio)
        ]);
    }

    console.log("Base de datos preparada 🗄️");
}

// =========================
// CONFIGURACIÓN EXPRESS
// =========================

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =========================
// FUNCIONES AUXILIARES
// =========================

async function obtenerUsuarios() {

    const resultado =
        await pool.query(
            "SELECT nombre, dinero FROM usuarios"
        );

    const usuarios = {};

    resultado.rows.forEach(function(usuario) {

        usuarios[usuario.nombre] =
            usuario.dinero;

    });

    return usuarios;
}


async function notificar(
    usuario,
    titulo,
    mensaje
) {

    if (!usuario) {
        return;
    }

    await pool.query(
        `
        INSERT INTO notificaciones
        (usuario, titulo, mensaje)
        VALUES ($1, $2, $3)
        `,
        [
            usuario,
            titulo,
            mensaje
        ]
    );
}


// =========================
// SUELDOS
// =========================

async function pagarSueldoSiCorresponde(nombre) {

    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");

        const resultado =
            await client.query(
                `
                SELECT
                    dinero,
                    trabajo,
                    sueldo,
                    ultimo_pago
                FROM usuarios
                WHERE nombre = $1
                FOR UPDATE
                `,
                [nombre]
            );

        if (
            resultado.rows.length === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return;
        }

        const usuario =
            resultado.rows[0];

        if (
            !usuario.sueldo ||
            usuario.sueldo <= 0 ||
            !usuario.trabajo ||
            usuario.trabajo === "Sin empleo"
        ) {

            await client.query(
                "COMMIT"
            );

            return;
        }

        const ahora =
            new Date();

        let corresponde =
            false;

        if (
            !usuario.ultimo_pago
        ) {

            corresponde = true;

        } else {

            const ultimoPago =
                new Date(
                    usuario.ultimo_pago
                );

            const diferencia =
                ahora.getTime() -
                ultimoPago.getTime();

            const veinticuatroHoras =
                24 * 60 * 60 * 1000;

            if (
                diferencia >=
                veinticuatroHoras
            ) {

                corresponde = true;
            }
        }

        if (!corresponde) {

            await client.query(
                "COMMIT"
            );

            return;
        }

        const nuevoSaldo =
            usuario.dinero +
            usuario.sueldo;

        await client.query(
            `
            UPDATE usuarios
            SET
                dinero = $1,
                ultimo_pago = CURRENT_TIMESTAMP
            WHERE nombre = $2
            `,
            [
                nuevoSaldo,
                nombre
            ]
        );

        await client.query(
            `
            INSERT INTO auditoria
            (
                tipo,
                actor,
                usuario,
                cantidad,
                detalle
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                "SUELDO_PAGADO",
                "SISTEMA",
                nombre,
                usuario.sueldo,
                `Sueldo de ${usuario.trabajo}`
            ]
        );

        await client.query(
            `
            INSERT INTO notificaciones
            (
                usuario,
                titulo,
                mensaje
            )
            VALUES ($1, $2, $3)
            `,
            [
                nombre,
                "💼 Sueldo recibido",
                `Recibiste ₲${usuario.sueldo} por tu trabajo como ${usuario.trabajo}.`
            ]
        );

        await client.query(
            "COMMIT"
        );

    } catch (error) {

        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Error pagando sueldo:",
            error
        );

    } finally {

        client.release();
    }
}


// =========================
// ADMIN
// =========================

function verificarAdmin(
    req,
    res,
    next
) {

    const token =
        req.headers["x-admin-token"];

    if (
        !token ||
        !sesionesAdmin.has(token)
    ) {

        return res.status(403).json({
            error:
                "Acceso de administrador requerido"
        });
    }

    next();
}


// =========================
// LOGIN ADMIN
// =========================

app.post(
    "/api/admin/login",
    (req, res) => {

        const {
            password
        } = req.body;

        const passwordCorrecta =
            process.env.ADMIN_PASSWORD;

        if (!passwordCorrecta) {

            return res.status(500).json({
                error:
                    "ADMIN_PASSWORD no está configurada en el servidor"
            });
        }

        if (
            password !==
            passwordCorrecta
        ) {

            return res.status(401).json({
                error:
                    "Contraseña incorrecta"
            });
        }

        const token =
            crypto.randomBytes(32)
                .toString("hex");

        sesionesAdmin.set(
            token,
            {
                creado:
                    Date.now()
            }
        );

        res.json({
            mensaje:
                "Administrador autenticado",
            token
        });
    }
);


// =========================
// LOGOUT ADMIN
// =========================

app.post(
    "/api/admin/logout",
    verificarAdmin,
    (req, res) => {

        const token =
            req.headers["x-admin-token"];

        sesionesAdmin.delete(
            token
        );

        res.json({
            mensaje:
                "Sesión cerrada"
        });
    }
);


// =========================
// USUARIOS
// =========================

app.get(
    "/api/usuarios",
    async (req, res) => {

        try {

            const usuarios =
                await obtenerUsuarios();

            res.json(
                usuarios
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar usuarios"
            });
        }
    }
);


app.post(
    "/api/usuarios",
    async (req, res) => {

        const {
            nombre
        } = req.body;

        if (
            !nombre ||
            !nombre.trim()
        ) {

            return res.status(400).json({
                error:
                    "Falta el nombre"
            });
        }

        const nombreLimpio =
            nombre.trim();

        if (
            nombreLimpio ===
            "AdminGrafonia"
        ) {

            return res.status(400).json({
                error:
                    "Ese nombre está reservado"
            });
        }

        try {

            const existe =
                await pool.query(
                    `
                    SELECT nombre
                    FROM usuarios
                    WHERE nombre = $1
                    `,
                    [nombreLimpio]
                );

            if (
                existe.rows.length === 0
            ) {

                await pool.query(
                    `
                    INSERT INTO usuarios
                    (nombre, dinero)
                    VALUES ($1, $2)
                    `,
                    [
                        nombreLimpio,
                        1000
                    ]
                );

                await pool.query(
                    `
                    INSERT INTO auditoria
                    (
                        tipo,
                        actor,
                        usuario,
                        cantidad,
                        detalle
                    )
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

                await notificar(
                    nombreLimpio,
                    "👋 Bienvenido a Grafonia",
                    "Tu cuenta fue creada con ₲1000."
                );
            }

            await pagarSueldoSiCorresponde(
                nombreLimpio
            );

            const usuarios =
                await obtenerUsuarios();

            res.json({
                mensaje:
                    "Usuario listo",
                usuarios
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al entrar al banco"
            });
        }
    }
);


// =========================
// PERFIL
// =========================

app.get(
    "/api/perfil",
    async (req, res) => {

        const usuario =
            req.query.usuario;

        if (!usuario) {

            return res.status(400).json({
                error:
                    "Falta el usuario"
            });
        }

        try {

            await pagarSueldoSiCorresponde(
                usuario
            );

            const cuenta =
                await pool.query(
                    `
                    SELECT
                        nombre,
                        dinero,
                        ahorro,
                        trabajo,
                        sueldo,
                        ultimo_pago
                    FROM usuarios
                    WHERE nombre = $1
                    `,
                    [usuario]
                );

            if (
                cuenta.rows.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "Usuario no encontrado"
                });
            }

            const resumen =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) FILTER (
                            WHERE remitente = $1
                        )::INTEGER AS enviados,

                        COUNT(*) FILTER (
                            WHERE destinatario = $1
                        )::INTEGER AS recibidos,

                        COALESCE(
                            SUM(cantidad) FILTER (
                                WHERE remitente = $1
                            ),
                            0
                        )::INTEGER AS dineroEnviado,

                        COALESCE(
                            SUM(cantidad) FILTER (
                                WHERE destinatario = $1
                            ),
                            0
                        )::INTEGER AS dineroRecibido

                    FROM transferencias

                    WHERE
                        (
                            remitente = $1
                            OR destinatario = $1
                        )

                        AND fecha >=
                            date_trunc(
                                'month',
                                CURRENT_DATE
                            )
                    `,
                    [usuario]
                );

            res.json({
                cuenta:
                    cuenta.rows[0],

                resumen:
                    resumen.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar el perfil"
            });
        }
    }
);


// =========================
// ECONOMÍA
// =========================

app.get(
    "/api/economia",
    async (req, res) => {

        try {

            const usuarios =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS cantidad
                    FROM usuarios
                    `
                );

            const dinero =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(dinero),
                            0
                        )::INTEGER AS disponible,

                        COALESCE(
                            SUM(ahorro),
                            0
                        )::INTEGER AS ahorro

                    FROM usuarios
                    `
                );

            const transferencias =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS cantidad
                    FROM transferencias
                    `
                );

            res.json({
                usuarios:
                    usuarios.rows[0].cantidad,

                dineroDisponible:
                    dinero.rows[0].disponible,

                dineroAhorro:
                    dinero.rows[0].ahorro,

                dineroTotal:
                    dinero.rows[0].disponible +
                    dinero.rows[0].ahorro,

                transferencias:
                    transferencias.rows[0].cantidad
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar la economía"
            });
        }
    }
);


// =========================
// HISTORIAL PERSONAL
// =========================

app.get(
    "/api/transferencias/mias",
    async (req, res) => {

        const {
            usuario
        } = req.query;

        if (!usuario) {

            return res.status(400).json({
                error:
                    "Falta el usuario"
            });
        }

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        remitente,
                        destinatario,
                        cantidad,
                        concepto,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI'
                        ) AS fecha

                    FROM transferencias

                    WHERE
                        remitente = $1
                        OR destinatario = $1

                    ORDER BY id DESC
                    `,
                    [usuario]
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar el historial"
            });
        }
    }
);


// =========================
// HISTORIAL GLOBAL ADMIN
// =========================

app.get(
    "/api/transferencias",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        remitente,
                        destinatario,
                        cantidad,
                        concepto,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI'
                        ) AS fecha

                    FROM transferencias

                    ORDER BY id DESC
                    `
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar el historial"
            });
        }
    }
);


// =========================
// TRANSFERIR
// =========================

app.post(
    "/api/transferir",
    async (req, res) => {

        const {
            remitente,
            destinatario,
            cantidad,
            concepto
        } = req.body;

        if (
            !remitente ||
            !destinatario ||
            !cantidad ||
            cantidad <= 0
        ) {

            return res.status(400).json({
                error:
                    "Datos de transferencia inválidos"
            });
        }

        if (
            remitente ===
            destinatario
        ) {

            return res.status(400).json({
                error:
                    "No podés transferirte dinero a vos mismo"
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const resRemitente =
                await client.query(
                    `
                    SELECT dinero
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [remitente]
                );

            if (
                resRemitente.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "El remitente no existe"
                });
            }

            if (
                resRemitente.rows[0].dinero <
                cantidad
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés suficiente dinero"
                });
            }

            const resDestinatario =
                await client.query(
                    `
                    SELECT dinero
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [destinatario]
                );

            if (
                resDestinatario.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "El destinatario no existe"
                });
            }

            const conceptoLimpio =
                String(
                    concepto || ""
                )
                .trim()
                .slice(0, 100);

            await client.query(
                `
                UPDATE usuarios
                SET dinero = dinero - $1
                WHERE nombre = $2
                `,
                [
                    cantidad,
                    remitente
                ]
            );

            await client.query(
                `
                UPDATE usuarios
                SET dinero = dinero + $1
                WHERE nombre = $2
                `,
                [
                    cantidad,
                    destinatario
                ]
            );

            await client.query(
                `
                INSERT INTO transferencias
                (
                    remitente,
                    destinatario,
                    cantidad,
                    concepto
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    remitente,
                    destinatario,
                    cantidad,
                    conceptoLimpio
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    destinatario,
                    "📥 Dinero recibido",
                    `${remitente} te envió ₲${cantidad}${conceptoLimpio ? " — " + conceptoLimpio : ""}.`
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    remitente,
                    "💸 Transferencia realizada",
                    `Enviaste ₲${cantidad} a ${destinatario}${conceptoLimpio ? " — " + conceptoLimpio : ""}.`
                ]
            );

            await client.query(
                "COMMIT"
            );

            const usuarios =
                await obtenerUsuarios();

            res.json({
                mensaje:
                    "Transferencia exitosa",
                usuarios
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al procesar la transferencia"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// NOTIFICACIONES
// =========================

app.get(
    "/api/notificaciones",
    async (req, res) => {

        const usuario =
            req.query.usuario;

        if (!usuario) {

            return res.status(400).json({
                error:
                    "Falta el usuario"
            });
        }

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        titulo,
                        mensaje,
                        leida,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI'
                        ) AS fecha

                    FROM notificaciones

                    WHERE usuario = $1

                    ORDER BY id DESC

                    LIMIT 50
                    `,
                    [usuario]
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar notificaciones"
            });
        }
    }
);


app.post(
    "/api/notificaciones/leidas",
    async (req, res) => {

        const {
            usuario
        } = req.body;

        if (!usuario) {

            return res.status(400).json({
                error:
                    "Falta el usuario"
            });
        }

        try {

            await pool.query(
                `
                UPDATE notificaciones
                SET leida = TRUE
                WHERE usuario = $1
                `,
                [usuario]
            );

            res.json({
                mensaje:
                    "Notificaciones marcadas como leídas"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al marcar notificaciones"
            });
        }
    }
);


// =========================
// AHORRO DEPOSITAR
// =========================

app.post(
    "/api/ahorros/depositar",
    async (req, res) => {

        const {
            usuario,
            cantidad
        } = req.body;

        if (
            !usuario ||
            !cantidad ||
            cantidad <= 0
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const resultado =
                await client.query(
                    `
                    SELECT
                        dinero,
                        ahorro
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [usuario]
                );

            if (
                resultado.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "Usuario no encontrado"
                });
            }

            if (
                resultado.rows[0].dinero <
                cantidad
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés suficiente dinero disponible"
                });
            }

            await client.query(
                `
                UPDATE usuarios
                SET
                    dinero = dinero - $1,
                    ahorro = ahorro + $1
                WHERE nombre = $2
                `,
                [
                    cantidad,
                    usuario
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    usuario,
                    "🏦 Dinero guardado",
                    `Guardaste ₲${cantidad} en tu cuenta de ahorro.`
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    "AHORRO_DEPOSITADO",
                    usuario,
                    usuario,
                    cantidad,
                    "Dinero pasado a ahorro"
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Dinero guardado",

                saldo:
                    resultado.rows[0].dinero -
                    cantidad,

                ahorro:
                    resultado.rows[0].ahorro +
                    cantidad
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al guardar el dinero"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// AHORRO RETIRAR
// =========================

app.post(
    "/api/ahorros/retirar",
    async (req, res) => {

        const {
            usuario,
            cantidad
        } = req.body;

        if (
            !usuario ||
            !cantidad ||
            cantidad <= 0
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const resultado =
                await client.query(
                    `
                    SELECT
                        dinero,
                        ahorro
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [usuario]
                );

            if (
                resultado.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "Usuario no encontrado"
                });
            }

            if (
                resultado.rows[0].ahorro <
                cantidad
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés suficiente dinero en ahorro"
                });
            }

            await client.query(
                `
                UPDATE usuarios
                SET
                    dinero = dinero + $1,
                    ahorro = ahorro - $1
                WHERE nombre = $2
                `,
                [
                    cantidad,
                    usuario
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    usuario,
                    "💰 Dinero retirado del ahorro",
                    `Retiraste ₲${cantidad} de tu cuenta de ahorro.`
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    "AHORRO_RETIRADO",
                    usuario,
                    usuario,
                    cantidad,
                    "Dinero retirado del ahorro"
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Dinero retirado",

                saldo:
                    resultado.rows[0].dinero +
                    cantidad,

                ahorro:
                    resultado.rows[0].ahorro -
                    cantidad
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al retirar el dinero"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// SOLICITAR DINERO
// =========================

app.post(
    "/api/solicitudes",
    async (req, res) => {

        const {
            solicitante,
            destinatario,
            cantidad,
            motivo
        } = req.body;

        if (
            !solicitante ||
            !destinatario ||
            !cantidad ||
            cantidad <= 0
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        if (
            solicitante ===
            destinatario
        ) {

            return res.status(400).json({
                error:
                    "No podés solicitarte dinero a vos mismo"
            });
        }

        try {

            const destinatarioExiste =
                await pool.query(
                    `
                    SELECT nombre
                    FROM usuarios
                    WHERE nombre = $1
                    `,
                    [destinatario]
                );

            if (
                destinatarioExiste.rows.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "El usuario destinatario no existe"
                });
            }

            const motivoLimpio =
                String(
                    motivo || ""
                )
                .trim()
                .slice(0, 150);

            await pool.query(
                `
                INSERT INTO solicitudes
                (
                    solicitante,
                    destinatario,
                    cantidad,
                    motivo
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    solicitante,
                    destinatario,
                    cantidad,
                    motivoLimpio
                ]
            );

            await notificar(
                destinatario,
                "🧑‍💼 Solicitud de dinero",
                `${solicitante} te solicita ₲${cantidad}${motivoLimpio ? " — " + motivoLimpio : ""}.`
            );

            res.json({
                mensaje:
                    "Solicitud enviada"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al enviar la solicitud"
            });
        }
    }
);


// =========================
// VER SOLICITUDES
// =========================

app.get(
    "/api/solicitudes",
    async (req, res) => {

        const usuario =
            req.query.usuario;

        if (!usuario) {

            return res.status(400).json({
                error:
                    "Falta el usuario"
            });
        }

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        solicitante,
                        destinatario,
                        cantidad,
                        motivo,
                        estado,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI'
                        ) AS fecha

                    FROM solicitudes

                    WHERE
                        solicitante = $1
                        OR destinatario = $1

                    ORDER BY id DESC

                    LIMIT 50
                    `,
                    [usuario]
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar solicitudes"
            });
        }
    }
);


// =========================
// ACEPTAR SOLICITUD
// =========================

app.post(
    "/api/solicitudes/:id/aceptar",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        const usuario =
            req.body.usuario;

        if (
            !id ||
            !usuario
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const solicitud =
                await client.query(
                    `
                    SELECT *
                    FROM solicitudes
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [id]
                );

            if (
                solicitud.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "Solicitud no encontrada"
                });
            }

            const s =
                solicitud.rows[0];

            if (
                s.destinatario !==
                usuario
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(403).json({
                    error:
                        "No podés aceptar esta solicitud"
                });
            }

            if (
                s.estado !==
                "PENDIENTE"
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "Esta solicitud ya fue procesada"
                });
            }

            const remitente =
                await client.query(
                    `
                    SELECT dinero
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [usuario]
                );

            if (
                remitente.rows.length === 0 ||
                remitente.rows[0].dinero <
                s.cantidad
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés suficiente dinero"
                });
            }

            await client.query(
                `
                UPDATE usuarios
                SET dinero = dinero - $1
                WHERE nombre = $2
                `,
                [
                    s.cantidad,
                    usuario
                ]
            );

            await client.query(
                `
                UPDATE usuarios
                SET dinero = dinero + $1
                WHERE nombre = $2
                `,
                [
                    s.cantidad,
                    s.solicitante
                ]
            );

            await client.query(
                `
                INSERT INTO transferencias
                (
                    remitente,
                    destinatario,
                    cantidad,
                    concepto
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    usuario,
                    s.solicitante,
                    s.cantidad,
                    "Solicitud de dinero"
                ]
            );

            await client.query(
                `
                UPDATE solicitudes
                SET estado = 'ACEPTADA'
                WHERE id = $1
                `,
                [id]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    s.solicitante,
                    "✅ Solicitud aceptada",
                    `${usuario} aceptó tu solicitud y te envió ₲${s.cantidad}.`
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    usuario,
                    "💸 Solicitud pagada",
                    `Enviaste ₲${s.cantidad} a ${s.solicitante}.`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Solicitud aceptada"
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al aceptar la solicitud"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// RECHAZAR SOLICITUD
// =========================

app.post(
    "/api/solicitudes/:id/rechazar",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        const usuario =
            req.body.usuario;

        if (
            !id ||
            !usuario
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        try {

            const solicitud =
                await pool.query(
                    `
                    SELECT *
                    FROM solicitudes
                    WHERE id = $1
                    `,
                    [id]
                );

            if (
                solicitud.rows.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "Solicitud no encontrada"
                });
            }

            const s =
                solicitud.rows[0];

            if (
                s.destinatario !==
                usuario
            ) {

                return res.status(403).json({
                    error:
                        "No podés rechazar esta solicitud"
                });
            }

            if (
                s.estado !==
                "PENDIENTE"
            ) {

                return res.status(400).json({
                    error:
                        "Esta solicitud ya fue procesada"
                });
            }

            await pool.query(
                `
                UPDATE solicitudes
                SET estado = 'RECHAZADA'
                WHERE id = $1
                `,
                [id]
            );

            await notificar(
                s.solicitante,
                "❌ Solicitud rechazada",
                `${usuario} rechazó tu solicitud de ₲${s.cantidad}.`
            );

            res.json({
                mensaje:
                    "Solicitud rechazada"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al rechazar la solicitud"
            });
        }
    }
);


// ======================================================
// TINCOINS
// ======================================================

// =========================
// ACTUALIZAR PRECIO AUTOMÁTICO
// =========================

async function actualizarTinCoinAutomaticamente() {

    const client =
        await pool.connect();

    try {

        await client.query(
            "BEGIN"
        );

        const config =
            await client.query(
                `
                SELECT
                    precio,
                    proxima_actualizacion
                FROM tincoin_config
                WHERE id = 1
                FOR UPDATE
                `
            );

        if (
            config.rows.length === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            return;
        }

        const actual =
            Number(
                config.rows[0].precio
            );

        const proxima =
            config.rows[0]
                .proxima_actualizacion;

        if (
            proxima &&
            new Date(proxima) >
            new Date()
        ) {

            await client.query(
                "COMMIT"
            );

            return;
        }

        // Entre -10% y +10%
        const porcentaje =
            (Math.random() * 20) - 10;

        let nuevoPrecio =
            actual *
            (1 + porcentaje / 100);

        // Nunca permitir 0 o negativo
        nuevoPrecio =
            Math.max(
                0.01,
                Number(
                    nuevoPrecio.toFixed(4)
                )
            );

        const porcentajeReal =
            ((nuevoPrecio - actual) /
            actual) * 100;

        await client.query(
            `
            UPDATE tincoin_config
            SET
                precio = $1,
                ultima_actualizacion =
                    CURRENT_TIMESTAMP,

                proxima_actualizacion =
                    CURRENT_TIMESTAMP +
                    INTERVAL '3 hours'

            WHERE id = 1
            `,
            [
                nuevoPrecio
            ]
        );

        await client.query(
            `
            INSERT INTO tincoin_historial
            (
                precio,
                porcentaje,
                tipo,
                actor
            )
            VALUES
            ($1, $2, 'AUTOMATICO', 'SISTEMA')
            `,
            [
                nuevoPrecio,
                porcentajeReal
            ]
        );

        await client.query(
            `
            INSERT INTO auditoria
            (
                tipo,
                actor,
                usuario,
                detalle
            )
            VALUES
            (
                'TINCOIN_CAMBIO_AUTOMATICO',
                'SISTEMA',
                NULL,
                $1
            )
            `,
            [
                `TinCoin: ₲${actual.toFixed(4)} → ₲${nuevoPrecio.toFixed(4)} (${porcentajeReal >= 0 ? "+" : ""}${porcentajeReal.toFixed(2)}%)`
            ]
        );

        await client.query(
            "COMMIT"
        );

        console.log(
            `🪙 TinCoin automático: ₲${actual.toFixed(4)} → ₲${nuevoPrecio.toFixed(4)} (${porcentajeReal.toFixed(2)}%)`
        );

    } catch (error) {

        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Error actualizando TinCoin:",
            error
        );

    } finally {

        client.release();
    }
}


// =========================
// INFORMACIÓN TINCOIN
// =========================

app.get(
    "/api/tincoins",
    async (req, res) => {

        const usuario =
            req.query.usuario;

        try {

            const config =
                await pool.query(
                    `
                    SELECT
                        precio,
                        ultima_actualizacion,
                        proxima_actualizacion
                    FROM tincoin_config
                    WHERE id = 1
                    `
                );

            const historial =
                await pool.query(
                    `
                    SELECT
                        id,
                        precio,
                        porcentaje,
                        tipo,
                        actor,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI:SS'
                        ) AS fecha

                    FROM tincoin_historial

                    ORDER BY id DESC

                    LIMIT 60
                    `
                );

            const precio =
                Number(
                    config.rows[0].precio
                );

            const datosHistorial =
                historial.rows
                    .reverse()
                    .map(function(h) {

                        return {
                            id: h.id,
                            precio:
                                Number(
                                    h.precio
                                ),
                            porcentaje:
                                Number(
                                    h.porcentaje
                                ),
                            tipo:
                                h.tipo,
                            actor:
                                h.actor,
                            fecha:
                                h.fecha
                        };
                    });

            let posicion = {
                tincoins: 0,
                capital: 0,
                valor: 0,
                ganancia: 0,
                porcentaje: 0
            };

            if (usuario) {

                const posicionDB =
                    await pool.query(
                        `
                        SELECT
                            cantidad,
                            capital_invertido
                        FROM tincoin_saldos
                        WHERE usuario = $1
                        `,
                        [usuario]
                    );

                if (
                    posicionDB.rows.length > 0
                ) {

                    const tincoins =
                        Number(
                            posicionDB.rows[0]
                                .cantidad
                        );

                    const capital =
                        Number(
                            posicionDB.rows[0]
                                .capital_invertido
                        );

                    const valor =
                        tincoins *
                        precio;

                    const ganancia =
                        valor -
                        capital;

                    const porcentajeGanancia =
                        capital > 0
                            ? (
                                ganancia /
                                capital
                            ) * 100
                            : 0;

                    posicion = {
                        tincoins,
                        capital,
                        valor,
                        ganancia,
                        porcentaje:
                            porcentajeGanancia
                    };
                }
            }

            let ultimoPorcentaje = 0;

            if (
                datosHistorial.length >= 2
            ) {

                const ultimo =
                    datosHistorial[
                        datosHistorial.length - 1
                    ];

                ultimoPorcentaje =
                    Number(
                        ultimo.porcentaje
                    );
            }

            res.json({
                precio,

                porcentaje:
                    ultimoPorcentaje,

                ultimaActualizacion:
                    config.rows[0]
                        .ultima_actualizacion,

                proximaActualizacion:
                    config.rows[0]
                        .proxima_actualizacion,

                historial:
                    datosHistorial,

                posicion
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "No se pudo cargar TinCoin"
            });
        }
    }
);


// =========================
// INVERTIR TINCOINS
// =========================

app.post(
    "/api/tincoins/invertir",
    async (req, res) => {

        const {
            usuario,
            cantidad
        } = req.body;

        const dinero =
            Number(cantidad);

        if (
            !usuario ||
            !Number.isFinite(dinero) ||
            dinero <= 0 ||
            !Number.isInteger(dinero)
        ) {

            return res.status(400).json({
                error:
                    "La cantidad debe ser un número entero mayor que 0."
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const usuarioDB =
                await client.query(
                    `
                    SELECT dinero
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [usuario]
                );

            if (
                usuarioDB.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "Usuario no encontrado"
                });
            }

            const saldo =
                Number(
                    usuarioDB.rows[0].dinero
                );

            if (
                saldo < dinero
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés suficiente dinero disponible"
                });
            }

            const config =
                await client.query(
                    `
                    SELECT precio
                    FROM tincoin_config
                    WHERE id = 1
                    `
                );

            const precio =
                Number(
                    config.rows[0].precio
                );

            const tincoins =
                dinero /
                precio;

            await client.query(
                `
                UPDATE usuarios
                SET dinero =
                    dinero - $1
                WHERE nombre = $2
                `,
                [
                    dinero,
                    usuario
                ]
            );

            await client.query(
                `
                INSERT INTO tincoin_saldos
                (
                    usuario,
                    cantidad,
                    capital_invertido
                )
                VALUES
                ($1, $2, $3)

                ON CONFLICT (usuario)

                DO UPDATE SET
                    cantidad =
                        tincoin_saldos.cantidad +
                        EXCLUDED.cantidad,

                    capital_invertido =
                        tincoin_saldos.capital_invertido +
                        EXCLUDED.capital_invertido
                `,
                [
                    usuario,
                    tincoins,
                    dinero
                ]
            );

            await client.query(
                `
                INSERT INTO tincoin_operaciones
                (
                    usuario,
                    tipo,
                    dinero,
                    tincoins,
                    precio,
                    resultado,
                    ganancia
                )
                VALUES
                (
                    $1,
                    'INVERSION',
                    $2,
                    $3,
                    $4,
                    $2,
                    0
                )
                `,
                [
                    usuario,
                    dinero,
                    tincoins,
                    precio
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
                VALUES
                (
                    'TINCOIN_INVERSION',
                    $1,
                    $1,
                    $2,
                    $3
                )
                `,
                [
                    usuario,
                    dinero,
                    `Invirtió ₲${dinero} y recibió ${tincoins.toFixed(8)} TinCoins a ₲${precio.toFixed(4)}`
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    usuario,
                    "🪙 Inversión realizada",
                    `Invertiste ₲${dinero} y recibiste ${tincoins.toFixed(8)} TinCoins.`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Inversión realizada",

                tincoins,

                precio
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al realizar la inversión"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// RETIRAR TINCOINS
// =========================

app.post(
    "/api/tincoins/retirar",
    async (req, res) => {

        const {
            usuario,
            cantidad
        } = req.body;

        const tincoinsARetirar =
            Number(cantidad);

        if (
            !usuario ||
            !Number.isFinite(
                tincoinsARetirar
            ) ||
            tincoinsARetirar <= 0
        ) {

            return res.status(400).json({
                error:
                    "Cantidad de TinCoins inválida."
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const posicionDB =
                await client.query(
                    `
                    SELECT
                        cantidad,
                        capital_invertido
                    FROM tincoin_saldos
                    WHERE usuario = $1
                    FOR UPDATE
                    `,
                    [usuario]
                );

            if (
                posicionDB.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés TinCoins para retirar."
                });
            }

            const cantidadActual =
                Number(
                    posicionDB.rows[0]
                        .cantidad
                );

            const capitalActual =
                Number(
                    posicionDB.rows[0]
                        .capital_invertido
                );

            if (
                tincoinsARetirar >
                cantidadActual + 0.00000001
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "No tenés suficientes TinCoins."
                });
            }

            const config =
                await client.query(
                    `
                    SELECT precio
                    FROM tincoin_config
                    WHERE id = 1
                    `
                );

            const precio =
                Number(
                    config.rows[0].precio
                );

            const dineroRecibido =
                tincoinsARetirar *
                precio;

            const proporcion =
                tincoinsARetirar /
                cantidadActual;

            const capitalRetirado =
                capitalActual *
                proporcion;

            const ganancia =
                dineroRecibido -
                capitalRetirado;

            const nuevaCantidad =
                Math.max(
                    0,
                    cantidadActual -
                    tincoinsARetirar
                );

            const nuevoCapital =
                Math.max(
                    0,
                    capitalActual -
                    capitalRetirado
                );

            await client.query(
                `
                UPDATE tincoin_saldos
                SET
                    cantidad = $1,
                    capital_invertido = $2
                WHERE usuario = $3
                `,
                [
                    nuevaCantidad,
                    nuevoCapital,
                    usuario
                ]
            );

            await client.query(
                `
                UPDATE usuarios
                SET dinero =
                    dinero + $1
                WHERE nombre = $2
                `,
                [
                    dineroRecibido,
                    usuario
                ]
            );

            await client.query(
                `
                INSERT INTO tincoin_operaciones
                (
                    usuario,
                    tipo,
                    dinero,
                    tincoins,
                    precio,
                    resultado,
                    ganancia
                )
                VALUES
                (
                    $1,
                    'RETIRO',
                    $2,
                    $3,
                    $4,
                    $2,
                    $5
                )
                `,
                [
                    usuario,
                    dineroRecibido,
                    tincoinsARetirar,
                    precio,
                    ganancia
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
                VALUES
                (
                    'TINCOIN_RETIRO',
                    $1,
                    $1,
                    $2,
                    $3
                )
                `,
                [
                    usuario,
                    Math.round(
                        dineroRecibido
                    ),
                    `Retiró ${tincoinsARetirar.toFixed(8)} TinCoins a ₲${precio.toFixed(4)} y recibió ₲${dineroRecibido.toFixed(2)}. Resultado: ${ganancia >= 0 ? "+" : ""}₲${ganancia.toFixed(2)}`
                ]
            );

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    usuario,
                    "💸 Inversión retirada",
                    `Retiraste ${tincoinsARetirar.toFixed(8)} TinCoins y recibiste ₲${dineroRecibido.toFixed(2)}. Resultado: ${ganancia >= 0 ? "+" : ""}₲${ganancia.toFixed(2)}.`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Inversión retirada",

                dinero:
                    dineroRecibido,

                precio,

                ganancia
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al retirar la inversión"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// ADMIN — INFORMACIÓN TINCOIN
// =========================

app.get(
    "/api/admin/tincoins",
    verificarAdmin,
    async (req, res) => {

        try {

            const config =
                await pool.query(
                    `
                    SELECT
                        precio,
                        ultima_actualizacion,
                        proxima_actualizacion
                    FROM tincoin_config
                    WHERE id = 1
                    `
                );

            const resumen =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                            AS inversores,

                        COALESCE(
                            SUM(cantidad),
                            0
                        ) AS tincoins,

                        COALESCE(
                            SUM(capital_invertido),
                            0
                        ) AS capital

                    FROM tincoin_saldos

                    WHERE cantidad > 0
                    `
                );

            const precio =
                Number(
                    config.rows[0].precio
                );

            const tincoins =
                Number(
                    resumen.rows[0].tincoins
                );

            const capital =
                Number(
                    resumen.rows[0].capital
                );

            res.json({
                precio,

                proximaActualizacion:
                    config.rows[0]
                        .proxima_actualizacion,

                inversores:
                    resumen.rows[0]
                        .inversores,

                tincoins,

                capital,

                valorActual:
                    tincoins *
                    precio,

                gananciaGlobal:
                    (
                        tincoins *
                        precio
                    ) -
                    capital
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar información TinCoin"
            });
        }
    }
);


// =========================
// ADMIN — CAMBIAR PRECIO
// =========================

app.post(
    "/api/admin/tincoins/precio",
    verificarAdmin,
    async (req, res) => {

        const precio =
            Number(
                req.body.precio
            );

        if (
            !Number.isFinite(precio) ||
            precio <= 0
        ) {

            return res.status(400).json({
                error:
                    "El precio debe ser mayor que 0."
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const anteriorDB =
                await client.query(
                    `
                    SELECT precio
                    FROM tincoin_config
                    WHERE id = 1
                    FOR UPDATE
                    `
                );

            const anterior =
                Number(
                    anteriorDB.rows[0]
                        .precio
                );

            const porcentaje =
                anterior > 0
                    ? (
                        (
                            precio -
                            anterior
                        ) /
                        anterior
                    ) * 100
                    : 0;

            await client.query(
                `
                UPDATE tincoin_config
                SET
                    precio = $1,
                    ultima_actualizacion =
                        CURRENT_TIMESTAMP,

                    proxima_actualizacion =
                        CURRENT_TIMESTAMP +
                        INTERVAL '3 hours'

                WHERE id = 1
                `,
                [
                    precio
                ]
            );

            await client.query(
                `
                INSERT INTO tincoin_historial
                (
                    precio,
                    porcentaje,
                    tipo,
                    actor
                )
                VALUES
                (
                    $1,
                    $2,
                    'ADMIN',
                    'AdminGrafonia'
                )
                `,
                [
                    precio,
                    porcentaje
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    detalle
                )
                VALUES
                (
                    'TINCOIN_CAMBIO_ADMIN',
                    'AdminGrafonia',
                    NULL,
                    $1
                )
                `,
                [
                    `Precio TinCoin modificado manualmente: ₲${anterior.toFixed(4)} → ₲${precio.toFixed(4)} (${porcentaje >= 0 ? "+" : ""}${porcentaje.toFixed(2)}%)`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Precio actualizado",

                precio,

                porcentaje
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cambiar el precio TinCoin"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// ADMIN — CAMBIAR PORCENTAJE
// =========================

app.post(
    "/api/admin/tincoins/porcentaje",
    verificarAdmin,
    async (req, res) => {

        const porcentaje =
            Number(
                req.body.porcentaje
            );

        if (
            !Number.isFinite(
                porcentaje
            )
        ) {

            return res.status(400).json({
                error:
                    "Porcentaje inválido."
            });
        }

        if (
            porcentaje <= -100
        ) {

            return res.status(400).json({
                error:
                    "El porcentaje no puede llevar el precio a cero o menos."
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const config =
                await client.query(
                    `
                    SELECT precio
                    FROM tincoin_config
                    WHERE id = 1
                    FOR UPDATE
                    `
                );

            const anterior =
                Number(
                    config.rows[0]
                        .precio
                );

            const nuevoPrecio =
                Math.max(
                    0.01,
                    Number(
                        (
                            anterior *
                            (
                                1 +
                                porcentaje /
                                100
                            )
                        ).toFixed(4)
                    )
                );

            const porcentajeReal =
                (
                    (
                        nuevoPrecio -
                        anterior
                    ) /
                    anterior
                ) * 100;

            await client.query(
                `
                UPDATE tincoin_config
                SET
                    precio = $1,
                    ultima_actualizacion =
                        CURRENT_TIMESTAMP,

                    proxima_actualizacion =
                        CURRENT_TIMESTAMP +
                        INTERVAL '3 hours'

                WHERE id = 1
                `,
                [
                    nuevoPrecio
                ]
            );

            await client.query(
                `
                INSERT INTO tincoin_historial
                (
                    precio,
                    porcentaje,
                    tipo,
                    actor
                )
                VALUES
                (
                    $1,
                    $2,
                    'ADMIN',
                    'AdminGrafonia'
                )
                `,
                [
                    nuevoPrecio,
                    porcentajeReal
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    detalle
                )
                VALUES
                (
                    'TINCOIN_CAMBIO_ADMIN',
                    'AdminGrafonia',
                    NULL,
                    $1
                )
                `,
                [
                    `Admin modificó TinCoin ${porcentajeReal >= 0 ? "+" : ""}${porcentajeReal.toFixed(2)}%: ₲${anterior.toFixed(4)} → ₲${nuevoPrecio.toFixed(4)}`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Porcentaje aplicado",

                precio:
                    nuevoPrecio,

                porcentaje:
                    porcentajeReal
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al modificar TinCoin"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// ADMIN — HISTORIAL TINCOIN
// =========================

app.get(
    "/api/admin/tincoins/historial",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        precio,
                        porcentaje,
                        tipo,
                        actor,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI:SS'
                        ) AS fecha

                    FROM tincoin_historial

                    ORDER BY id DESC

                    LIMIT 100
                    `
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar historial TinCoin"
            });
        }
    }
);


// =========================
// ADMIN — OPERACIONES TINCOIN
// =========================

app.get(
    "/api/admin/tincoins/operaciones",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        usuario,
                        tipo,
                        dinero,
                        tincoins,
                        precio,
                        resultado,
                        ganancia,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI:SS'
                        ) AS fecha

                    FROM tincoin_operaciones

                    ORDER BY id DESC

                    LIMIT 100
                    `
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar operaciones TinCoin"
            });
        }
    }
);


// =========================
// ADMIN — AGREGAR DINERO
// =========================

app.post(
    "/api/admin/agregar-dinero",
    verificarAdmin,
    async (req, res) => {

        const {
            nombre,
            cantidad
        } = req.body;

        if (
            !nombre ||
            !cantidad ||
            cantidad <= 0
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const resultado =
                await client.query(
                    `
                    SELECT dinero
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [nombre]
                );

            if (
                resultado.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "Ese usuario no existe"
                });
            }

            const saldoAnterior =
                resultado.rows[0].dinero;

            const saldoNuevo =
                saldoAnterior +
                cantidad;

            await client.query(
                `
                UPDATE usuarios
                SET dinero = $1
                WHERE nombre = $2
                `,
                [
                    saldoNuevo,
                    nombre
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
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

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    nombre,
                    "💰 Dinero recibido",
                    `El administrador agregó ₲${cantidad} a tu cuenta.`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Dinero agregado",
                saldo:
                    saldoNuevo
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al agregar dinero"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// ADMIN — QUITAR DINERO
// =========================

app.post(
    "/api/admin/quitar-dinero",
    verificarAdmin,
    async (req, res) => {

        const {
            nombre,
            cantidad
        } = req.body;

        if (
            !nombre ||
            !cantidad ||
            cantidad <= 0
        ) {

            return res.status(400).json({
                error:
                    "Datos inválidos"
            });
        }

        const client =
            await pool.connect();

        try {

            await client.query(
                "BEGIN"
            );

            const resultado =
                await client.query(
                    `
                    SELECT dinero
                    FROM usuarios
                    WHERE nombre = $1
                    FOR UPDATE
                    `,
                    [nombre]
                );

            if (
                resultado.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    error:
                        "Ese usuario no existe"
                });
            }

            const saldoAnterior =
                resultado.rows[0].dinero;

            if (
                saldoAnterior <
                cantidad
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    error:
                        "Ese usuario no tiene suficiente dinero"
                });
            }

            const saldoNuevo =
                saldoAnterior -
                cantidad;

            await client.query(
                `
                UPDATE usuarios
                SET dinero = $1
                WHERE nombre = $2
                `,
                [
                    saldoNuevo,
                    nombre
                ]
            );

            await client.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
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

            await client.query(
                `
                INSERT INTO notificaciones
                (
                    usuario,
                    titulo,
                    mensaje
                )
                VALUES ($1, $2, $3)
                `,
                [
                    nombre,
                    "💸 Dinero descontado",
                    `El administrador quitó ₲${cantidad} de tu cuenta.`
                ]
            );

            await client.query(
                "COMMIT"
            );

            res.json({
                mensaje:
                    "Dinero quitado",
                saldo:
                    saldoNuevo
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(error);

            res.status(500).json({
                error:
                    "Error al quitar dinero"
            });

        } finally {

            client.release();
        }
    }
);


// =========================
// ADMIN — EMPLEOS
// =========================

app.get(
    "/api/admin/empleos",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        nombre,
                        trabajo,
                        sueldo,
                        ultimo_pago
                    FROM usuarios
                    ORDER BY nombre ASC
                    `
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar empleos"
            });
        }
    }
);


app.post(
    "/api/admin/empleo",
    verificarAdmin,
    async (req, res) => {

        const {
            nombre,
            trabajo,
            sueldo
        } = req.body;

        if (
            !nombre ||
            sueldo === undefined ||
            Number(sueldo) < 0
        ) {

            return res.status(400).json({
                error:
                    "Datos de empleo inválidos"
            });
        }

        const sueldoNumero =
            Number(sueldo);

        const trabajoLimpio =
            String(
                trabajo || ""
            )
            .trim()
            .slice(0, 80);

        const trabajoFinal =
            trabajoLimpio ||
            "Sin empleo";

        try {

            const usuario =
                await pool.query(
                    `
                    SELECT nombre
                    FROM usuarios
                    WHERE nombre = $1
                    `,
                    [nombre]
                );

            if (
                usuario.rows.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "Ese usuario no existe"
                });
            }

            await pool.query(
                `
                UPDATE usuarios
                SET
                    trabajo = $1,
                    sueldo = $2,

                    ultimo_pago =
                        CASE
                            WHEN $2 > 0
                            THEN CURRENT_TIMESTAMP
                            ELSE NULL
                        END

                WHERE nombre = $3
                `,
                [
                    trabajoFinal,
                    sueldoNumero,
                    nombre
                ]
            );

            await pool.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    "EMPLEO_MODIFICADO",
                    "AdminGrafonia",
                    nombre,
                    sueldoNumero,
                    `Trabajo: ${trabajoFinal} | Sueldo diario: ₲${sueldoNumero}`
                ]
            );

            await notificar(
                nombre,
                "💼 Empleo actualizado",
                `Tu empleo ahora es "${trabajoFinal}" con un sueldo diario de ₲${sueldoNumero}.`
            );

            res.json({
                mensaje:
                    "Empleo actualizado"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al actualizar el empleo"
            });
        }
    }
);


// =========================
// ADMIN — ELIMINAR USUARIO
// =========================

app.delete(
    "/api/admin/usuarios/:nombre",
    verificarAdmin,
    async (req, res) => {

        const nombre =
            req.params.nombre;

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        dinero,
                        ahorro
                    FROM usuarios
                    WHERE nombre = $1
                    `,
                    [nombre]
                );

            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "Ese usuario no existe"
                });
            }

            const saldo =
                resultado.rows[0].dinero;

            const ahorro =
                resultado.rows[0].ahorro;

            // Eliminar también su posición TinCoin
            await pool.query(
                `
                DELETE FROM tincoin_saldos
                WHERE usuario = $1
                `,
                [nombre]
            );

            await pool.query(
                `
                DELETE FROM usuarios
                WHERE nombre = $1
                `,
                [nombre]
            );

            await pool.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
                VALUES ($1, $2, $3, $4, $5)
                `,
                [
                    "USUARIO_ELIMINADO",
                    "AdminGrafonia",
                    nombre,
                    saldo,
                    `Usuario eliminado. Saldo: ₲${saldo} | Ahorro: ₲${ahorro}`
                ]
            );

            res.json({
                mensaje:
                    "Usuario eliminado"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al eliminar usuario"
            });
        }
    }
);


// =========================
// ADMIN — ELIMINAR SIN NOMBRE
// =========================

app.delete(
    "/api/admin/usuarios-sin-nombre",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        nombre,
                        dinero
                    FROM usuarios
                    WHERE nombre = ''
                    `
                );

            if (
                resultado.rows.length === 0
            ) {

                return res.status(404).json({
                    error:
                        "No hay cuentas sin nombre"
                });
            }

            const cantidadEliminadas =
                resultado.rows.length;

            const dineroEliminado =
                resultado.rows.reduce(
                    function(
                        total,
                        usuario
                    ) {

                        return total +
                            usuario.dinero;

                    },
                    0
                );

            await pool.query(
                `
                DELETE FROM tincoin_saldos
                WHERE usuario = ''
                `
            );

            await pool.query(
                `
                DELETE FROM usuarios
                WHERE nombre = ''
                `
            );

            await pool.query(
                `
                INSERT INTO auditoria
                (
                    tipo,
                    actor,
                    usuario,
                    cantidad,
                    detalle
                )
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
                mensaje:
                    `${cantidadEliminadas} cuenta(s) sin nombre eliminada(s)`,

                dineroEliminado
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al eliminar cuentas sin nombre"
            });
        }
    }
);


// =========================
// ADMIN — AUDITORÍA
// =========================

app.get(
    "/api/admin/auditoria",
    verificarAdmin,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        tipo,
                        actor,
                        usuario,
                        cantidad,
                        detalle,

                        TO_CHAR(
                            fecha,
                            'DD/MM/YYYY HH24:MI:SS'
                        ) AS fecha

                    FROM auditoria

                    ORDER BY id DESC
                    `
                );

            res.json(
                resultado.rows
            );

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar la auditoría"
            });
        }
    }
);


// =========================
// ADMIN — ESTADÍSTICAS
// =========================

app.get(
    "/api/admin/estadisticas",
    verificarAdmin,
    async (req, res) => {

        try {

            const usuarios =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS cantidad
                    FROM usuarios
                    `
                );

            const dinero =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(dinero),
                            0
                        )::INTEGER AS total
                    FROM usuarios
                    `
                );

            const transferencias =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS cantidad
                    FROM transferencias
                    `
                );

            const dineroTransferido =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(cantidad),
                            0
                        )::INTEGER AS total
                    FROM transferencias
                    `
                );

            const tincoin =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(cantidad * (
                                SELECT precio
                                FROM tincoin_config
                                WHERE id = 1
                            )),
                            0
                        ) AS valor
                    FROM tincoin_saldos
                    `
                );

            res.json({
                usuarios:
                    usuarios.rows[0].cantidad,

                dineroEnCirculacion:
                    dinero.rows[0].total,

                transferencias:
                    transferencias.rows[0].cantidad,

                dineroTransferido:
                    dineroTransferido.rows[0].total,

                tincoinValor:
                    Number(
                        tincoin.rows[0].valor
                    )
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error al cargar estadísticas"
            });
        }
    }
);


// =========================
// ARRANQUE
// =========================

prepararBaseDeDatos()
    .then(async function() {

        // Revisar si ya corresponde
        // un cambio al iniciar.
        await actualizarTinCoinAutomaticamente();

        // Revisar periódicamente.
        setInterval(
            actualizarTinCoinAutomaticamente,
            60 * 1000
        );

        app.listen(
            PORT,
            "0.0.0.0",
            function() {

                console.log(
                    `Banco Grafonia iniciado en el puerto ${PORT}`
                );

                console.log(
                    "🪙 Sistema TinCoin activo."
                );
            }
        );

    })
    .catch(function(error) {

        console.error(
            "No se pudo preparar la base de datos:",
            error
        );
    });
