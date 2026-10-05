// URL DE TU WEB APP DE GOOGLE APPS SCRIPT
const URL_API_GOOGLESHEETS = "https://script.google.com/macros/s/AKfycbw8X1UsQXLOpdmC2k5SaHjQGRRwzL8I-OViSVJ9IDuGjtqoOf_3t-b_6wNnDJkMt3d1/exec";

// El acceso se valida en Apps Script; no hay contraseñas en el código público.

let payloadPreparado = null;

// Ciclo operativo bihorario corregido (09:00 a 07:00 [+1 día])
const cicloOperativo = [
    { hora: "09:00", turno: "DIA" },
    { hora: "11:00", turno: "DIA" },
    { hora: "13:00", turno: "DIA" },
    { hora: "15:00", turno: "DIA" },
    { hora: "17:00", turno: "DIA" },
    { hora: "19:00", turno: "DIA" },
    { hora: "21:00", turno: "NOCHE" },
    { hora: "23:00", turno: "NOCHE" },
    { hora: "01:00", turno: "NOCHE" },
    { hora: "03:00", turno: "NOCHE" },
    { hora: "05:00", turno: "NOCHE" },
    { hora: "07:00", turno: "NOCHE" }
];

let contadorTolva = 0;

// Verificar estado de sesión al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = sessionStorage.getItem('colector_usuario');
    
    if (usuarioGuardado && sessionStorage.getItem("colector_token")) {
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
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const boton = this.querySelector('button');
    boton.disabled = true;
    const errorMsg = document.getElementById('errorMsg');
    try {
        const resultado = await solicitarAPI({accion:'login', usuario:document.getElementById('loginUser').value, clave:document.getElementById('loginPass').value}, false);
        sessionStorage.setItem('colector_token', resultado.token);
        sessionStorage.setItem('colector_usuario', resultado.usuario);
        localStorage.removeItem('colector_usuario');
        errorMsg.style.display = 'none';
        iniciarSesionCorrecta(resultado.usuario);
    } catch(error) {
        errorMsg.textContent = error.message;
        errorMsg.style.display = 'block';
    } finally {
        document.getElementById('loginPass').value = '';
        boton.disabled = false;
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
    if (hayCambios && !confirm('Hay cambios sin guardar. ¿Desea cerrar sesión?')) return;
    sessionStorage.removeItem('colector_token');
    sessionStorage.removeItem('colector_usuario');
    localStorage.removeItem('colector_usuario');
    hayCambios = false;
    location.reload();
}

// Renderizar filas de la Sección 4 alineadas a los nuevos encabezados y con step 0.001 (hasta 3 decimales)
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
            <td><input type="number" step="0.001" name="pres_ingreso_${index}" placeholder="Ej: 85.000"></td>
            <td><input type="number" step="0.001" name="pres_salida_${index}" placeholder="Ej: 75.000"></td>
            <td><input type="number" step="0.001" name="pres_dif_${index}" placeholder="Ej: 10.000"></td>
            <td><input type="number" step="0.001" name="pres_aire_${index}" placeholder="Ej: 80.000"></td>
            <td><input type="number" step="0.001" name="pres_lub_${index}" placeholder="Ej: 0.205"></td>
            
            <!-- Temperatura Chumacera : Motor (4 columnas) -->
            <td><input type="number" step="0.1" name="temp_chum_libre_${index}" placeholder="Ej: 40.5"></td>
            <td><input type="number" step="0.1" name="temp_chum_mot_${index}" placeholder="Ej: 42.0"></td>
            <td><input type="number" step="0.1" name="temp_mot_vent_${index}" placeholder="Ej: 48.2"></td>
            <td><input type="number" step="0.1" name="temp_mot_acop_${index}" placeholder="Ej: 45.1"></td>
            
            <!-- Vibraciones (mm/s) (2 columnas) -->
            <td><input type="number" step="0.001" name="vib_libre_${index}" placeholder="Ej: 1.125"></td>
            <td><input type="number" step="0.001" name="vib_mot_${index}" placeholder="Ej: 1.250"></td>
            
            <!-- Compuerta (1 columna) -->
            <td><input type="number" step="0.1" name="comp_${index}" placeholder="Ej: 60.0"></td>
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
    row.dataset.id = crypto.randomUUID();
    row.querySelector("select").disabled = true;
    row.querySelector("select").value = document.getElementById("turno").value === "NOCHE" ? "NOCHE" : "DÍA";
    tbody.appendChild(row);
}

let fotosPendientes = 0;
let enviandoGuardia = false;
let siguienteFoto = 0;

