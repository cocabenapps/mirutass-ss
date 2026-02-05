// drivers-realtime.js - Sistema de choferes activos en tiempo real
// Configuración de Supabase
const SUPABASE_URL = 'https://dxbivfspnrhhewllirjh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Yml2ZnNwbnJoaGV3bGxpcmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzUyMjksImV4cCI6MjA3MjQ1MTIyOX0.y2WHxKwoIZ07WMcBYY110XIa5LBqCJh1YSAwuinGwGc';

// Variables globales
let supabaseClient = null;
let driversManager = null;
let userPosition = null;

// Clase para gestionar choferes ACTIVOS
class DriversManager {
    constructor(map) {
        this.map = map;
        this.driversMarkers = new Map(); // Map<id, marker>
        this.driversLayer = L.layerGroup().addTo(map);
        
        // Íconos limpios estilo Uber
        this.icons = {
            carro: this.createCarIcon(),
            moto: this.createMotoIcon()
        };
        
        console.log('🚗 Gestor de choferes inicializado');
    }
    
    // Ícono de carro UBER - limpio
    createCarIcon() {
        return L.divIcon({
            className: 'driver-icon car-icon',
            html: `
                <div style="
                    position: relative;
                    width: 24px;
                    height: 24px;
                ">
                    <!-- Carrocería -->
                    <div style="
                        position: absolute;
                        width: 18px;
                        height: 8px;
                        background: #3D5AFE;
                        border-radius: 3px 3px 5px 5px;
                        top: 10px;
                        left: 3px;
                    "></div>
                    
                    <!-- Techo -->
                    <div style="
                        position: absolute;
                        width: 12px;
                        height: 5px;
                        background: #3D5AFE;
                        border-radius: 3px 3px 0 0;
                        top: 7px;
                        left: 6px;
                    "></div>
                    
                    <!-- Ventana -->
                    <div style="
                        position: absolute;
                        width: 8px;
                        height: 3px;
                        background: #87CEEB;
                        border-radius: 2px;
                        top: 8px;
                        left: 8px;
                    "></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }
    
    // Ícono de moto UBER - limpio
    createMotoIcon() {
        return L.divIcon({
            className: 'driver-icon moto-icon',
            html: `
                <div style="
                    position: relative;
                    width: 20px;
                    height: 20px;
                ">
                    <!-- Cuerpo -->
                    <div style="
                        position: absolute;
                        width: 12px;
                        height: 4px;
                        background: #FF4081;
                        border-radius: 2px;
                        top: 10px;
                        left: 4px;
                        transform: rotate(15deg);
                    "></div>
                    
                    <!-- Asiento -->
                    <div style="
                        position: absolute;
                        width: 8px;
                        height: 3px;
                        background: #FF4081;
                        border-radius: 2px 2px 3px 3px;
                        top: 8px;
                        left: 6px;
                    "></div>
                    
                    <!-- Ruedas -->
                    <div style="
                        position: absolute;
                        width: 5px;
                        height: 5px;
                        background: #333;
                        border-radius: 50%;
                        top: 13px;
                        left: 3px;
                    "></div>
                    <div style="
                        position: absolute;
                        width: 5px;
                        height: 5px;
                        background: #333;
                        border-radius: 50%;
                        top: 13px;
                        left: 12px;
                    "></div>
                </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }
    
    // Calcular distancia en metros (misma fórmula que app.js)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * 
                  Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distancia en metros
    }
    
    // Obtener choferes ACTIVOS (<1 minuto) y CERCANOS (<200m)
    async getActiveNearbyDrivers(userLat, userLng) {
        if (!supabaseClient || !userLat || !userLng) {
            return [];
        }
        
        try {
            // Obtener todos los choferes de Supabase
            const { data, error } = await supabaseClient
                .from('choferes')
                .select('id, tipo_vehiculo, lat, lng, updated_at')
                .not('lat', 'is', null)
                .not('lng', 'is', null);
            
            if (error) {
                console.error('❌ Error Supabase:', error);
                return [];
            }
            
            if (!data || data.length === 0) {
                return [];
            }
            
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 minuto atrás
            
            // Filtrar: 1) Activos en último minuto, 2) Dentro de 200m
            const activeDrivers = data.filter(driver => {
                // 1. Verificar que sea ACTIVO (actualizado en último minuto)
                if (!driver.updated_at) return false;
                
                const lastUpdate = new Date(driver.updated_at);
                if (lastUpdate < oneMinuteAgo) {
                    return false; // Inactivo (>1 minuto)
                }
                
                // 2. Verificar que esté dentro de 200 metros
                if (!driver.lat || !driver.lng) return false;
                
                const distance = this.calculateDistance(
                    userLat, userLng,
                    parseFloat(driver.lat),
                    parseFloat(driver.lng)
                );
                
                return distance <= 200; // 200 metros máximo
            });
            
            return activeDrivers;
            
        } catch (error) {
            console.error('❌ Error obteniendo choferes:', error);
            return [];
        }
    }
    
    // Actualizar marcadores en el mapa
    async updateDriversMarkers(userLat, userLng) {
        if (!userLat || !userLng) {
            console.log('📍 Esperando ubicación del usuario...');
            return;
        }
        
        try {
            // Obtener choferes activos y cercanos
            const drivers = await this.getActiveNearbyDrivers(userLat, userLng);
            
            const currentDriverIds = new Set();
            
            // Mostrar choferes activos
            drivers.forEach(driver => {
                currentDriverIds.add(driver.id);
                
                const latLng = L.latLng(
                    parseFloat(driver.lat),
                    parseFloat(driver.lng)
                );
                
                const icon = this.icons[driver.tipo_vehiculo] || this.icons.carro;
                
                // Si ya existe, actualizar posición
                if (this.driversMarkers.has(driver.id)) {
                    const marker = this.driversMarkers.get(driver.id);
                    marker.setLatLng(latLng);
                } 
                // Si es nuevo, crear marcador
                else {
                    const marker = L.marker(latLng, { 
                        icon,
                        title: `Chofer ${driver.tipo_vehiculo}`
                    }).addTo(this.driversLayer);
                    
                    this.driversMarkers.set(driver.id, marker);
                    console.log(`📍 Chofer ${driver.tipo_vehiculo} agregado (ID: ${driver.id})`);
                }
            });
            
            // Eliminar choferes que ya no están activos/cerca
            this.driversMarkers.forEach((marker, driverId) => {
                if (!currentDriverIds.has(driverId)) {
                    this.driversLayer.removeLayer(marker);
                    this.driversMarkers.delete(driverId);
                    console.log(`🗑️ Chofer eliminado (ID: ${driverId})`);
                }
            });
            
            // Log informativo
            if (drivers.length > 0) {
                console.log(`✅ ${drivers.length} chofer(es) activo(s) cerca`);
            }
            
        } catch (error) {
            console.error('❌ Error actualizando choferes:', error);
        }
    }
    
    // Limpiar todos los marcadores
    clearAll() {
        this.driversLayer.clearLayers();
        this.driversMarkers.clear();
        console.log('🧹 Todos los choferes eliminados del mapa');
    }
    
    // Iniciar actualización automática cada 10 segundos
    startAutoUpdate() {
        // Limpiar intervalo anterior si existe
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (userPosition) {
                this.updateDriversMarkers(userPosition.lat, userPosition.lng);
            }
        }, 10000); // 10 segundos
        
