// ============================================
// VARIABLES GLOBALES Y CONSTANTES
// ============================================
const limitesProvinciaSanctiSpiritus = [
    [21.50, -80.20], // Esquina suroeste
    [22.40, -79.00]  // Esquina noreste
];

const centroProvincia = [21.93, -79.45];

// Variables del mapa
let map;
let tileLayer;
let rutaControl = null;
let markerUbicacion = null;
let marcadorDestino = null;
let direccionDetectada = "";
let coordenadasUbicacion = null;
let origenModificado = false;
let seleccionandoOrigen = false;
let seleccionandoDestino = false;

// Variables para tutorial
let tutorialActivo = false;
let pasoActual = 1;
const totalPasos = 4;

// ============================================
// FUNCIONES DE UI Y NOTIFICACIONES
// ============================================
function mostrarNotificacion(mensaje, tipo = 'info') {
    const alert = document.getElementById('customAlert');
    alert.textContent = mensaje;
    alert.className = 'custom-alert';
    alert.classList.add(tipo, 'show');

    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => {
            alert.classList.remove(tipo);
        }, 300);
    }, 3000);
}

function mostrarLoading() {
    document.getElementById('loading-overlay').classList.add('show');
}

function ocultarLoading() {
    document.getElementById('loading-overlay').classList.remove('show');
}

function actualizarEstadoNav(boton, activo) {
    const navItem = boton.closest('.nav-item');
    if (activo) {
        navItem.classList.add('active');
        boton.classList.add('active');
    } else {
        navItem.classList.remove('active');
        boton.classList.remove('active');
    }
}

// ============================================
// SISTEMA DE TUTORIAL
// ============================================
function iniciarTutorial() {
    tutorialActivo = true;
    pasoActual = 1;
    mostrarPaso(pasoActual);
    document.getElementById('tutorial-overlay').classList.add('show');
    
    // Deshabilitar interacción con el mapa mientras el tutorial está activo
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
}

function mostrarPaso(numero) {
    // Ocultar todos los pasos
    document.querySelectorAll('.tutorial-step').forEach(step => {
        step.style.display = 'none';
    });
    
    // Mostrar el paso actual
    const pasoElemento = document.getElementById(`step${numero}`);
    if (pasoElemento) {
        pasoElemento.style.display = 'block';
    }
    
    // Posicionar el anillo de enfoque
    posicionarAnilloEnfoque(numero);
}

function posicionarAnilloEnfoque(paso) {
    const anillo = document.getElementById('focus-ring');
    const botones = document.querySelectorAll('.nav-item');
    
    if (botones[paso - 1]) {
        const botonRect = botones[paso - 1].getBoundingClientRect();
        const bottomNavRect = document.getElementById('bottom-nav').getBoundingClientRect();
        
        // Calcular posición centrada en el botón
        const centerX = botonRect.left + botonRect.width / 2;
        const centerY = botonRect.top + botonRect.height / 2;
        
        // Ajustar para que esté dentro de la vista del tutorial
        anillo.style.left = `${centerX}px`;
        anillo.style.top = `${centerY}px`;
        anillo.style.transform = `translate(-50%, -50%)`;
    }
}

function siguientePaso() {
    if (pasoActual < totalPasos) {
        pasoActual++;
        mostrarPaso(pasoActual);
    } else {
        finalizarTutorial();
    }
}

function anteriorPaso() {
    if (pasoActual > 1) {
        pasoActual--;
        mostrarPaso(pasoActual);
    }
}

function finalizarTutorial() {
    tutorialActivo = false;
    document.getElementById('tutorial-overlay').classList.remove('show');
    
    // Rehabilitar interacción con el mapa
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    
    // Guardar en localStorage que el usuario ya vio el tutorial
    localStorage.setItem('tutorialVisto', 'true');
    
    mostrarNotificacion('¡Tutorial completado! Ya puedes usar la aplicación.', 'success');
}

