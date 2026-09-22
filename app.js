// URL DE TU WEB APP DE GOOGLE APPS SCRIPT
const URL_API_GOOGLESHEETS = "https://script.google.com/macros/s/AKfycbw8X1UsQXLOpdmC2k5SaHjQGRRwzL8I-OViSVJ9IDuGjtqoOf_3t-b_6wNnDJkMt3d1/exec";

// CONFIGURACIÓN DE CREDENCIALES
const CREDENCIALES = {
    passValida: "shougang2026"
};

let payloadPreparado = null;

// Ciclo operativo cada 2 horas (12 intervalos continuos en 24 horas)
const cicloOperativo = [
    { hora: "07:00", turno: "DIA" },
    { hora: "09:00", turno: "DIA" },
    { hora: "11:00", turno: "DIA" },
    { hora: "13:00", turno: "DIA" },
    { hora: "15:00", turno: "DIA" },
    { hora: "17:00", turno: "DIA" },
    { hora: "19:00", turno: "NOCHE" },
    { hora: "21:00", turno: "NOCHE" },
    { hora: "23:00", turno: "NOCHE" },
    { hora: "01:00", turno: "NOCHE" },
    { hora: "03:00", turno: "NOCHE" },
    { hora: "05:00", turno: "NOCHE" }
];

let contadorTolva = 0;

// Verificar estado de sesión al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('colector_usuario');
    
    if (usuarioGuardado) {
        iniciarSesionCorrecta(usuarioGuardado);
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
    }
    
    renderizarTabla24Horas();
    agregarFilaTolva();
    agregarFilaTolva();
});

// Manejo del formulario de Login
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const usuario = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const errorMsg = document.getElementById('errorMsg');

    if (pass === CREDENCIALES.passValida) {
        errorMsg.style.display = 'none';
        localStorage.setItem('colector_usuario', usuario);
        iniciarSesionCorrecta(usuario);
    } else {
        errorMsg.style.display = 'block';
    }
});

function iniciarSesionCorrecta(usuario) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    document.getElementById('userDisplay').innerText = usuario;
    
    const inputInspector = document.getElementById('inspector');
    if (inputInspector) {
        inputInspector.value = usuario;
    }
}

function cerrarSesion() {
    localStorage.removeItem('colector_usuario');
    location.reload();
}

// Renderizar filas de la Sección 4 alineadas a los nuevos encabezados
function renderizarTabla24Horas() {
    const tbody = document.getElementById("tablaHorasBody");
    tbody.innerHTML = "";

    cicloOperativo.forEach((item, index) => {
        const row = document.createElement("tr");
        const badgeClass = item.turno === "DIA" ? "bg-dia" : "bg-noche";
        
        row.innerHTML = `
            <td><strong>${item.hora}</strong></td>
            <td><span class="badge-turno ${badgeClass}">${item.turno}</span></td>
            
            <!-- Presión del Sistema (5 columnas) -->
            <td><input type="number" step="0.1" name="pres_ingreso_${index}" placeholder="Ej: 85"></td>
            <td><input type="number" step="0.1" name="pres_salida_${index}" placeholder="Ej: 75"></td>
            <td><input type="number" step="0.1" name="pres_dif_${index}" placeholder="Ej: 10"></td>
            <td><input type="number" step="1" name="pres_aire_${index}" placeholder="Ej: 80"></td>
            <td><input type="number" step="0.01" name="pres_lub_${index}" placeholder="Ej: 0.20"></td>
            
            <!-- Temperatura Chumacera : Motor (4 columnas) -->
            <td><input type="number" step="1" name="temp_chum_libre_${index}" placeholder="Ej: 40"></td>
            <td><input type="number" step="1" name="temp_chum_mot_${index}" placeholder="Ej: 42"></td>
            <td><input type="number" step="1" name="temp_mot_vent_${index}" placeholder="Ej: 48"></td>
            <td><input type="number" step="1" name="temp_mot_acop_${index}" placeholder="Ej: 45"></td>
            
            <!-- Vibraciones (mm/s) (2 columnas) -->
            <td><input type="number" step="0.1" name="vib_libre_${index}" placeholder="Ej: 1.1"></td>
            <td><input type="number" step="0.1" name="vib_mot_${index}" placeholder="Ej: 1.2"></td>
            
            <!-- Compuerta (1 columna) -->
            <td><input type="number" step="0.1" name="comp_${index}" placeholder="Ej: 60"></td>
        `;
        tbody.appendChild(row);
    });
}

