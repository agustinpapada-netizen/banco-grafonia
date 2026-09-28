let usuarios = {};
let adminToken = localStorage.getItem("adminToken");
let intervaloCliente = null;


// =========================
// CARGAR USUARIOS
// =========================

async function cargarUsuarios() {

    try {

        const respuesta =
            await fetch("/api/usuarios");

        if (!respuesta.ok) {
            throw new Error(
                "No se pudieron cargar los usuarios"
            );
        }

        usuarios =
            await respuesta.json();

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo conectar con Banco Grafonia 😭"
        );
    }
}


// =========================
// ENTRAR
// =========================

async function entrar() {

    const nombre =
        document
            .getElementById("nameInput")
            .value
            .trim();

    if (!nombre) {

        alert(
            "Escribí tu nombre primero 😭"
        );

        return;
    }

    // =========================
    // ADMIN
    // =========================

    if (
        nombre ===
        "AdminGrafonia"
    ) {

        const passwordInput =
            document.getElementById(
                "adminPassword"
            );

        const password =
            passwordInput.value;

        if (!password) {

            passwordInput.style.display =
                "block";

            alert(
                "Escribí la contraseña de administrador."
            );

            return;
        }

        try {

            const respuesta =
                await fetch(
                    "/api/admin/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            password
                        })
                    }
                );

            const datos =
                await respuesta.json();

            if (!respuesta.ok) {

                alert(datos.error);

                return;
            }

            adminToken =
                datos.token;

            localStorage.setItem(
                "adminToken",
                adminToken
            );

            localStorage.setItem(
                "usuarioActual",
                "AdminGrafonia"
            );

            passwordInput.value = "";

            mostrarAdmin();

            return;

        } catch (error) {

            console.error(error);

            alert(
                "No se pudo conectar con Banco Grafonia 😭"
            );

            return;
        }
    }


    // =========================
    // USUARIO NORMAL
    // =========================

    try {

        const respuesta =
            await fetch(
                "/api/usuarios",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        nombre
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        usuarios =
            datos.usuarios;

        localStorage.setItem(
            "usuarioActual",
            nombre
        );

        mostrarBanco();

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo conectar con Banco Grafonia 😭"
        );
    }
}


// =========================
// MOSTRAR BANCO
// =========================

function mostrarBanco() {

    const nombre =
        localStorage.getItem(
            "usuarioActual"
        );

    document
        .getElementById("login")
        .style.display = "none";

    document
        .getElementById("admin")
        .style.display = "none";

    document
        .getElementById("bank")
        .style.display = "block";

    document
        .getElementById("userName")
        .textContent = nombre;

    actualizarCliente();

    if (intervaloCliente) {
        clearInterval(intervaloCliente);
    }

    intervaloCliente =
        setInterval(
            actualizarCliente,
            30000
        );
}


// =========================
// ACTUALIZAR CLIENTE
// =========================

async function actualizarCliente() {

    await cargarUsuarios();

    actualizarSaldo();
    actualizarRanking();
    actualizarHistorial();
    actualizarPerfil();
    actualizarNotificaciones();
    actualizarSolicitudes();
    actualizarEconomia();
}


// =========================
// SALDO
// =========================

function actualizarSaldo() {

    const nombre =
        localStorage.getItem(
            "usuarioActual"
        );

    if (
        usuarios[nombre] !==
        undefined
    ) {

        document
            .getElementById("balance")
            .textContent =
            usuarios[nombre];
    }
}


// =========================
// RANKING
// =========================

function actualizarRanking() {

    const ranking =
        document.getElementById(
            "ranking"
        );

    if (!ranking) {
        return;
    }

    ranking.innerHTML = "";

    const lista =
        Object.entries(usuarios)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    if (lista.length === 0) {

        ranking.innerHTML =
            "<p>No hay usuarios todavía.</p>";

        return;
    }

    lista.forEach(
        function(usuario, index) {

            ranking.innerHTML +=
                "<p>" +
                "<strong>#" +
                (index + 1) +
                "</strong> " +
                escaparHTML(usuario[0]) +
                " — ₲" +
                usuario[1] +
                "</p>";
        }
    );
}


// =========================
// PERFIL
// =========================