        console.log('🔄 Actualización automática iniciada (cada 10 segundos)');
    }
    
    // Detener actualización automática
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('⏹️ Actualización automática detenida');
        }
    }
}

// ============================================
// FUNCIONES GLOBALES
// ============================================

// Inicializar sistema de choferes
function initDriversSystem() {
    if (!window.map) {
        console.warn('⚠️ Mapa no disponible, reintentando en 2 segundos...');
        setTimeout(initDriversSystem, 2000);
        return;
    }
    
    try {
        // Inicializar cliente Supabase
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Crear gestor de choferes
        driversManager = new DriversManager(window.map);
        
        // Iniciar actualización automática
        driversManager.startAutoUpdate();
        
        console.log('✅ Sistema de choferes ACTIVOS inicializado correctamente');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error inicializando sistema de choferes:', error);
        return false;
    }
}

// Función PRINCIPAL - Actualizar posición del usuario
function updateDriverPosition(latitude, longitude) {
    if (!driversManager) {
        console.warn('⚠️ Sistema de choferes no inicializado, intentando inicializar...');
        if (!initDriversSystem()) {
            console.error('❌ No se pudo inicializar el sistema');
            return;
        }
    }
    
    // Validar coordenadas
    if (latitude === undefined || longitude === undefined ||
        isNaN(latitude) || isNaN(longitude)) {
        console.error('❌ Coordenadas inválidas:', latitude, longitude);
        return;
    }
    
    // Actualizar posición del usuario
    userPosition = { 
        lat: parseFloat(latitude), 
        lng: parseFloat(longitude) 
    };
    
    // Actualizar choferes inmediatamente
    driversManager.updateDriversMarkers(userPosition.lat, userPosition.lng);
    
    console.log(`📍 Ubicación actualizada: ${userPosition.lat.toFixed(6)}, ${userPosition.lng.toFixed(6)}`);
}

// Limpiar choferes del mapa
function clearDrivers() {
    if (driversManager) {
        driversManager.clearAll();
    }
}

// Obtener estado del sistema
function getDriversSystemStatus() {
    return {
        initialized: !!driversManager,
        userPosition: userPosition,
        driversCount: driversManager ? driversManager.driversMarkers.size : 0
    };
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================

// Esperar a que la página cargue completamente
document.addEventListener('DOMContentLoaded', function() {
    // Esperar 3 segundos para que el mapa se inicialice
    setTimeout(() => {
        if (window.map) {
            initDriversSystem();
        } else {
            // Reintentar después de 2 segundos
            setTimeout(initDriversSystem, 2000);
        }
    }, 3000);
});

// Exponer funciones globalmente para la app
window.updateDriverPosition = updateDriverPosition;
window.clearDrivers = clearDrivers;
window.getDriversSystemStatus = getDriversSystemStatus;
window.initDriversSystem = initDriversSystem;

// Manejar errores no capturados
window.addEventListener('error', function(e) {
    console.error('❌ Error global en sistema de choferes:', e.error);
});

// Exportar para debugging
console.log('🚗 Sistema de choferes cargado y listo');