function agregarFilaTolva() {
    contadorTolva++;
    const tbody = document.getElementById("tablaTolvasBody");
    const row = document.createElement("tr");
    
    row.innerHTML = `
        <td>${contadorTolva}</td>
        <td>
            <select name="tolva_turno_${contadorTolva}">
                <option value="DÍA">DÍA</option>
                <option value="NOCHE">NOCHE</option>
            </select>
        </td>
        <td><input type="text" name="tolva_horario_${contadorTolva}" placeholder="Ej: 11:20-12:10"></td>
        <td><input type="number" step="0.01" name="tolva_duracion_${contadorTolva}" placeholder="Ej: 0.83"></td>
        <td><input type="text" name="tolva_frente_${contadorTolva}" placeholder="Ej: 001-002"></td>
        <td><input type="number" step="0.1" name="tolva_tn_${contadorTolva}" placeholder="Ej: 2.0"></td>
    `;
    tbody.appendChild(row);
}

function procesarFotos(input) {
    const contenedor = document.getElementById("contenedorFotos");
    contenedor.innerHTML = "";

    if (input.files) {
        Array.from(input.files).forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const item = document.createElement("div");
                item.className = "photo-item";
                item.innerHTML = `
                    <img src="${e.target.result}" alt="Evidencia ${idx + 1}">
                    <div style="flex-grow: 1;">
                        <label>Pie de foto / Descripción para el reporte:</label>
                        <input type="text" name="descripcion_foto_${idx}" placeholder="Ej: Sistemas auxiliares de lubricación en operación." required>
                    </div>
                `;
                contenedor.appendChild(item);
            };
            reader.readAsDataURL(file);
        });
    }
}

document.getElementById("colectorForm").addEventListener("submit", function(e) {
    e.preventDefault();
    
    payloadPreparado = prepararPayload();
    const camposVacios = detectarCamposVacios(payloadPreparado);

    if (camposVacios.length > 0) {
        mostrarModalValidacion(camposVacios);
    } else {
        enviarFormularioFinal();
    }
});

function detectarCamposVacios(data) {
    let vacios = [];

    if (!data.fecha) vacios.push("Sección 1: Fecha de Guardia");
    if (!data.inspector) vacios.push("Sección 1: Nombre del Inspector");

    if (!data.parametrosGenerales.lubPresion) vacios.push("Sección 2: Presión de Aceite de Lubricación");
    if (!data.parametrosGenerales.tanquePresion) vacios.push("Sección 2: Presión de Aire en Tanque");

    const turnoActual = data.turno;
    data.monitoreo24H.forEach(item => {
        if (item.turno === turnoActual) {
            if (!item.presIngreso || !item.tempChumMot || !item.vibMot) {
                vacios.push(`Sección 4: Lectura incompleta a las ${item.hora} (Guardia ${item.turno})`);
            }
        }
    });

    if (data.fotos.length === 0) {
        vacios.push("Sección 5: No se adjuntó evidencia fotográfica");
    }

    return vacios;
}

function mostrarModalValidacion(lista) {
    const contenedor = document.getElementById("listaCamposVacios");
    contenedor.innerHTML = "<ul>" + lista.map(item => `<li>${item}</li>`).join("") + "</ul>";
    document.getElementById("modalCamposVacios").style.display = "flex";
}

function cerrarModalValidacion() {
    document.getElementById("modalCamposVacios").style.display = "none";
}