async function actualizarPerfil() {

    const nombre =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/perfil?usuario=" +
                encodeURIComponent(nombre)
            );

        if (!respuesta.ok) {
            return;
        }

        const datos =
            await respuesta.json();

        const cuenta =
            datos.cuenta;

        const resumen =
            datos.resumen;

        document
            .getElementById("profileName")
            .textContent =
            cuenta.nombre;

        document
            .getElementById("profileJob")
            .textContent =
            cuenta.trabajo;

        document
            .getElementById("profileSalary")
            .textContent =
            "₲" + cuenta.sueldo;

        document
            .getElementById("profileSavings")
            .textContent =
            "₲" + cuenta.ahorro;

        document
            .getElementById("sentMonth")
            .textContent =
            "₲" +
            resumen.dineroenviado;

    } catch (error) {

        console.error(error);
    }
}


// =========================
// NOTIFICACIONES
// =========================

async function actualizarNotificaciones() {

    const contenedor =
        document.getElementById(
            "notificaciones"
        );

    const badge =
        document.getElementById(
            "notificationBadge"
        );

    if (!contenedor) {
        return;
    }

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/notificaciones?usuario=" +
                encodeURIComponent(usuario)
            );

        const notificaciones =
            await respuesta.json();

        contenedor.innerHTML = "";

        let noLeidas = 0;

        if (
            Array.isArray(
                notificaciones
            )
        ) {

            notificaciones.forEach(
                function(n) {

                    if (!n.leida) {
                        noLeidas++;
                    }

                    contenedor.innerHTML +=
                        "<div class='notification " +
                        (
                            n.leida
                                ? ""
                                : "unread"
                        ) +
                        "'>" +

                        "<strong>" +
                        escaparHTML(
                            n.titulo
                        ) +
                        "</strong>" +

                        "<p>" +
                        escaparHTML(
                            n.mensaje
                        ) +
                        "</p>" +

                        "<small>" +
                        n.fecha +
                        "</small>" +

                        "</div>";
                }
            );
        }

        if (
            notificaciones.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No tenés notificaciones.</p>";
        }

        if (badge) {

            badge.textContent =
                noLeidas;

            badge.style.display =
                noLeidas > 0
                    ? "inline-block"
                    : "none";
        }

    } catch (error) {

        console.error(error);
    }
}


async function marcarNotificacionesLeidas() {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        await fetch(
            "/api/notificaciones/leidas",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    usuario
                })
            }
        );

        actualizarNotificaciones();

    } catch (error) {

        console.error(error);
    }
}


// =========================
// HISTORIAL PERSONAL
// =========================

async function actualizarHistorial() {

    const historial =
        document.getElementById(
            "historial"
        );

    if (!historial) {
        return;
    }

    const usuarioActual =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/transferencias/mias?usuario=" +
                encodeURIComponent(
                    usuarioActual
                )
            );

        const transferencias =
            await respuesta.json();

        historial.innerHTML = "";

        if (
            !Array.isArray(
                transferencias
            ) ||
            transferencias.length === 0
        ) {

            historial.innerHTML =
                "<p>No hay transferencias todavía.</p>";

            return;
        }

        transferencias.forEach(
            function(t) {

                if (
                    t.remitente ===
                    usuarioActual
                ) {

                    historial.innerHTML +=
                        "<div class='movimiento'>" +
                        "💸 Enviaste ₲" +
                        t.cantidad +
                        " a <strong>" +
                        escaparHTML(
                            t.destinatario
                        ) +
                        "</strong>" +

                        (
                            t.concepto
                                ? "<br>📝 " +
                                  escaparHTML(
                                      t.concepto
                                  )
                                : ""
                        ) +

                        "<small>" +
                        t.fecha +
                        "</small>" +
                        "</div>";

                } else {

                    historial.innerHTML +=
                        "<div class='movimiento'>" +
                        "📥 Recibiste ₲" +
                        t.cantidad +
                        " de <strong>" +
                        escaparHTML(
                            t.remitente
                        ) +
                        "</strong>" +

                        (
                            t.concepto
                                ? "<br>📝 " +
                                  escaparHTML(
                                      t.concepto
                                  )
                                : ""
                        ) +

                        "<small>" +
                        t.fecha +
                        "</small>" +
                        "</div>";
                }
            }
        );

    } catch (error) {

        console.error(error);

        historial.innerHTML =
            "<p>No se pudo cargar el historial.</p>";
    }
}


