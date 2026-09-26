let usuarios = {};
let adminToken = localStorage.getItem("adminToken");

// =========================
// CARGAR USUARIOS
// =========================

async function cargarUsuarios() {

    try {

        const respuesta = await fetch("/api/usuarios");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los usuarios");
        }

        usuarios = await respuesta.json();

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

    if (nombre === "AdminGrafonia") {

        const passwordInput =
            document.getElementById("adminPassword");

        const password =
            passwordInput.value;

        if (!password) {

            passwordInput.style.display = "block";

            alert(
                "Escribí la contraseña de administrador."
            );

            return;
        }

        try {

            const respuesta =
                await fetch("/api/admin/login", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        password: password
                    })
                });

            const datos =
                await respuesta.json();

            if (!respuesta.ok) {

                alert(datos.error);

                return;
            }

            adminToken = datos.token;

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
            await fetch("/api/usuarios", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    nombre: nombre
                })
            });

        const datos =
            await respuesta.json();

        if (!respuesta.ok) {

            alert(datos.error);

            return;
        }

        usuarios = datos.usuarios;

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

    actualizarSaldo();
    actualizarRanking();
    actualizarHistorial();
}


// =========================
// SALDO
// =========================

function actualizarSaldo() {

    const nombre =
        localStorage.getItem(
            "usuarioActual"
        );

    if (usuarios[nombre] !== undefined) {

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

    ranking.innerHTML = "";

    const lista =
        Object.entries(usuarios)
            .sort((a, b) => b[1] - a[1]);

    if (lista.length === 0) {

        ranking.innerHTML =
            "<p>No hay usuarios todavía.</p>";

        return;
    }

    lista.forEach(function(usuario, index) {

        ranking.innerHTML +=
            "<p>" +
            "<strong>#" +
            (index + 1) +
            "</strong> " +
            usuario[0] +
            " — ₲" +
            usuario[1] +
            "</p>";
    });
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
                encodeURIComponent(usuarioActual)
            );

        const transferencias =
            await respuesta.json();

        historial.innerHTML = "";

        if (
            !Array.isArray(transferencias) ||
            transferencias.length === 0
        ) {

            historial.innerHTML =
                "<p>No hay transferencias todavía.</p>";

            return;
        }

        transferencias.forEach(function(t) {

            if (
                t.remitente ===
                usuarioActual
            ) {

                historial.innerHTML +=
                    "<div class='movimiento'>" +
                    "💸 Enviaste ₲" +
                    t.cantidad +
                    " a <strong>" +
                    escaparHTML(t.destinatario) +
                    "</strong>" +
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
                    escaparHTML(t.remitente) +
                    "</strong>" +
                    "<small>" +
                    t.fecha +
                    "</small>" +
                    "</div>";
            }
        });

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

    if (!destinatario || !cantidad) {

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

    if (destinatario === remitente) {

        alert(
            "No podés transferirte dinero a vos mismo 😭"
        );

        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/transferir",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        remitente,
                        destinatario,
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

        usuarios =
            datos.usuarios;

        document
            .getElementById("receiver")
            .value = "";

        document
            .getElementById("amount")
            .value = "";

        actualizarSaldo();
        actualizarRanking();
        actualizarHistorial();

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
// MOSTRAR ADMIN
// =========================

function mostrarAdmin() {

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
}


// =========================
// RANKING ADMIN
// =========================

function actualizarUsuariosAdmin() {

    const ranking =
        document.getElementById(
            "adminRanking"
        );

    ranking.innerHTML = "";

    const lista =
        Object.entries(usuarios)
            .sort((a, b) => b[1] - a[1]);

    if (lista.length === 0) {

        ranking.innerHTML =
            "<p>No hay usuarios todavía.</p>";

        return;
    }

    lista.forEach(function(usuario, index) {

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
    });
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
            .getElementById("adminTotal")
            .textContent =
            datos.dineroEnCirculacion;

        document
            .getElementById("adminUsers")
            .textContent =
            datos.usuarios;

        document
            .getElementById("adminTransfers")
            .textContent =
            datos.transferencias;

        document
            .getElementById("adminTransferred")
            .textContent =
            datos.dineroTransferido;

    } catch (error) {

        console.error(error);
    }
}


// =========================
// HISTORIAL GLOBAL ADMIN
// =========================

async function actualizarHistorialAdmin() {

    const historial =
        document.getElementById(
            "adminHistorial"
        );

    if (!historial || !adminToken) {
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

        if (transferencias.length === 0) {

            historial.innerHTML =
                "<p>No hay transferencias todavía.</p>";

            return;
        }

        transferencias.forEach(function(t) {

            historial.innerHTML +=
                "<div class='movimiento'>" +
                "💸 <strong>" +
                escaparHTML(t.remitente) +
                "</strong> → <strong>" +
                escaparHTML(t.destinatario) +
                "</strong>" +
                ": ₲" +
                t.cantidad +
                "<small>" +
                t.fecha +
                "</small>" +
                "</div>";
        });

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

    if (!contenedor || !adminToken) {
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

        if (registros.length === 0) {

            contenedor.innerHTML =
                "<p>No hay registros todavía.</p>";

            return;
        }

        registros.forEach(function(r) {

            let icono = "📋";

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
                escaparHTML(r.tipo) +
                "</strong>" +
                "<br>" +
                "Usuario: " +
                escaparHTML(
                    r.usuario || "-"
                ) +
                "<br>" +
                escaparHTML(
                    r.detalle || ""
                ) +
                "<small>" +
                r.fecha +
                "</small>" +
                "</div>";
        });

    } catch (error) {

        console.error(error);
    }
}


// =========================
// AGREGAR DINERO
// =========================

async function agregarDinero() {

    const nombre =
        document
            .getElementById("adminUser")
            .value
            .trim();

    const cantidad =
        Number(
            document
                .getElementById("adminAmount")
                .value
        );

    if (!nombre || !cantidad) {

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
            .getElementById("adminUser")
            .value
            .trim();

    const cantidad =
        Number(
            document
                .getElementById("adminAmount")
                .value
        );

    if (!nombre || !cantidad) {

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
            .getElementById("deleteUser")
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
                encodeURIComponent(nombre),
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
            .getElementById("deleteUser")
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
// ELIMINAR CUENTAS SIN NOMBRE
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
        .getElementById("adminUser")
        .value = "";

    document
        .getElementById("adminAmount")
        .value = "";
}


// =========================
// CERRAR SESIÓN
// =========================

async function cerrarSesion() {

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
        .getElementById("admin")
        .style.display = "none";

    document
        .getElementById("bank")
        .style.display = "none";

    document
        .getElementById("login")
        .style.display = "block";

    document
        .getElementById("nameInput")
        .value = "";

    document
        .getElementById("adminPassword")
        .value = "";

    document
        .getElementById("adminPassword")
        .style.display = "none";
}


// =========================
// ESCAPAR TEXTO
// =========================

function escaparHTML(texto) {

    const div =
        document.createElement("div");

    div.textContent =
        String(texto);

    return div.innerHTML;
}


// =========================
// DETECTAR ADMIN
// =========================

document
    .getElementById("nameInput")
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

                password.value = "";
            }
        }
    );


// =========================
// INICIO
// =========================

cargarUsuarios().then(async function() {

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
});