function saltarTutorial() {
    tutorialActivo = false;
    document.getElementById('tutorial-overlay').classList.remove('show');
    
    // Rehabilitar interacción con el mapa
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    
    // Guardar en localStorage que el usuario ya vio el tutorial
    localStorage.setItem('tutorialVisto', 'true');
    
    mostrarNotificacion('Puedes volver a ver el tutorial tocando el botón ❕', 'info');
}

function configurarEventosTutorial() {
    // Botón de ayuda
    document.getElementById('help-btn').addEventListener('click', iniciarTutorial);
    
    // Botones del tutorial
    document.querySelectorAll('.tutorial-next').forEach(btn => {
        btn.addEventListener('click', siguientePaso);
    });
    
    document.querySelectorAll('.tutorial-prev').forEach(btn => {
        btn.addEventListener('click', anteriorPaso);
    });
    
    document.querySelectorAll('.tutorial-finish').forEach(btn => {
        btn.addEventListener('click', finalizarTutorial);
    });
    
    document.querySelectorAll('.tutorial-skip').forEach(btn => {
        btn.addEventListener('click', saltarTutorial);
    });
    
    // Verificar si el usuario ya vio el tutorial
    const tutorialVisto = localStorage.getItem('tutorialVisto');
    if (!tutorialVisto) {
        // Mostrar tutorial automáticamente la primera vez
        setTimeout(() => {
            if (!tutorialActivo) {
                iniciarTutorial();
            }
        }, 2000);
    }
}

// ============================================
// FUNCIONES DEL MAPA
// ============================================
function inicializarMapa() {
    mostrarLoading();
    
    map = L.map('map').setView(centroProvincia, 10);
    
    // Establecer límites
    map.setMaxBounds(limitesProvinciaSanctiSpiritus);
    map.on('drag', function() {
        map.panInsideBounds(limitesProvinciaSanctiSpiritus, { animate: false });
    });
    
    // Cargar tiles
    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 9,
        attribution: '© OpenStreetMap',
        bounds: limitesProvinciaSanctiSpiritus
    }).addTo(map);
    
    tileLayer.on('load', ocultarLoading);
    tileLayer.on('tileerror', () => {
        mostrarNotificacion('Error cargando el mapa. Verifica tu conexión.', 'error');
        ocultarLoading();
    });
    
    // Configurar eventos de ubicación
    map.on('locationfound', manejarUbicacionEncontrada);
    map.on('locationerror', manejarErrorUbicacion);
    
    // Configurar tutorial
    configurarEventosTutorial();
    
    // Inicializar ubicación
    detectarUbicacion();
}

function estaDentroDeLimites(lat, lng) {
    return lat >= limitesProvinciaSanctiSpiritus[0][0] && 
           lat <= limitesProvinciaSanctiSpiritus[1][0] && 
           lng >= limitesProvinciaSanctiSpiritus[0][1] && 
           lng <= limitesProvinciaSanctiSpiritus[1][1];
}

// ============================================
// FUNCIONES DE GEOLOCALIZACIÓN
// ============================================
function detectarUbicacion() {
    map.locate({ setView: true, maxZoom: 14 });
}