// =========================
// TRANSFERIR
// =========================

async function transferir() {

    const remitente =
        localStorage.getItem(
            "usuarioActual"
        );

    const destinatario =
        document
            .getElementById("receiver")
            .value
            .trim();

    const cantidad =
        Number(
            document
                .getElementById("amount")
                .value
        );

    const concepto =
        document
            .getElementById("concept")
            .value
            .trim();

    if (
        !destinatario ||
        !cantidad
    ) {

        alert(
            "Completá todos los campos 😭"
        );

        return;
    }

    if (cantidad <= 0) {

        alert(
            "La cantidad debe ser mayor que 0."
        );

        return;
    }

    if (
        destinatario ===
        remitente
    ) {

        alert(
            "No podés transferirte dinero a vos mismo 😭"
        );

        return;
    }

    const confirmar =
        confirm(
            "¿Confirmás transferir ₲" +
            cantidad +
            " a " +
            destinatario +
            "?"
        );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/transferir",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        remitente,
                        destinatario,
                        cantidad,
                        concepto
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        usuarios =
            datos.usuarios;

        document
            .getElementById("receiver")
            .value = "";

        document
            .getElementById("amount")
            .value = "";

        document
            .getElementById("concept")
            .value = "";

        actualizarCliente();

        alert(
            "Transferiste ₲" +
            cantidad +
            " a " +
            destinatario +
            " 💸"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo conectar con Banco Grafonia 😭"
        );
    }
}


// =========================
// AHORRO
// =========================

async function moverAhorro(tipo) {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    const cantidad =
        Number(
            document
                .getElementById(
                    "savingsAmount"
                )
                .value
        );

    if (
        !cantidad ||
        cantidad <= 0
    ) {

        alert(
            "Escribí una cantidad válida."
        );

        return;
    }

    const endpoint =
        tipo === "depositar"
            ? "/api/ahorros/depositar"
            : "/api/ahorros/retirar";

    try {

        const respuesta =
            await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        usuario,
                        cantidad
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        document
            .getElementById(
                "savingsAmount"
            )
            .value = "";

        await actualizarCliente();

        alert(
            tipo === "depositar"
                ? "Guardaste ₲" +
                  cantidad +
                  " 💰"
                : "Retiraste ₲" +
                  cantidad +
                  " 💸"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo modificar el ahorro."
        );
    }
}


// =========================
// ECONOMÍA
// =========================

async function actualizarEconomia() {

    try {

        const respuesta =
            await fetch(
                "/api/economia"
            );

        if (!respuesta.ok) {
            return;
        }

        const datos =
            await respuesta.json();

        document
            .getElementById(
                "economyUsers"
            )
            .textContent =
            datos.usuarios;

        document
            .getElementById(
                "economyMoney"
            )
            .textContent =
            "₲" +
            datos.dineroTotal;

        document
            .getElementById(
                "economyTransfers"
            )
            .textContent =
            datos.transferencias;

    } catch (error) {

        console.error(error);
    }
}


// =========================
// SOLICITUDES
// =========================

async function actualizarSolicitudes() {

    const contenedor =
        document.getElementById(
            "solicitudes"
        );

    if (!contenedor) {
        return;
    }

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/solicitudes?usuario=" +
                encodeURIComponent(
                    usuario
                )
            );

        const solicitudes =
            await respuesta.json();

        contenedor.innerHTML = "";

        if (
            !Array.isArray(
                solicitudes
            ) ||
            solicitudes.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No hay solicitudes.</p>";

            return;
        }

        solicitudes.forEach(
            function(s) {

                const soyDestinatario =
                    s.destinatario ===
                    usuario;

                let botones = "";

                if (
                    soyDestinatario &&
                    s.estado ===
                    "PENDIENTE"
                ) {

                    botones =
                        "<button onclick='aceptarSolicitud(" +
                        s.id +
                        ")'>✅ Aceptar</button>" +

                        "<button onclick='rechazarSolicitud(" +
                        s.id +
                        ")'>❌ Rechazar</button>";
                }

                contenedor.innerHTML +=
                    "<div class='solicitud'>" +

                    "<strong>" +
                    (
                        soyDestinatario
                            ? "🧑‍💼 " +
                              escaparHTML(
                                  s.solicitante
                              ) +
                              " te solicita"
                            : "📤 Solicitaste"
                    ) +
                    "</strong>" +

                    "<h3>₲" +
                    s.cantidad +
                    "</h3>" +

                    (
                        s.motivo
                            ? "<p>📝 " +
                              escaparHTML(
                                  s.motivo
                              ) +
                              "</p>"
                            : ""
                    ) +

                    "<span class='estado-" +
                    s.estado.toLowerCase() +
                    "'>" +
                    s.estado +
                    "</span>" +

                    "<small>" +
                    s.fecha +
                    "</small>" +

                    botones +

                    "</div>";
            }
        );

    } catch (error) {

        console.error(error);
    }
}


