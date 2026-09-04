let usuarios = {};

function guardarUsuarios() {
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
}

function entrar() {
    const nombre = document.getElementById("nameInput").value.trim();

    if (!nombre) {
        alert("Escribí tu nombre primero 😭");
        return;
    }

    if (nombre === "AdminGrafonia") {
        localStorage.setItem("usuarioActual", nombre);
        mostrarAdmin();
        return;
    }

    if (!(nombre in usuarios)) {
        usuarios[nombre] = 1000;
    }

    guardarUsuarios();
    localStorage.setItem("usuarioActual", nombre);
    mostrarBanco();
}

function mostrarAdmin() {
    document.getElementById("login").style.display = "none";
    document.getElementById("bank").style.display = "none";
    document.getElementById("admin").style.display = "block";

    actualizarRankingAdmin();
    actualizarTotalAdmin();
}

function actualizarRankingAdmin() {
    const ranking = document.getElementById("adminRanking");

    ranking.innerHTML = "";

    const lista = Object.entries(usuarios)
        .sort((a, b) => b[1] - a[1]);

    if (lista.length === 0) {
        ranking.innerHTML = "<p>No hay usuarios todavía.</p>";
        return;
    }

    lista.forEach(function(usuario, index) {
        ranking.innerHTML +=
            "<div>" +
            "<strong>#" + (index + 1) + "</strong> " +
            usuario[0] + " — ₲" + usuario[1] +
            "</div>";
    });
}

function actualizarTotalAdmin() {
    let total = 0;

    Object.values(usuarios).forEach(function(dinero) {
        total += dinero;
    });

    document.getElementById("adminTotal").textContent = total;
}

function agregarDinero() {
    const nombre = document.getElementById("adminUser").value.trim();
    const cantidad = Number(document.getElementById("adminAmount").value);

    if (!nombre || !cantidad) {
        alert("Completá el usuario y la cantidad 😭");
        return;
    }

    if (!(nombre in usuarios)) {
        alert("Ese usuario no existe.");
        return;
    }

    if (cantidad <= 0) {
        alert("La cantidad debe ser mayor que 0.");
        return;
    }

    usuarios[nombre] += cantidad;

    guardarUsuarios();
    limpiarAdminInputs();
    actualizarRankingAdmin();
    actualizarTotalAdmin();

    alert("Se agregaron ₲" + cantidad + " a " + nombre + " 💰");
}

function quitarDinero() {
    const nombre = document.getElementById("adminUser").value.trim();
    const cantidad = Number(document.getElementById("adminAmount").value);

    if (!nombre || !cantidad) {
        alert("Completá el usuario y la cantidad 😭");
        return;
    }

    if (!(nombre in usuarios)) {
        alert("Ese usuario no existe.");
        return;
    }

    if (cantidad <= 0) {
        alert("La cantidad debe ser mayor que 0.");
        return;
    }

    if (usuarios[nombre] < cantidad) {
        alert("Ese usuario no tiene suficiente dinero.");
        return;
    }

    usuarios[nombre] -= cantidad;

    guardarUsuarios();
    limpiarAdminInputs();
    actualizarRankingAdmin();
    actualizarTotalAdmin();

    alert("Se quitaron ₲" + cantidad + " a " + nombre + " 💸");
}

function eliminarUsuario() {
    const nombre = document.getElementById("deleteUser").value.trim();

    if (!nombre) {
        alert("Escribí el nombre del usuario.");
        return;
    }

    if (!(nombre in usuarios)) {
        alert("Ese usuario no existe.");
        return;
    }

    const confirmar = confirm(
        "¿Seguro que querés eliminar a " + nombre + "?"
    );

    if (!confirmar) {
        return;
    }

    delete usuarios[nombre];

    guardarUsuarios();

    document.getElementById("deleteUser").value = "";

    actualizarRankingAdmin();
    actualizarTotalAdmin();

    alert(nombre + " fue eliminado.");
}

function limpiarAdminInputs() {
    document.getElementById("adminUser").value = "";
    document.getElementById("adminAmount").value = "";
}

function cerrarSesion() {
    localStorage.removeItem("usuarioActual");

    document.getElementById("admin").style.display = "none";
    document.getElementById("bank").style.display = "none";
    document.getElementById("login").style.display = "block";

    document.getElementById("nameInput").value = "";
}

function mostrarBanco() {
    const nombre = localStorage.getItem("usuarioActual");

    document.getElementById("login").style.display = "none";
    document.getElementById("admin").style.display = "none";
    document.getElementById("bank").style.display = "block";

    document.getElementById("userName").textContent = nombre;

    actualizarSaldo();
    actualizarRanking();
}

function actualizarSaldo() {
    const nombre = localStorage.getItem("usuarioActual");

    document.getElementById("balance").textContent = usuarios[nombre];
}

function actualizarRanking() {
    const ranking = document.getElementById("ranking");

    const lista = Object.entries(usuarios)
        .sort((a, b) => b[1] - a[1]);

    ranking.innerHTML = "";

    lista.forEach(function(usuario, index) {
        ranking.innerHTML +=
            "<p>" +
            "<strong>#" + (index + 1) + "</strong> " +
            usuario[0] + " — ₲" + usuario[1] +
            "</p>";
    });
}

function transferir() {
    const remitente = localStorage.getItem("usuarioActual");
    const destinatario = document.getElementById("receiver").value.trim();
    const cantidad = Number(document.getElementById("amount").value);

    if (!destinatario || !cantidad) {
        alert("Completá todos los campos 😭");
        return;
    }

    if (!(destinatario in usuarios)) {
        alert("Ese usuario no existe.");
        return;
    }

    if (destinatario === remitente) {
        alert("No podés transferirte dinero a vos mismo.");
        return;
    }

    if (cantidad <= 0) {
        alert("La cantidad debe ser mayor que 0.");
        return;
    }

    if (usuarios[remitente] < cantidad) {
        alert("No tenés suficiente dinero 💀");
        return;
    }

    usuarios[remitente] -= cantidad;
    usuarios[destinatario] += cantidad;

    guardarUsuarios();

    document.getElementById("receiver").value = "";
    document.getElementById("amount").value = "";

    actualizarSaldo();
    actualizarRanking();

    alert(
        "Transferiste ₲" +
        cantidad +
        " a " +
        destinatario +
        " 💸"
    );
}

const datosGuardados = localStorage.getItem("usuarios");

if (datosGuardados) {
    usuarios = JSON.parse(datosGuardados);
}

const usuarioActual = localStorage.getItem("usuarioActual");

if (usuarioActual === "AdminGrafonia") {
    mostrarAdmin();
} else if (usuarioActual && usuarioActual in usuarios) {
    mostrarBanco();
}