function manejarUbicacionEncontrada(e) {
    if (!estaDentroDeLimites(e.latitude, e.longitude)) {
        mostrarNotificacion('Tu ubicación está fuera de la provincia Sancti Spíritus', 'error');
        return;
    }

    coordenadasUbicacion = [e.latitude, e.longitude];

    if (!markerUbicacion && !origenModificado) {
        markerUbicacion = L.marker(e.latlng).addTo(map).bindPopup('Tu ubicación').openPopup();
    } else if (markerUbicacion && !origenModificado) {
        markerUbicacion.setLatLng(e.latlng);
    }

    // Obtener dirección
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latitude}&lon=${e.longitude}`)
        .then(res => res.ok ? res.json() : Promise.reject('Error en servidor'))
        .then(data => {
            if (data && data.display_name) {
                direccionDetectada = data.display_name;
                if (!origenModificado && window.Android?.setOrigen) {
                    window.Android.setOrigen(direccionDetectada);
                }
            }
        })
        .catch(error => {
            console.warn('Error obteniendo dirección:', error);
        });
}

function manejarErrorUbicacion(e) {
    const mensajes = {
        1: 'Permiso de ubicación denegado. Activa la ubicación en ajustes.',
        2: 'Ubicación no disponible. Verifica tu conexión.',
        3: 'Tiempo de espera agotado para obtener ubicación.'
    };
    mostrarNotificacion(mensajes[e.code] || 'No se pudo obtener tu ubicación', 'error');
}

// ============================================
// FUNCIONES DE BÚSQUEDA
// ============================================
function buscarDentroDeLimites(direccion) {
    const bounds = limitesProvinciaSanctiSpiritus;
    const viewbox = `${bounds[0][1]},${bounds[0][0]},${bounds[1][1]},${bounds[1][0]}`;

    return fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}&limit=5&viewbox=${viewbox}&bounded=1&accept-language=es`)
        .then(res => res.ok ? res.json() : Promise.reject('Error en servidor'))
        .then(data => {
            if (data?.length > 0) {
                const resultadosFiltrados = data.filter(item => 
                    estaDentroDeLimites(parseFloat(item.lat), parseFloat(item.lon))
                );
                if (resultadosFiltrados.length > 0) {
                    return resultadosFiltrados[0];
                } else {
                    throw new Error(`"${direccion}" no está en Sancti Spíritus`);
                }
            } else {
                throw new Error(`No se encontró: "${direccion}"`);
            }
        });
}

// ============================================
// FUNCIONES DE ORIGEN Y DESTINO
// ============================================
function toggleOrigen() {
    if (tutorialActivo) return;
    
    const btnOrigen = document.getElementById('btn-origen');
    
    if (!seleccionandoOrigen) {
        // Activar modo selección origen
        seleccionandoOrigen = true;
        seleccionandoDestino = false;
        
        // Actualizar UI
        actualizarEstadoNav(btnOrigen, true);
        document.getElementById('btn-destino').classList.remove('active');
        
        // Activar marcador flotante
        document.getElementById('marcador-centro').classList.add('marcador-activo');
        mostrarNotificacion('Selecciona el punto de origen en el mapa', 'info');
    } else {
        // Desactivar modo selección
        seleccionandoOrigen = false;
        actualizarEstadoNav(btnOrigen, false);
        document.getElementById('marcador-centro').classList.remove('marcador-activo');
        confirmarMarcadorFlotante('origen');
    }
}

function toggleDestino() {
    if (tutorialActivo) return;
    
    const btnDestino = document.getElementById('btn-destino');
    
    if (!seleccionandoDestino) {
        // Activar modo selección destino
        seleccionandoDestino = true;
        seleccionandoOrigen = false;
        
        // Actualizar UI
        actualizarEstadoNav(btnDestino, true);
        document.getElementById('btn-origen').classList.remove('active');
        
        // Activar marcador flotante
        document.getElementById('marcador-centro').classList.add('marcador-activo');
        mostrarNotificacion('Selecciona el punto de destino en el mapa', 'info');
    } else {
        // Desactivar modo selección
        seleccionandoDestino = false;
        actualizarEstadoNav(btnDestino, false);
        document.getElementById('marcador-centro').classList.remove('marcador-activo');
        confirmarMarcadorFlotante('destino');
    }
}