async function solicitarDinero() {

    const solicitante =
        localStorage.getItem(
            "usuarioActual"
        );

    const destinatario =
        document
            .getElementById(
                "requestUser"
            )
            .value
            .trim();

    const cantidad =
        Number(
            document
                .getElementById(
                    "requestAmount"
                )
                .value
        );

    const motivo =
        document
            .getElementById(
                "requestReason"
            )
            .value
            .trim();

    if (
        !destinatario ||
        !cantidad
    ) {

        alert(
            "Completá el usuario y la cantidad."
        );

        return;
    }

    if (cantidad <= 0) {

        alert(
            "La cantidad debe ser mayor que 0."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/solicitudes",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        solicitante,
                        destinatario,
                        cantidad,
                        motivo
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        document
            .getElementById(
                "requestUser"
            )
            .value = "";

        document
            .getElementById(
                "requestAmount"
            )
            .value = "";

        document
            .getElementById(
                "requestReason"
            )
            .value = "";

        actualizarSolicitudes();

        alert(
            "Solicitud enviada 🧑‍💼"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo enviar la solicitud."
        );
    }
}


async function aceptarSolicitud(id) {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/solicitudes/" +
                id +
                "/aceptar",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        usuario
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        await actualizarCliente();

        alert(
            "Solicitud aceptada 💸"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo aceptar la solicitud."
        );
    }
}


async function rechazarSolicitud(id) {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/solicitudes/" +
                id +
                "/rechazar",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        usuario
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        actualizarSolicitudes();

        alert(
            "Solicitud rechazada."
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo rechazar la solicitud."
        );
    }
}


// =========================
// MOSTRAR ADMIN
// =========================

function mostrarAdmin() {

    if (intervaloCliente) {

        clearInterval(
            intervaloCliente
        );

        intervaloCliente =
            null;
    }

    document
        .getElementById("login")
        .style.display = "none";

    document
        .getElementById("bank")
        .style.display = "none";

    document
        .getElementById("admin")
        .style.display = "block";

    actualizarUsuariosAdmin();
    actualizarEstadisticasAdmin();
    actualizarHistorialAdmin();
    actualizarAuditoria();
    actualizarEmpleosAdmin();
}


// =========================
// RANKING ADMIN
// =========================

function actualizarUsuariosAdmin() {

    const ranking =
        document.getElementById(
            "adminRanking"
        );

    if (!ranking) {
        return;
    }

    ranking.innerHTML = "";

    const lista =
        Object.entries(usuarios)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    if (lista.length === 0) {

        ranking.innerHTML =
            "<p>No hay usuarios todavía.</p>";

        return;
    }

    lista.forEach(
        function(usuario, index) {

            const nombre =
                usuario[0] === ""
                    ? "(SIN NOMBRE)"
                    : usuario[0];

            ranking.innerHTML +=
                "<div class='admin-user'>" +
                "<strong>#" +
                (index + 1) +
                "</strong> " +
                escaparHTML(nombre) +
                " — ₲" +
                usuario[1] +
                "</div>";
        }
    );
}


// =========================
// ESTADÍSTICAS ADMIN
// =========================

