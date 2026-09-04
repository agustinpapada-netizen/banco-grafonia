var usuarios = {};

async function cargarUsuarios() {
    const respuesta = await fetch("/api/usuarios");
    usuarios = await respuesta.json();
}

async function entrar() {
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

    try {
        const respuesta = await fetch("/api/usuarios", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nombre: nombre })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            alert(datos.error);
            return;
        }

        usuarios = datos.usuarios;
        localStorage.setItem("usuarioActual", nombre);
        mostrarBanco();

    } catch (error) {
        alert("No se pudo conectar con Banco Grafonia 😭");
        console.error(error);
    }
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
            "<div><strong>#" + (index + 1) + "</strong> " +
            usuario[0] + " — ₲" + usuario[1] + "</div>";
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

    if (!confirm("¿Seguro que querés eliminar a " + nombre + "?")) {
        return;
    }

    delete usuarios[nombre];

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
            "<p><strong>#" + (index + 1) + "</strong> " +
            usuario[0] + " — ₲" + usuario[1] + "</p>";
    });
}

async function transferir() {
    const remitente = localStorage.getItem("usuarioActual");
    const destinatario = document.getElementById("receiver").value.trim();
    const cantidad = Number(document.getElementById("amount").value);

    if (!destinatario || !cantidad) {
        alert("Completá todos los campos 😭");
        return;
    }

    try {
        const respuesta = await fetch("/api/transferir", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                remitente,
                destinatario,
                cantidad
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            alert(datos.error);
            return;
        }

        usuarios = datos.usuarios;

        document.getElementById("receiver").value = "";
        document.getElementById("amount").value = "";

        actualizarSaldo();
        actualizarRanking();

        alert("Transferiste ₲" + cantidad + " a " + destinatario + " 💸");

    } catch (error) {
        alert("No se pudo conectar con Banco Grafonia 😭");
        console.error(error);
    }
}

cargarUsuarios().then(() => {
    const usuarioActual = localStorage.getItem("usuarioActual");

    if (usuarioActual === "AdminGrafonia") {
        mostrarAdmin();
    } else if (usuarioActual && usuarioActual in usuarios) {
        mostrarBanco();
    }
});