function confirmarMarcadorFlotante(tipo) {
    const coords = map.getCenter();
    
    if (!estaDentroDeLimites(coords.lat, coords.lng)) {
        mostrarNotificacion('El punto seleccionado está fuera de la provincia', 'error');
        return;
    }
    
    mostrarNotificacion('Obteniendo dirección...', 'info');
    
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`)
        .then(res => res.ok ? res.json() : Promise.reject('Error en servidor'))
        .then(data => {
            if (data?.display_name) {
                const direccion = data.display_name;
                
                if (tipo === 'origen') {
                    if (markerUbicacion) {
                        markerUbicacion.setLatLng(coords).setPopupContent('Origen manual').openPopup();
                    } else {
                        markerUbicacion = L.marker(coords).addTo(map).bindPopup('Origen manual').openPopup();
                    }
                    origenModificado = true;
                    if (window.Android?.setOrigen) window.Android.setOrigen(direccion);
                    mostrarNotificacion('Origen establecido', 'success');
                } else if (tipo === 'destino') {
                    if (marcadorDestino) map.removeLayer(marcadorDestino);
                    marcadorDestino = L.marker(coords).addTo(map).bindPopup('Destino').openPopup();
                    if (window.Android?.setDestino) window.Android.setDestino(direccion);
                    mostrarNotificacion('Destino establecido', 'success');
                }
                
                crearRutaSiEsNecesario();
            }
        })
        .catch(error => {
            mostrarNotificacion('Error al obtener la dirección', 'error');
        });
}

// ============================================
// FUNCIONES DE RUTAS
// ============================================
function obtenerOrigenActual() {
    if (markerUbicacion) {
        return markerUbicacion.getLatLng();
    } else if (coordenadasUbicacion && !origenModificado) {
        return L.latLng(coordenadasUbicacion[0], coordenadasUbicacion[1]);
    }
    return null;
}

function crearRutaSiEsNecesario() {
    const origen = obtenerOrigenActual();
    const destino = marcadorDestino?.getLatLng();
    
    if (!origen || !destino) return;
    
    if (rutaControl) map.removeControl(rutaControl);
    
    mostrarNotificacion('Calculando ruta óptima...', 'info');
    
    rutaControl = L.Routing.control({
        waypoints: [origen, destino],
        lineOptions: { styles: [{ color: '#6764FD', weight: 5 }] },
        createMarker: () => null,
        addWaypoints: false,
        routeWhileDragging: false
    }).addTo(map);
    
    rutaControl.on('routesfound', function(e) {
        const routes = e.routes;
        const summary = routes[0].summary;
        const distanciaKm = summary.totalDistance / 1000;
        const tiempoMin = Math.round(summary.totalTime / 60);
        
        calcularYEnviarPrecio(distanciaKm);
        mostrarNotificacion(`Ruta calculada: ${distanciaKm.toFixed(1)} km, ${tiempoMin} min`, 'success');
    });
    
    rutaControl.on('routingerror', () => {
        mostrarNotificacion('No se pudo calcular la ruta', 'error');
    });
}

// ============================================
// FUNCIONES DE LIMPIEZA
// ============================================
function borrarRutaDesdeApp() {
    if (tutorialActivo) return;
    
    let elementosEliminados = [];
    
    if (rutaControl) {
        map.removeControl(rutaControl);
        rutaControl = null;
        elementosEliminados.push('ruta');
    }
    
    if (markerUbicacion) {
        map.removeLayer(markerUbicacion);
        markerUbicacion = null;
        elementosEliminados.push('origen');
    }
    
    if (marcadorDestino) {
        map.removeLayer(marcadorDestino);
        marcadorDestino = null;
        elementosEliminados.push('destino');
    }
    
    origenModificado = false;
    coordenadasUbicacion = null;
    
    // Limpiar estados de UI
    seleccionandoOrigen = false;
    seleccionandoDestino = false;
    document.getElementById('btn-origen').classList.remove('active');
    document.getElementById('btn-destino').classList.remove('active');
    document.getElementById('marcador-centro').classList.remove('marcador-activo');
    
    // Actualizar navegación
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    if (window.Android?.limpiarDirecciones) {
        window.Android.limpiarDirecciones();
    }
    
    if (elementosEliminados.length > 0) {
        mostrarNotificacion('Ruta eliminada correctamente', 'success');
    }
}

function restaurarUbicacion() {
    if (tutorialActivo) return;
    
    borrarRutaDesdeApp();
    detectarUbicacion();
    mostrarNotificacion('Ubicación restaurada', 'success');
}

// ============================================
// FUNCIONES PARA ANDROID
// ============================================
function mostrarDireccionesEnMapa(origen, destino) {
    if (tutorialActivo) return;
    
    if (!origen?.trim() || !destino?.trim()) {
        mostrarNotificacion('Proporciona origen y destino', 'error');
        return;
    }
    
    mostrarNotificacion('Buscando ubicaciones...', 'info');
    
    Promise.all([
        buscarDentroDeLimites(origen),
        buscarDentroDeLimites(destino)
    ])
    .then(([dataOrigen, dataDestino]) => {
        const coordsOrigen = L.latLng(dataOrigen.lat, dataOrigen.lon);
        const coordsDestino = L.latLng(dataDestino.lat, dataDestino.lon);
        
        // Limpiar marcadores anteriores
        if (markerUbicacion) map.removeLayer(markerUbicacion);
        if (marcadorDestino) map.removeLayer(marcadorDestino);
        
        // Crear nuevos marcadores
        markerUbicacion = L.marker(coordsOrigen)
            .addTo(map)
            .bindPopup(`📍 <b>Origen</b><br>${origen}`)
            .openPopup();
        
        marcadorDestino = L.marker(coordsDestino)
            .addTo(map)
            .bindPopup(`🎯 <b>Destino</b><br>${destino}`)
            .openPopup();
        
        origenModificado = true;
        
        // Ajustar vista
        const group = L.featureGroup([markerUbicacion, marcadorDestino]);
        map.fitBounds(group.getBounds().pad(0.1));
        
        // Calcular ruta
        if (rutaControl) map.removeControl(rutaControl);
        
        rutaControl = L.Routing.control({
            waypoints: [coordsOrigen, coordsDestino],
            lineOptions: { styles: [{ color: '#6764FD', weight: 5 }] },
            createMarker: () => null,
            addWaypoints: false,
            routeWhileDragging: false,
            show: false
        }).addTo(map);
        
        rutaControl.on('routesfound', function(e) {
            const distanciaKm = e.routes[0].summary.totalDistance / 1000;
            const tiempoMin = Math.round(e.routes[0].summary.totalTime / 60);
            calcularYEnviarPrecio(distanciaKm);
            mostrarNotificacion(`Ruta: ${distanciaKm.toFixed(1)} km, ${tiempoMin} min`, 'success');
        });
        
        mostrarNotificacion('Ubicaciones encontradas', 'success');
    })
    .catch(error => {
        mostrarNotificacion(error.message, 'error');
    });
}

// ============================================
// FUNCIONES DE PRECIO
// ============================================
function calcularPrecio(distanciaKm) {
    const tarifaPorKm = 150.0;
    let precio = distanciaKm * tarifaPorKm;
    return Math.max(Math.round(precio), 50); // Mínimo 50 pesos
}

function calcularYEnviarPrecio(distanciaKm) {
    const precio = calcularPrecio(distanciaKm);
    if (window.Android?.setPrecioViaje) {
        window.Android.setPrecioViaje(precio);
    }
    return precio;
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar mapa
    inicializarMapa();
    
    // Manejo de errores global
    window.addEventListener('error', function(e) {
        console.error('Error global:', e.error);
        mostrarNotificacion('Error inesperado', 'error');
    });
    
    // Exponer funciones globales para Android
    window.mostrarDireccionesEnMapa = mostrarDireccionesEnMapa;
    window.borrarRutaDesdeApp = borrarRutaDesdeApp;
    window.restaurarUbicacion = restaurarUbicacion;
    window.toggleOrigen = toggleOrigen;
    window.toggleDestino = toggleDestino;
    window.iniciarTutorial = iniciarTutorial;
});