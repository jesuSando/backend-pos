const transbankService = require('../services/transbankService');

const CONFIG = {
    MAX_PORT_ATTEMPTS: 3,
    PORT_RETRY_DELAY: 5000,
    MAX_KEY_ATTEMPTS: 5,
    KEY_RETRY_DELAY: 3000,
    MONITOR_INTERVAL: 10000,
    RECONNECT_DELAY: 10000
};

async function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

async function tryLoadKeys() {
    for (let attempt = 1; attempt <= CONFIG.MAX_KEY_ATTEMPTS; attempt++) {
        try {
            console.log(`[POS] Cargando llaves (Intento ${attempt}/${CONFIG.MAX_KEY_ATTEMPTS})`);
            await transbankService.loadKey();
            console.log('[POS] Llaves cargadas exitosamente');
            return true;
        } catch (error) {
            console.error(`[POS] Error cargando llaves: ${error.message}`);
            if (attempt < CONFIG.MAX_KEY_ATTEMPTS) await sleep(CONFIG.KEY_RETRY_DELAY);
        }
    }
    return false;
}

async function tryConnectToPort(portPath) {
    for (let attempt = 1; attempt <= CONFIG.MAX_PORT_ATTEMPTS; attempt++) {
        try {
            console.log(`[POS] Conectando a ${portPath} (Intento ${attempt}/${CONFIG.MAX_PORT_ATTEMPTS})`);
            const connected = await transbankService.connectToPort(portPath);
            if (connected) {
                console.log(`[POS] Conexión exitosa en ${portPath}`);
                return true;
            }
        } catch (error) {
            console.error(`[POS] Error conectando a ${portPath}: ${error.message}`);
            if (attempt < CONFIG.MAX_PORT_ATTEMPTS) await sleep(CONFIG.PORT_RETRY_DELAY);
        }
    }
    return false;
}

let isReconnecting = false;
let connectionLock = false;
let pendingOperations = [];

async function findAndConnect() {
    if (connectionLock) {
        console.log('[POS] Operación de conexión en curso, esperando...');
        return { success: false, reason: 'Connection operation in progress' };
    }

    connectionLock = true;

    try {
        if (isReconnecting) {
            console.log('[POS] Ya hay un proceso de reconexión en curso');
            return { success: false, reason: 'Reconnection already in progress' };
        }

        isReconnecting = true;
        
        try {
            console.log('[POS] Buscando puertos disponibles...');
            var ports = await transbankService.listAvailablePorts();
            var acmPorts = ports.filter(function (p) {
                return p.path && p.path.indexOf('ACM') !== -1;
            });

            if (acmPorts.length === 0) {
                console.log('[POS] No se encontraron puertos ACM disponibles');
                return { success: false, reason: 'No ACM ports found' };
            }

            console.log('[POS] Puertos detectados:', acmPorts.map(p => p.path).join(', '));

            for (const port of acmPorts) {
                const connected = await tryConnectToPort(port.path);
                if (connected) {
                    const keysLoaded = await tryLoadKeys();
                    isReconnecting = false;
                    return {
                        success: true,
                        port: port.path,
                        keysLoaded,
                        message: keysLoaded ? 'POS listo para operar' : 'POS conectado pero sin llaves'
                    };
                }
            }

            return { success: false, reason: 'All connection attempts failed' };
        } catch (error) {
            console.error('[POS] Error en búsqueda de puertos:', error.message);
            return { success: false, reason: error.message };
        } finally {
            isReconnecting = false;
        }
    } finally {
        connectionLock = false;
        isReconnecting = false;
    }

}

async function initializePOS() {
    if (connectionLock) {
        return { success: false, reason: 'Initialization already in progress' };
    }

    try {
        console.log('[POS] Iniciando conexión...');
        await transbankService.closeConnection();
        return await findAndConnect();
    } catch (error) {
        console.error('[POS] Error en inicialización:', error.message);
        return { success: false, reason: error.message };
    }
}

async function monitorConnection(callback) {
    let monitorActive = false;
    let monitorInterval = null;
    let isChecking = false;

    return {
        start: () => {
            if (monitorActive) return;
            monitorActive = true;

            monitorInterval = setInterval(async () => {
                if (isChecking) return;
                isChecking = true;

                try {
                    const isAlive = await transbankService.isAlive();
                    if (!isAlive) {
                        console.log('[POS] Desconexión detectada');
                        await sleep(CONFIG.RECONNECT_DELAY);
                        callback();
                    }
                } catch (error) {
                    console.error('[POS] Error en monitoreo:', error.message);
                } finally {
                    isChecking = false;
                }
            }, CONFIG.MONITOR_INTERVAL);
        },
        stop: () => {
            clearInterval(monitorInterval);
            monitorActive = false;
        }
    };
}

module.exports = {
    initializePOS,
    monitorConnection,
    tryReconnect: findAndConnect,
    sleep
};