function procesarFotos(input) {
    const contenedor = document.getElementById("contenedorFotos");
    Array.from(input.files || []).forEach(file => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            alert("Use imágenes JPG, PNG o WebP: " + file.name);
            return;
        }
        const item = document.createElement("div");
        item.className = "photo-item";
        item.dataset.tipo = file.type;
        const indice = siguienteFoto++;
        item.innerHTML = '<img alt="Evidencia"><div style="flex-grow:1"><label>Pie de foto / Descripción para el reporte:</label><input type="text" name="descripcion_foto_' + indice + '" required placeholder="Describa la actividad"><button type="button">Quitar foto</button></div>';
        item.querySelector("button").addEventListener("click", () => { item.remove(); hayCambios = true; });
        contenedor.appendChild(item);
        fotosPendientes++;
        hayCambios = true;
        const reader = new FileReader();
        reader.onload = () => { item.querySelector("img").src = reader.result; };
        reader.onerror = () => { item.remove(); alert("No se pudo leer la foto: " + file.name); };
        reader.onloadend = () => { fotosPendientes--; };
        reader.readAsDataURL(file);
    });
    input.value = "";
}

document.getElementById("colectorForm").addEventListener("submit", function(e) {
    e.preventDefault();
    
    if (enviandoGuardia) return;
    if (fotosPendientes) { alert("Espere a que terminen de cargar las fotos."); return; }
    if (!guardiaCargada) { alert("Primero cargue la fecha y el turno que desea registrar."); return; }
    try { payloadPreparado = prepararPayload(); } catch (error) { alert(error.message); return; }
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

    if (data.fotos.length === 0 && (!data.fotosExistentes || data.fotosExistentes.length === 0)) {
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
    if (enviandoGuardia || !payloadPreparado || !guardiaCargada) return;
    cerrarModalValidacion();
    if (fotosPendientes) { alert("Espere a que terminen de cargar las fotos."); return; }
    enviandoGuardia = true;
    bloquearFormulario(true);
    const boton = document.querySelector("#colectorForm .btn-submit");
    boton.innerText = "Guardando y verificando...";
    try {
        const resultado = await solicitarAPI(payloadPreparado);
        if (resultado.id !== guardiaCargada.fecha || !resultado.revision) throw new Error("Respuesta de guardado incompleta.");
        guardiaCargada.revision = resultado.revision;
        hayCambios = false;
        document.querySelectorAll("#contenedorFotos .photo-item").forEach(item => item.remove());
        document.getElementById("fotosInput").value = "";
        payloadPreparado = null;
        mostrarEstado("Guardado confirmado.");
        try {
            const consulta = await solicitarAPI({accion:"consultar",fecha:guardiaCargada.fecha,turno:guardiaCargada.turno});
            aplicarGuardia(consulta.registro);
            mostrarEstado("Guardado confirmado. Puede continuar registrando este turno.");
        } catch(error) {
            mostrarEstado("Guardado confirmado, pero no se pudo actualizar la vista. Vuelva a cargar la guardia antes de seguir.");
            guardiaCargada = null;
        }
    } catch(error) {
        mostrarEstado(error.message);
        alert("No se confirmó este guardado: " + error.message + " Sus cambios permanecen en pantalla.");
    } finally {
        enviandoGuardia = false;
        bloquearFormulario(false);
        boton.innerText = "GUARDAR Y REVISAR DATOS DE GUARDIA";
    }
}

function prepararPayload() {
    if (!guardiaCargada || guardiaCargada.fecha !== document.getElementById("fecha").value || guardiaCargada.turno !== document.getElementById("turno").value) throw new Error("Cargue la guardia seleccionada antes de guardar.");
    const payload = {
        accion: "guardar",
        baseRevision: guardiaCargada.revision,
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
        if (!horario && row.dataset.guardada === "1") throw new Error("Una descarga guardada necesita su horario. Corríjalo sin dejarlo vacío.");
        if (horario) {
            payload.tolvas.push({
                id: row.dataset.id,
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
        const descInput = item.querySelector("input[type=text]");
        if (img) {
            payload.fotos.push({
                base64: img.src,
                type: item.dataset.tipo || "image/jpeg",
                descripcion: descInput ? descInput.value : "Sin descripción"
            });
        }
    });

    payload.monitoreo24H = payload.monitoreo24H.filter(item => item.turno === payload.turno);
    payload.fotosExistentes = Array.from(document.querySelectorAll(".photo-guardada")).map(item => ({id:item.dataset.id,descripcion:item.querySelector("input").value}));
    return payload;
}
// Los campos del otro turno se conservan en pantalla, pero no se envian ni validan.
function actualizarTurnoVisible() {
    const turno = document.getElementById("turno").value;
    document.querySelectorAll("#tablaHorasBody tr").forEach((fila, i) => {
        const otroTurno = cicloOperativo[i].turno !== turno;
        fila.querySelectorAll("input").forEach(input => { input.disabled = otroTurno; });
        fila.style.opacity = otroTurno ? "0.45" : "1";
    });
    document.querySelectorAll("#tablaTolvasBody tr").forEach(fila => {
        if (!fila.querySelector('input[name^="tolva_horario_"]').value) fila.querySelector("select").value = turno === "NOCHE" ? "NOCHE" : "DÍA";
    });
}
document.getElementById("turno").addEventListener("change", actualizarTurnoVisible);
window.addEventListener("DOMContentLoaded", actualizarTurnoVisible);


let guardiaCargada = null;
let hayCambios = false;
let cargandoGuardia = false;
const camposGenerales = {lubPresion:"lub_presion",lubTempTanque:"lub_temp_tanque",lubTempSalida:"lub_temp_salida",nivelAceiteMotriz:"nivel_acei_ladomotriz",nivelAceiteLibre:"nivel_acei_ladolibre",compuertaApertura:"compuerta_apertura",tanquePresion:"tanque_presion",sopEntrada:"sop_entrada",sopSalida:"sop_salida",sopTransmisor:"sop_transmisor",humNivel:"hum_nivel",tolvaMot01:"tolva_mot_01",tolvaMot02:"tolva_mot_02",tolvaMot03:"tolva_mot_03"};
const camposLectura = {presIngreso:"pres_ingreso",presSalida:"pres_salida",presDiferencia:"pres_dif",presAire:"pres_aire",presLubricacion:"pres_lub",tempChumLibre:"temp_chum_libre",tempChumMot:"temp_chum_mot",tempMotVent:"temp_mot_vent",tempMotAcop:"temp_mot_acop",vibLibre:"vib_libre",vibMot:"vib_mot",compuerta:"comp"};
async function solicitarAPI(datos, autenticar = true) {
    const token = sessionStorage.getItem("colector_token");
    if (autenticar && !token) throw new Error("Inicie sesión para continuar.");
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 90000);
    try {
        const respuesta = await fetch(URL_API_GOOGLESHEETS, {method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(autenticar ? {...datos,token} : datos),signal:controlador.signal});
        if (!respuesta.ok) throw new Error("El servicio no está disponible (" + respuesta.status + ").");
        const resultado = await respuesta.json();
        if (resultado.status !== "success") {
            if (String(resultado.message).startsWith("SESION:")) {
                sessionStorage.removeItem("colector_token");
                document.getElementById("loginOverlay").style.display = "flex";
                document.getElementById("appContent").style.display = "none";
            }
            throw new Error(resultado.message || "No se pudo completar la operación.");
        }
        return resultado;
    } catch(error) {
        if (error.name === "AbortError") throw new Error("La respuesta tardó demasiado. Puede reintentar sin duplicar el envío.");
        throw error;
    } finally { clearTimeout(limite); }
}
function mostrarEstado(texto) {
    document.getElementById("estadoGuardia").textContent = texto;
}
function bloquearFormulario(ocupado) {
    document.querySelectorAll("#colectorForm input, #colectorForm select, #colectorForm textarea, #colectorForm button").forEach(control => {
        control.disabled = ocupado || (!guardiaCargada && !["fecha","turno","cargarGuardia"].includes(control.id));
    });
    document.querySelector(".btn-logout").disabled = ocupado;
    document.querySelector(".btn-warning-submit").disabled = ocupado;
    document.getElementById("inspector").readOnly = true;
    if (!ocupado && guardiaCargada) actualizarTurnoVisible();
    document.querySelectorAll("#tablaTolvasBody select").forEach(select => {select.disabled = true;});
}
function limpiarDatos() {
    Object.values(camposGenerales).forEach(id => {document.getElementById(id).value = "";});
    document.querySelectorAll("#tablaHorasBody input").forEach(input => {input.value = "";});
    document.getElementById("tablaTolvasBody").innerHTML = "";
    contadorTolva = 0;
    agregarFilaTolva(); agregarFilaTolva();
    document.getElementById("actividades").value = "";
    document.getElementById("contenedorFotos").innerHTML = "";
    document.getElementById("fotosInput").value = "";
}
function aplicarGuardia(registro) {
    limpiarDatos();
    guardiaCargada = {fecha:registro.fecha,turno:registro.turno,revision:registro.revision};
    Object.entries(camposGenerales).forEach(([campo,id]) => {document.getElementById(id).value = registro.parametrosGenerales[campo] ?? "";});
    (registro.monitoreo24H || []).forEach(lectura => {
        const indice = cicloOperativo.findIndex(item => item.hora === lectura.hora);
        if (indice < 0) return;
        Object.entries(camposLectura).forEach(([campo,nombre]) => {document.querySelector('[name="' + nombre + '_' + indice + '"]').value = lectura[campo] ?? "";});
    });
    document.getElementById("tablaTolvasBody").innerHTML = ""; contadorTolva = 0;
    (registro.tolvas || []).forEach(tolva => {
        agregarFilaTolva();
        const fila = document.querySelector("#tablaTolvasBody tr:last-child");
        fila.dataset.id = tolva.id; fila.dataset.guardada = "1";
        const campos = {horario:"horario",duracion:"duracion",frente:"frente",toneladas:"tn"};
        Object.entries(campos).forEach(([campo,nombre]) => {fila.querySelector('[name="tolva_' + nombre + '_' + contadorTolva + '"]').value = tolva[campo] ?? "";});
    });
    if (!contadorTolva) {agregarFilaTolva();agregarFilaTolva();}
    document.getElementById("actividades").value = registro.actividades || "";
    (registro.fotos || []).forEach(foto => {
        const item = document.createElement("div"); item.className = "photo-guardada"; item.dataset.id = foto.id;
        item.style.cssText = "padding:10px;margin-bottom:10px;border:1px solid #ccc;background:white";
        const enlace = document.createElement("a"); enlace.textContent = "Ver foto guardada en Drive"; enlace.target = "_blank"; enlace.rel = "noopener noreferrer";
        enlace.href = "https://drive.google.com/file/d/" + encodeURIComponent(foto.id) + "/view";
        const input = document.createElement("input"); input.type = "text"; input.required = true; input.value = foto.descripcion || ""; input.setAttribute("aria-label","Descripción de foto guardada");
        item.append(enlace,input); document.getElementById("contenedorFotos").appendChild(item);
    });
    hayCambios = false; payloadPreparado = null;
    mostrarEstado((registro.existe ? "Guardia cargada. " : "No hay registros para esta fecha. Puede iniciar el turno. ") + (registro.advertencias || []).join(" "));
    bloquearFormulario(false);
}
async function cargarGuardia() {
    if (cargandoGuardia || enviandoGuardia) return;
    if (fotosPendientes) {alert("Espere a que terminen de cargar las fotos.");return;}
    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;
    if (!fecha) {alert("Seleccione la fecha operativa.");return;}
    if (hayCambios && !confirm("Hay cambios sin guardar. ¿Desea descartarlos y cargar la guardia guardada?")) return;
    cargandoGuardia = true; bloquearFormulario(true); mostrarEstado("Cargando registros...");
    try { const resultado = await solicitarAPI({accion:"consultar",fecha,turno}); aplicarGuardia(resultado.registro); }
    catch(error) {mostrarEstado(error.message);}
    finally {cargandoGuardia = false;bloquearFormulario(false);}
}
function cambiarContexto() {
    if (guardiaCargada && (hayCambios || fotosPendientes) && !confirm("Hay cambios sin guardar. ¿Desea descartarlos para cambiar de fecha o turno?")) {
        document.getElementById("fecha").value = guardiaCargada.fecha;
        document.getElementById("turno").value = guardiaCargada.turno;
        bloquearFormulario(false); return;
    }
    guardiaCargada = null; hayCambios = false; payloadPreparado = null; limpiarDatos();
    mostrarEstado("Pulse Cargar guardia para recuperar o iniciar el turno seleccionado.");
    bloquearFormulario(false);
}
window.addEventListener("DOMContentLoaded", () => {
    localStorage.removeItem("colector_usuario");
    const seccion = document.querySelector("#colectorForm .section");
    const ayuda = document.createElement("p"); ayuda.textContent = "Use la fecha en que comenzó el día operativo. La madrugada del turno noche pertenece a esa misma fecha.";
    const boton = document.createElement("button"); boton.type = "button"; boton.id = "cargarGuardia"; boton.className = "btn-secondary"; boton.textContent = "Cargar guardia"; boton.addEventListener("click", cargarGuardia);
    const estado = document.createElement("p"); estado.id = "estadoGuardia"; estado.setAttribute("role","status"); estado.textContent = "Seleccione fecha y turno y pulse Cargar guardia.";
    seccion.append(ayuda,boton,estado);
    document.getElementById("fecha").addEventListener("change", cambiarContexto);
    document.getElementById("turno").addEventListener("change", cambiarContexto);
    document.getElementById("colectorForm").addEventListener("input", e => {if (guardiaCargada && !["fecha","turno"].includes(e.target.id)) hayCambios = true;});
    bloquearFormulario(false);
});
window.addEventListener("beforeunload", e => {if (hayCambios) {e.preventDefault();e.returnValue = "";}});