async function actualizarEstadisticasAdmin() {

    if (!adminToken) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/estadisticas",
                {
                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        if (!respuesta.ok) {
            return;
        }

        const datos =
            await respuesta.json();

        document
            .getElementById(
                "adminTotal"
            )
            .textContent =
            datos.dineroEnCirculacion;

        document
            .getElementById(
                "adminUsers"
            )
            .textContent =
            datos.usuarios;

        document
            .getElementById(
                "adminTransfers"
            )
            .textContent =
            datos.transferencias;

        document
            .getElementById(
                "adminTransferred"
            )
            .textContent =
            datos.dineroTransferido;

    } catch (error) {

        console.error(error);
    }
}


// =========================
// HISTORIAL ADMIN
// =========================

async function actualizarHistorialAdmin() {

    const historial =
        document.getElementById(
            "adminHistorial"
        );

    if (
        !historial ||
        !adminToken
    ) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/transferencias",
                {
                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        if (!respuesta.ok) {

            historial.innerHTML =
                "<p>No autorizado.</p>";

            return;
        }

        const transferencias =
            await respuesta.json();

        historial.innerHTML = "";

        if (
            transferencias.length === 0
        ) {

            historial.innerHTML =
                "<p>No hay transferencias todavía.</p>";

            return;
        }

        transferencias.forEach(
            function(t) {

                historial.innerHTML +=
                    "<div class='movimiento'>" +
                    "💸 <strong>" +
                    escaparHTML(
                        t.remitente
                    ) +
                    "</strong> → <strong>" +
                    escaparHTML(
                        t.destinatario
                    ) +
                    "</strong>: ₲" +
                    t.cantidad +

                    (
                        t.concepto
                            ? "<br>📝 " +
                              escaparHTML(
                                  t.concepto
                              )
                            : ""
                    ) +

                    "<small>" +
                    t.fecha +
                    "</small>" +
                    "</div>";
            }
        );

    } catch (error) {

        console.error(error);

        historial.innerHTML =
            "<p>No se pudo cargar el historial.</p>";
    }
}


// =========================
// AUDITORÍA ADMIN
// =========================

async function actualizarAuditoria() {

    const contenedor =
        document.getElementById(
            "auditoria"
        );

    if (
        !contenedor ||
        !adminToken
    ) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/auditoria",
                {
                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        if (!respuesta.ok) {
            return;
        }

        const registros =
            await respuesta.json();

        contenedor.innerHTML = "";

        if (
            registros.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No hay registros todavía.</p>";

            return;
        }

        registros.forEach(
            function(r) {

                let icono =
                    "📋";

                if (
                    r.tipo ===
                    "DINERO_AGREGADO"
                ) {
                    icono = "➕";
                }

                if (
                    r.tipo ===
                    "DINERO_QUITADO"
                ) {
                    icono = "➖";
                }

                if (
                    r.tipo ===
                    "SUELDO_PAGADO"
                ) {
                    icono = "💼";
                }

                if (
                    r.tipo ===
                    "EMPLEO_MODIFICADO"
                ) {
                    icono = "👔";
                }

                if (
                    r.tipo ===
                    "AHORRO_DEPOSITADO"
                ) {
                    icono = "🏦";
                }

                if (
                    r.tipo ===
                    "AHORRO_RETIRADO"
                ) {
                    icono = "💰";
                }

                if (
                    r.tipo ===
                    "USUARIO_ELIMINADO" ||
                    r.tipo ===
                    "USUARIO_SIN_NOMBRE_ELIMINADO"
                ) {
                    icono = "🗑️";
                }

                if (
                    r.tipo ===
                    "CREACION_USUARIO"
                ) {
                    icono = "👤";
                }

                contenedor.innerHTML +=
                    "<div class='movimiento'>" +
                    icono +
                    " <strong>" +
                    escaparHTML(
                        r.tipo
                    ) +
                    "</strong>" +
                    "<br>" +
                    "Usuario: " +
                    escaparHTML(
                        r.usuario ||
                        "-"
                    ) +
                    "<br>" +
                    escaparHTML(
                        r.detalle ||
                        ""
                    ) +
                    "<small>" +
                    r.fecha +
                    "</small>" +
                    "</div>";
            }
        );

    } catch (error) {

        console.error(error);
    }
}


// =========================
// ADMIN — EMPLEOS
// =========================

