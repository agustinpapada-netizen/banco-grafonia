let usuarios = {};
let adminToken =
    localStorage.getItem("adminToken");

let intervaloCliente = null;
let intervaloTinCoin = null;


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

                alert(
                    datos.error
                );

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

            alert(
                datos.error
            );

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

        clearInterval(
            intervaloCliente
        );
    }

    intervaloCliente =
        setInterval(
            actualizarCliente,
            30000
        );

    if (intervaloTinCoin) {

        clearInterval(
            intervaloTinCoin
        );
    }

    intervaloTinCoin =
        setInterval(
            actualizarTinCoin,
            1000
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
    actualizarTinCoin();
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

    if (
        lista.length === 0
    ) {

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
                escaparHTML(
                    usuario[0]
                ) +
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
                encodeURIComponent(
                    nombre
                )
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
            .getElementById(
                "profileName"
            )
            .textContent =
            cuenta.nombre;

        document
            .getElementById(
                "profileJob"
            )
            .textContent =
            cuenta.trabajo;

        document
            .getElementById(
                "profileSalary"
            )
            .textContent =
            "₲" +
            cuenta.sueldo;

        document
            .getElementById(
                "profileSavings"
            )
            .textContent =
            "₲" +
            cuenta.ahorro;

        document
            .getElementById(
                "sentMonth"
            )
            .textContent =
            "₲" +
            resumen.dineroEnviado;

        document
            .getElementById(
                "receivedMonth"
            )
            .textContent =
            "₲" +
            resumen.dineroRecibido;

        document
            .getElementById(
                "sentOperations"
            )
            .textContent =
            resumen.enviados;

        document
            .getElementById(
                "receivedOperations"
            )
            .textContent =
            resumen.recibidos;

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
                encodeURIComponent(
                    usuario
                )
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

    if (
        cantidad <= 0
    ) {

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

            alert(
                datos.error
            );

            return;
        }

        usuarios =
            datos.usuarios;

        document
            .getElementById(
                "receiver"
            )
            .value = "";

        document
            .getElementById(
                "amount"
            )
            .value = "";

        document
            .getElementById(
                "concept"
            )
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

async function moverAhorro(
    tipo
) {

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

            alert(
                datos.error
            );

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

    if (
        cantidad <= 0
    ) {

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

            alert(
                datos.error
            );

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


async function aceptarSolicitud(
    id
) {

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

            alert(
                datos.error
            );

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


async function rechazarSolicitud(
    id
) {

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

            alert(
                datos.error
            );

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


// ======================================================
// TINCOINS — USUARIO
// ======================================================

let ultimoHistorialTinCoin = [];


async function actualizarTinCoin() {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    if (
        !usuario ||
        usuario ===
        "AdminGrafonia"
    ) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/tincoins?usuario=" +
                encodeURIComponent(
                    usuario
                )
            );

        if (!respuesta.ok) {
            return;
        }

        const datos =
            await respuesta.json();

        const precio =
            Number(
                datos.precio
            );

        const porcentaje =
            Number(
                datos.porcentaje
            );

        const precioElemento =
            document.getElementById(
                "tincoinPrice"
            );

        const porcentajeElemento =
            document.getElementById(
                "tincoinPercent"
            );

        const cantidadElemento =
            document.getElementById(
                "tincoinAmount"
            );

        const valorElemento =
            document.getElementById(
                "tincoinValue"
            );

        const capitalElemento =
            document.getElementById(
                "tincoinCapital"
            );

        const gananciaElemento =
            document.getElementById(
                "tincoinProfit"
            );

        const proximaElemento =
            document.getElementById(
                "tincoinNext"
            );

        if (precioElemento) {

            precioElemento.textContent =
                "₲" +
                precio.toFixed(4);
        }

        if (porcentajeElemento) {

            porcentajeElemento.textContent =
                (
                    porcentaje >= 0
                        ? "+"
                        : ""
                ) +
                porcentaje.toFixed(2) +
                "%";

            porcentajeElemento.className =
                porcentaje >= 0
                    ? "tincoin-up"
                    : "tincoin-down";
        }

        if (cantidadElemento) {

            cantidadElemento.textContent =
                Number(
                    datos.posicion.tincoins
                ).toFixed(8);
        }

        if (valorElemento) {

            valorElemento.textContent =
                "₲" +
                Number(
                    datos.posicion.valor
                ).toFixed(2);
        }

        if (capitalElemento) {

            capitalElemento.textContent =
                "₲" +
                Number(
                    datos.posicion.capital
                ).toFixed(2);
        }

        if (gananciaElemento) {

            const ganancia =
                Number(
                    datos.posicion.ganancia
                );

            gananciaElemento.textContent =
                (
                    ganancia >= 0
                        ? "+"
                        : ""
                ) +
                "₲" +
                ganancia.toFixed(2);

            gananciaElemento.className =
                ganancia >= 0
                    ? "tincoin-up"
                    : "tincoin-down";
        }

        if (proximaElemento) {

            actualizarContadorTinCoin(
                datos.proximaActualizacion
            );
        }

        ultimoHistorialTinCoin =
            datos.historial || [];

        dibujarGraficoTinCoin(
            ultimoHistorialTinCoin
        );

    } catch (error) {

        console.error(
            "Error TinCoin:",
            error
        );
    }
}


// =========================
// CONTADOR
// =========================

function actualizarContadorTinCoin(
    fecha
) {

    const elemento =
        document.getElementById(
            "tincoinNext"
        );

    if (!elemento) {
        return;
    }

    if (!fecha) {

        elemento.textContent =
            "Calculando...";

        return;
    }

    const diferencia =
        new Date(fecha).getTime() -
        Date.now();

    if (
        diferencia <= 0
    ) {

        elemento.textContent =
            "Actualizando...";

        return;
    }

    const horas =
        Math.floor(
            diferencia /
            3600000
        );

    const minutos =
        Math.floor(
            (
                diferencia %
                3600000
            ) /
            60000
        );

    const segundos =
        Math.floor(
            (
                diferencia %
                60000
            ) /
            1000
        );

    elemento.textContent =
        horas + "h " +
        String(
            minutos
        ).padStart(2, "0") +
        "m " +
        String(
            segundos
        ).padStart(2, "0") +
        "s";
}


// =========================
// GRÁFICO
// =========================

function dibujarGraficoTinCoin(
    historial
) {

    const canvas =
        document.getElementById(
            "tincoinChart"
        );

    if (
        !canvas ||
        !historial ||
        historial.length === 0
    ) {
        return;
    }

    const ctx =
        canvas.getContext(
            "2d"
        );

    const ancho =
        canvas.width =
            canvas.clientWidth *
            window.devicePixelRatio;

    const alto =
        canvas.height =
            280 *
            window.devicePixelRatio;

    ctx.clearRect(
        0,
        0,
        ancho,
        alto
    );

    const padding =
        35 *
        window.devicePixelRatio;

    const precios =
        historial.map(
            function(h) {
                return Number(
                    h.precio
                );
            }
        );

    const minimo =
        Math.min(
            ...precios
        );

    const maximo =
        Math.max(
            ...precios
        );

    const rango =
        maximo === minimo
            ? 1
            : maximo - minimo;

    const anchoGrafico =
        ancho -
        padding * 2;

    const altoGrafico =
        alto -
        padding * 2;

    // Fondo de gráfico
    ctx.fillStyle =
        "rgba(0,0,0,0.12)";

    ctx.fillRect(
        0,
        0,
        ancho,
        alto
    );

    // Líneas
    ctx.strokeStyle =
        "rgba(255,255,255,0.08)";

    ctx.lineWidth =
        1 *
        window.devicePixelRatio;

    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const y =
            padding +
            (
                altoGrafico *
                i /
                4
            );

        ctx.beginPath();

        ctx.moveTo(
            padding,
            y
        );

        ctx.lineTo(
            ancho - padding,
            y
        );

        ctx.stroke();
    }

    // Línea principal
    ctx.beginPath();

    precios.forEach(
        function(precio, index) {

            const x =
                precios.length === 1
                    ? ancho / 2
                    : padding +
                      (
                        anchoGrafico *
                        index /
                        (
                            precios.length -
                            1
                        )
                      );

            const y =
                padding +
                altoGrafico -
                (
                    (
                        precio -
                        minimo
                    ) /
                    rango
                ) *
                altoGrafico;

            if (index === 0) {

                ctx.moveTo(
                    x,
                    y
                );

            } else {

                ctx.lineTo(
                    x,
                    y
                );
            }
        }
    );

    ctx.strokeStyle =
        "#24d17e";

    ctx.lineWidth =
        3 *
        window.devicePixelRatio;

    ctx.stroke();

    // Puntos
    precios.forEach(
        function(precio, index) {

            const x =
                precios.length === 1
                    ? ancho / 2
                    : padding +
                      (
                        anchoGrafico *
                        index /
                        (
                            precios.length -
                            1
                        )
                      );

            const y =
                padding +
                altoGrafico -
                (
                    (
                        precio -
                        minimo
                    ) /
                    rango
                ) *
                altoGrafico;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                4 *
                window.devicePixelRatio,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "#24d17e";

            ctx.fill();
        }
    );

    // Precio mínimo y máximo
    ctx.fillStyle =
        "rgba(255,255,255,0.65)";

    ctx.font =
        (
            12 *
            window.devicePixelRatio
        ) +
        "px Arial";

    ctx.fillText(
        "Máx ₲" +
        maximo.toFixed(4),
        padding,
        18 *
        window.devicePixelRatio
    );

    ctx.fillText(
        "Mín ₲" +
        minimo.toFixed(4),
        padding,
        alto -
        8 *
        window.devicePixelRatio
    );
}


// =========================
// INVERTIR
// =========================

async function invertirTinCoin() {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    const cantidad =
        Number(
            document
                .getElementById(
                    "tincoinInvestment"
                )
                .value
        );

    if (
        !Number.isInteger(
            cantidad
        ) ||
        cantidad <= 0
    ) {

        alert(
            "La cantidad debe ser un número entero mayor que 0."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/tincoins/invertir",
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

            alert(
                datos.error
            );

            return;
        }

        document
            .getElementById(
                "tincoinInvestment"
            )
            .value = "";

        await actualizarCliente();

        alert(
            "Invertiste ₲" +
            cantidad +
            " en TinCoin 🪙"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo realizar la inversión."
        );
    }
}


// =========================
// RETIRAR
// =========================

async function retirarTinCoin() {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    const input =
        document.getElementById(
            "tincoinWithdrawal"
        );

    let cantidad =
        Number(
            input.value
        );

    if (
        !Number.isFinite(
            cantidad
        ) ||
        cantidad <= 0
    ) {

        alert(
            "Escribí una cantidad válida de TinCoins."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/tincoins/retirar",
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

            alert(
                datos.error
            );

            return;
        }

        input.value = "";

        await actualizarCliente();

        alert(
            "Retiraste tu inversión y recibiste ₲" +
            Number(
                datos.dinero
            ).toFixed(2) +
            " 💸"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo retirar la inversión."
        );
    }
}


// =========================
// RETIRAR TODO
// =========================

async function retirarTodoTinCoin() {

    const usuario =
        localStorage.getItem(
            "usuarioActual"
        );

    try {

        const respuesta =
            await fetch(
                "/api/tincoins?usuario=" +
                encodeURIComponent(
                    usuario
                )
            );

        const datos =
            await respuesta.json();

        const cantidad =
            Number(
                datos.posicion.tincoins
            );

        if (
            cantidad <= 0
        ) {

            alert(
                "No tenés TinCoins para retirar."
            );

            return;
        }

        const confirmar =
            confirm(
                "¿Querés retirar todos tus TinCoins?\n\n" +
                "Valor actual: ₲" +
                Number(
                    datos.posicion.valor
                ).toFixed(2)
            );

        if (!confirmar) {
            return;
        }

        const respuestaRetiro =
            await fetch(
                "/api/tincoins/retirar",
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

        const resultado =
            await respuestaRetiro.json();

        if (
            !respuestaRetiro.ok
        ) {

            alert(
                resultado.error
            );

            return;
        }

        await actualizarCliente();

        alert(
            "Retiraste toda tu inversión 💸\n\n" +
            "Recibiste ₲" +
            Number(
                resultado.dinero
            ).toFixed(2) +
            "\nResultado: " +
            (
                Number(
                    resultado.ganancia
                ) >= 0
                    ? "+"
                    : ""
            ) +
            "₲" +
            Number(
                resultado.ganancia
            ).toFixed(2)
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo retirar la inversión."
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

    if (intervaloTinCoin) {

        clearInterval(
            intervaloTinCoin
        );

        intervaloTinCoin =
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
    actualizarTinCoinAdmin();
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

    if (
        lista.length === 0
    ) {

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
                escaparHTML(
                    nombre
                ) +
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

                if (
                    r.tipo ===
                    "TINCOIN_CAMBIO_AUTOMATICO"
                ) {
                    icono = "🎲";
                }

                if (
                    r.tipo ===
                    "TINCOIN_CAMBIO_ADMIN"
                ) {
                    icono = "🛠️";
                }

                if (
                    r.tipo ===
                    "TINCOIN_INVERSION"
                ) {
                    icono = "🪙";
                }

                if (
                    r.tipo ===
                    "TINCOIN_RETIRO"
                ) {
                    icono = "💸";
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

                    "Actor: " +
                    escaparHTML(
                        r.actor ||
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


// ======================================================
// TINCOINS — ADMIN
// ======================================================

async function actualizarTinCoinAdmin() {

    if (!adminToken) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/tincoins",
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

        const precio =
            document.getElementById(
                "adminTincoinPrice"
            );

        const inversores =
            document.getElementById(
                "adminTincoinInvestors"
            );

        const capital =
            document.getElementById(
                "adminTincoinCapital"
            );

        const valor =
            document.getElementById(
                "adminTincoinValue"
            );

        const ganancia =
            document.getElementById(
                "adminTincoinProfit"
            );

        if (precio) {

            precio.textContent =
                "₲" +
                Number(
                    datos.precio
                ).toFixed(4);
        }

        if (inversores) {

            inversores.textContent =
                datos.inversores;
        }

        if (capital) {

            capital.textContent =
                "₲" +
                Number(
                    datos.capital
                ).toFixed(2);
        }

        if (valor) {

            valor.textContent =
                "₲" +
                Number(
                    datos.valorActual
                ).toFixed(2);
        }

        if (ganancia) {

            const numero =
                Number(
                    datos.gananciaGlobal
                );

            ganancia.textContent =
                (
                    numero >= 0
                        ? "+"
                        : ""
                ) +
                "₲" +
                numero.toFixed(2);

            ganancia.className =
                numero >= 0
                    ? "tincoin-up"
                    : "tincoin-down";
        }

        actualizarContadorTinCoinAdmin(
            datos.proximaActualizacion
        );

        await actualizarHistorialTinCoinAdmin();
        await actualizarOperacionesTinCoinAdmin();

    } catch (error) {

        console.error(error);
    }
}


function actualizarContadorTinCoinAdmin(
    fecha
) {

    const elemento =
        document.getElementById(
            "adminTincoinNext"
        );

    if (!elemento) {
        return;
    }

    const diferencia =
        new Date(fecha).getTime() -
        Date.now();

    if (
        diferencia <= 0
    ) {

        elemento.textContent =
            "Actualizando...";

        return;
    }

    const horas =
        Math.floor(
            diferencia /
            3600000
        );

    const minutos =
        Math.floor(
            (
                diferencia %
                3600000
            ) /
            60000
        );

    const segundos =
        Math.floor(
            (
                diferencia %
                60000
            ) /
            1000
        );

    elemento.textContent =
        horas + "h " +
        String(
            minutos
        ).padStart(2, "0") +
        "m " +
        String(
            segundos
        ).padStart(2, "0") +
        "s";
}


async function cambiarPrecioTinCoin() {

    const input =
        document.getElementById(
            "adminTincoinNewPrice"
        );

    const precio =
        Number(
            input.value
        );

    if (
        !Number.isFinite(precio) ||
        precio <= 0
    ) {

        alert(
            "Escribí un precio válido."
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/admin/tincoins/precio",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-token":
                            adminToken
                    },

                    body: JSON.stringify({
                        precio
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(
                datos.error
            );

            return;
        }

        input.value = "";

        await actualizarTinCoinAdmin();

        alert(
            "Precio TinCoin cambiado a ₲" +
            Number(
                datos.precio
            ).toFixed(4) +
            " 🪙"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo cambiar el precio."
        );
    }
}


async function cambiarPorcentajeTinCoin(
    porcentaje
) {

    try {

        const respuesta =
            await fetch(
                "/api/admin/tincoins/porcentaje",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-token":
                            adminToken
                    },

                    body: JSON.stringify({
                        porcentaje
                    })
                }
            );

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(
                datos.error
            );

            return;
        }

        await actualizarTinCoinAdmin();

        alert(
            "TinCoin cambió " +
            (
                Number(
                    datos.porcentaje
                ) >= 0
                    ? "+"
                    : ""
            ) +
            Number(
                datos.porcentaje
            ).toFixed(2) +
            "% 🪙"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo modificar TinCoin."
        );
    }
}


async function aplicarPorcentajeTinCoin() {

    const input =
        document.getElementById(
            "adminTincoinPercent"
        );

    const porcentaje =
        Number(
            input.value
        );

    if (
        !Number.isFinite(
            porcentaje
        ) ||
        porcentaje === 0
    ) {

        alert(
            "Escribí un porcentaje distinto de 0."
        );

        return;
    }

    await cambiarPorcentajeTinCoin(
        porcentaje
    );

    input.value = "";
}


async function actualizarHistorialTinCoinAdmin() {

    const contenedor =
        document.getElementById(
            "adminTincoinHistory"
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
                "/api/admin/tincoins/historial",
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
                "<p>No hay cambios todavía.</p>";

            return;
        }

        registros.forEach(
            function(r) {

                const porcentaje =
                    Number(
                        r.porcentaje
                    );

                contenedor.innerHTML +=
                    "<div class='movimiento'>" +

                    (
                        r.tipo ===
                        "AUTOMATICO"
                            ? "🎲"
                            : r.tipo ===
                              "ADMIN"
                                ? "🛠️"
                                : "🪙"
                    ) +

                    " <strong>₲" +
                    Number(
                        r.precio
                    ).toFixed(4) +
                    "</strong>" +

                    " — " +

                    "<span class='" +
                    (
                        porcentaje >= 0
                            ? "tincoin-up"
                            : "tincoin-down"
                    ) +
                    "'>" +

                    (
                        porcentaje >= 0
                            ? "+"
                            : ""
                    ) +

                    porcentaje.toFixed(2) +
                    "%</span>" +

                    "<br>Tipo: " +
                    escaparHTML(
                        r.tipo
                    ) +

                    "<br>Actor: " +
                    escaparHTML(
                        r.actor ||
                        "-"
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


async function actualizarOperacionesTinCoinAdmin() {

    const contenedor =
        document.getElementById(
            "adminTincoinOperations"
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
                "/api/admin/tincoins/operaciones",
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

        const operaciones =
            await respuesta.json();

        contenedor.innerHTML = "";

        if (
            operaciones.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No hay operaciones todavía.</p>";

            return;
        }

        operaciones.forEach(
            function(o) {

                const ganancia =
                    Number(
                        o.ganancia || 0
                    );

                contenedor.innerHTML +=
                    "<div class='movimiento'>" +

                    (
                        o.tipo ===
                        "INVERSION"
                            ? "📥"
                            : "📤"
                    ) +

                    " <strong>" +
                    escaparHTML(
                        o.usuario
                    ) +
                    "</strong>" +

                    " — " +
                    escaparHTML(
                        o.tipo
                    ) +

                    "<br>" +

                    "Dinero: ₲" +
                    Number(
                        o.dinero
                    ).toFixed(2) +

                    "<br>" +

                    "TinCoins: " +
                    Number(
                        o.tincoins
                    ).toFixed(8) +

                    "<br>" +

                    "Precio: ₲" +
                    Number(
                        o.precio
                    ).toFixed(4) +

                    (
                        o.tipo ===
                        "RETIRO"
                            ? "<br>Resultado: <span class='" +
                              (
                                  ganancia >= 0
                                      ? "tincoin-up"
                                      : "tincoin-down"
                              ) +
                              "'>" +
                              (
                                  ganancia >= 0
                                      ? "+"
                                      : ""
                              ) +
                              "₲" +
                              ganancia.toFixed(2) +
                              "</span>"
                            : ""
                    ) +

                    "<small>" +
                    o.fecha +
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

            alert(
                datos.error
            );

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

    if (
        cantidad <= 0
    ) {

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

            alert(
                datos.error
            );

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

    if (
        cantidad <= 0
    ) {

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

            alert(
                datos.error
            );

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

    if (
        !(nombre in usuarios)
    ) {

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

            alert(
                datos.error
            );

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

    if (
        !("" in usuarios)
    ) {

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

            alert(
                datos.error
            );

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
// LIMPIAR INPUTS ADMIN
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

    if (intervaloTinCoin) {

        clearInterval(
            intervaloTinCoin
        );

        intervaloTinCoin =
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

        adminToken =
            null;

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

                    if (
                        respuesta.ok
                    ) {

                        mostrarAdmin();

                    } else {

                        localStorage.removeItem(
                            "usuarioActual"
                        );

                        localStorage.removeItem(
                            "adminToken"
                        );

                        adminToken =
                            null;
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