async function enviarFormularioFinal() {
    cerrarModalValidacion();

    const btnSubmit = document.querySelector(".btn-submit");
    btnSubmit.disabled = true;
    btnSubmit.innerText = "⏳ Guardando y subiendo imágenes a Drive...";

    try {
        const response = await fetch(URL_API_GOOGLESHEETS, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadPreparado)
        });

        alert("✅ Datos de guardia registrados correctamente en Google Sheets y Drive.");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("❌ Ocurrió un error al intentar guardar la información.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "GUARDAR Y REVISAR DATOS DE GUARDIA";
    }
}

function prepararPayload() {
    const payload = {
        fecha: document.getElementById("fecha").value,
        turno: document.getElementById("turno").value,
        inspector: document.getElementById("inspector").value,
        actividades: document.getElementById("actividades").value,
        parametrosGenerales: {
            lubPresion: document.getElementById("lub_presion").value,
            lubTempTanque: document.getElementById("lub_temp_tanque").value,
            lubTempSalida: document.getElementById("lub_temp_salida").value,
            nivelAceiteMotriz: document.getElementById("nivel_acei_ladomotriz").value,
            nivelAceiteLibre: document.getElementById("nivel_acei_ladolibre").value,
            compuertaApertura: document.getElementById("compuerta_apertura").value,
            tanquePresion: document.getElementById("tanque_presion").value,
            sopEntrada: document.getElementById("sop_entrada").value,
            sopSalida: document.getElementById("sop_salida").value,
            sopTransmisor: document.getElementById("sop_transmisor").value,
            humNivel: document.getElementById("hum_nivel").value,
            tolvaMot01: document.getElementById("tolva_mot_01").value,
            tolvaMot02: document.getElementById("tolva_mot_02").value,
            tolvaMot03: document.getElementById("tolva_mot_03").value
        },
        tolvas: [],
        monitoreo24H: [],
        fotos: []
    };

    const filasTolva = document.querySelectorAll("#tablaTolvasBody tr");
    filasTolva.forEach((row, idx) => {
        const num = idx + 1;
        const horario = row.querySelector(`[name="tolva_horario_${num}"]`)?.value;
        if (horario) {
            payload.tolvas.push({
                num: num,
                turno: row.querySelector(`[name="tolva_turno_${num}"]`).value,
                horario: horario,
                duracion: row.querySelector(`[name="tolva_duracion_${num}"]`).value,
                frente: row.querySelector(`[name="tolva_frente_${num}"]`).value,
                toneladas: row.querySelector(`[name="tolva_tn_${num}"]`).value
            });
        }
    });

    cicloOperativo.forEach((item, index) => {
        payload.monitoreo24H.push({
            hora: item.hora,
            turno: item.turno,
            presIngreso: document.querySelector(`[name="pres_ingreso_${index}"]`).value,
            presSalida: document.querySelector(`[name="pres_salida_${index}"]`).value,
            presDiferencia: document.querySelector(`[name="pres_dif_${index}"]`).value,
            presAire: document.querySelector(`[name="pres_aire_${index}"]`).value,
            presLubricacion: document.querySelector(`[name="pres_lub_${index}"]`).value,
            tempChumLibre: document.querySelector(`[name="temp_chum_libre_${index}"]`).value,
            tempChumMot: document.querySelector(`[name="temp_chum_mot_${index}"]`).value,
            tempMotVent: document.querySelector(`[name="temp_mot_vent_${index}"]`).value,
            tempMotAcop: document.querySelector(`[name="temp_mot_acop_${index}"]`).value,
            vibLibre: document.querySelector(`[name="vib_libre_${index}"]`).value,
            vibMot: document.querySelector(`[name="vib_mot_${index}"]`).value,
            compuerta: document.querySelector(`[name="comp_${index}"]`).value
        });
    });

    const contenedorFotos = document.querySelectorAll("#contenedorFotos .photo-item");
    contenedorFotos.forEach((item, idx) => {
        const img = item.querySelector("img");
        const descInput = item.querySelector(`[name="descripcion_foto_${idx}"]`);
        if (img) {
            payload.fotos.push({
                base64: img.src,
                type: "image/jpeg",
                descripcion: descInput ? descInput.value : "Sin descripción"
            });
        }
    });

    return payload;
}