async function actualizarEmpleosAdmin() {

    const contenedor =
        document.getElementById(
            "adminEmpleos"
        );

    if (
        !contenedor ||
        !adminToken
    ) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/empleos",
                {
                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        if (!respuesta.ok) {
            return;
        }

        const usuariosEmpleo =
            await respuesta.json();

        contenedor.innerHTML = "";

        usuariosEmpleo.forEach(
            function(u) {

                contenedor.innerHTML +=
                    "<div class='job-row'>" +

                    "<strong>" +
                    escaparHTML(
                        u.nombre
                    ) +
                    "</strong>" +

                    "<span>" +
                    escaparHTML(
                        u.trabajo
                    ) +
                    " — ₲" +
                    u.sueldo +
                    "</span>" +

                    "</div>";
            }
        );

    } catch (error) {

        console.error(error);
    }
}


async function guardarEmpleo() {

    const nombre =
        document
            .getElementById(
                "jobUser"
            )
            .value
            .trim();

    const trabajo =
        document
            .getElementById(
                "jobName"
            )
            .value
            .trim();

    const sueldo =
        Number(
            document
                .getElementById(
                    "jobSalary"
                )
                .value
        );

    if (!nombre) {

        alert(
            "Escribí el usuario."
        );

        return;
    }

    if (
        sueldo < 0 ||
        Number.isNaN(sueldo)
    ) {

        alert(
            "El sueldo no puede ser negativo."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/empleo",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-token":
                            adminToken
                    },

                    body: JSON.stringify({
                        nombre,
                        trabajo,
                        sueldo
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        actualizarEmpleosAdmin();
        actualizarAuditoria();

        document
            .getElementById(
                "jobUser"
            )
            .value = "";

        document
            .getElementById(
                "jobName"
            )
            .value = "";

        document
            .getElementById(
                "jobSalary"
            )
            .value = "";

        alert(
            "Empleo actualizado 👔"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo actualizar el empleo."
        );
    }
}


// =========================
// AGREGAR DINERO
// =========================

async function agregarDinero() {

    const nombre =
        document
            .getElementById(
                "adminUser"
            )
            .value
            .trim();

    const cantidad =
        Number(
            document
                .getElementById(
                    "adminAmount"
                )
                .value
        );

    if (
        !nombre ||
        !cantidad
    ) {

        alert(
            "Completá el usuario y la cantidad 😭"
        );

        return;
    }

    if (cantidad <= 0) {

        alert(
            "La cantidad debe ser mayor que 0."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/agregar-dinero",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-token":
                            adminToken
                    },

                    body: JSON.stringify({
                        nombre,
                        cantidad
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        await cargarUsuarios();

        actualizarUsuariosAdmin();
        actualizarEstadisticasAdmin();
        actualizarAuditoria();

        limpiarAdminInputs();

        alert(
            "Se agregaron ₲" +
            cantidad +
            " a " +
            nombre +
            " 💰"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo realizar la operación."
        );
    }
}


// =========================
// QUITAR DINERO
// =========================

async function quitarDinero() {

    const nombre =
        document
            .getElementById(
                "adminUser"
            )
            .value
            .trim();

    const cantidad =
        Number(
            document
                .getElementById(
                    "adminAmount"
                )
                .value
        );

    if (
        !nombre ||
        !cantidad
    ) {

        alert(
            "Completá el usuario y la cantidad 😭"
        );

        return;
    }

    if (cantidad <= 0) {

        alert(
            "La cantidad debe ser mayor que 0."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/quitar-dinero",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-token":
                            adminToken
                    },

                    body: JSON.stringify({
                        nombre,
                        cantidad
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        await cargarUsuarios();

        actualizarUsuariosAdmin();
        actualizarEstadisticasAdmin();
        actualizarAuditoria();

        limpiarAdminInputs();

        alert(
            "Se quitaron ₲" +
            cantidad +
            " a " +
            nombre +
            " 💸"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo realizar la operación."
        );
    }
}


// =========================
// ELIMINAR USUARIO
// =========================

async function eliminarUsuario() {

    const nombre =
        document
            .getElementById(
                "deleteUser"
            )
            .value
            .trim();

    if (!nombre) {

        alert(
            "Escribí el nombre del usuario."
        );

        return;
    }

    if (!(nombre in usuarios)) {

        alert(
            "Ese usuario no existe."
        );

        return;
    }

    const confirmar =
        confirm(
            "¿Seguro que querés eliminar a " +
            nombre +
            "?"
        );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/usuarios/" +
                encodeURIComponent(
                    nombre
                ),
                {
                    method: "DELETE",

                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        await cargarUsuarios();

        actualizarUsuariosAdmin();
        actualizarEstadisticasAdmin();
        actualizarAuditoria();

        document
            .getElementById(
                "deleteUser"
            )
            .value = "";

        alert(
            nombre +
            " fue eliminado."
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo eliminar el usuario."
        );
    }
}


// =========================
// ELIMINAR SIN NOMBRE
// =========================

async function eliminarUsuariosSinNombre() {

    if (!("" in usuarios)) {

        alert(
            "No hay cuentas sin nombre."
        );

        return;
    }

    const confirmar =
        confirm(
            "¿Seguro que querés eliminar TODAS las cuentas sin nombre?"
        );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/usuarios-sin-nombre",
                {
                    method: "DELETE",

                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        await cargarUsuarios();

        actualizarUsuariosAdmin();
        actualizarEstadisticasAdmin();
        actualizarAuditoria();

        alert(
            datos.mensaje +
            ". Se eliminaron ₲" +
            datos.dineroEliminado +
            "."
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudieron eliminar las cuentas."
        );
    }
}


// =========================
// LIMPIAR INPUTS
// =========================

function limpiarAdminInputs() {

    document
        .getElementById(
            "adminUser"
        )
        .value = "";

    document
        .getElementById(
            "adminAmount"
        )
        .value = "";
}


// =========================
// CERRAR SESIÓN
// =========================

async function cerrarSesion() {

    if (intervaloCliente) {

        clearInterval(
            intervaloCliente
        );

        intervaloCliente =
            null;
    }

    if (adminToken) {

        try {

            await fetch(
                "/api/admin/logout",
                {
                    method: "POST",

                    headers: {
                        "x-admin-token":
                            adminToken
                    }
                }
            );

        } catch (error) {

            console.error(error);
        }

        adminToken = null;

        localStorage.removeItem(
            "adminToken"
        );
    }

    localStorage.removeItem(
        "usuarioActual"
    );

    document
        .getElementById(
            "admin"
        )
        .style.display = "none";

    document
        .getElementById(
            "bank"
        )
        .style.display = "none";

    document
        .getElementById(
            "login"
        )
        .style.display = "block";

    document
        .getElementById(
            "nameInput"
        )
        .value = "";

    document
        .getElementById(
            "adminPassword"
        )
        .value = "";

    document
        .getElementById(
            "adminPassword"
        )
        .style.display = "none";
}


// =========================
// ESCAPAR HTML
// =========================

function escaparHTML(texto) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(texto);

    return div.innerHTML;
}


// =========================
// DETECTAR ADMIN
// =========================

document
    .getElementById(
        "nameInput"
    )
    .addEventListener(
        "input",
        function() {

            const password =
                document.getElementById(
                    "adminPassword"
                );

            if (
                this.value.trim() ===
                "AdminGrafonia"
            ) {

                password.style.display =
                    "block";

            } else {

                password.style.display =
                    "none";

                password.value =
                    "";
            }
        }
    );


// =========================
// INICIO
// =========================

cargarUsuarios()
    .then(
        async function() {

            const usuarioActual =
                localStorage.getItem(
                    "usuarioActual"
                );

            if (
                usuarioActual ===
                "AdminGrafonia"
            ) {

                if (!adminToken) {

                    localStorage.removeItem(
                        "usuarioActual"
                    );

                    return;
                }

                try {

                    const respuesta =
                        await fetch(
                            "/api/admin/estadisticas",
                            {
                                headers: {
                                    "x-admin-token":
                                        adminToken
                                }
                            }
                        );

                    if (respuesta.ok) {

                        mostrarAdmin();

                    } else {

                        localStorage.removeItem(
                            "usuarioActual"
                        );

                        localStorage.removeItem(
                            "adminToken"
                        );

                        adminToken = null;
                    }

                } catch (error) {

                    console.error(error);
                }

            } else if (
                usuarioActual &&
                usuarioActual in usuarios
            ) {

                mostrarBanco();
            }
        }
    );
