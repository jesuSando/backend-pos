const { POSAutoservicio } = require('transbank-pos-sdk');

class TransbankService {

    constructor() {
        this.pos = new POSAutoservicio();
        this.connectedPort = null;
        this.pos.setDebug(false);
    }

    get deviceConnected() {
        return this.connectedPort !== null;
    }

    get connection() {
        return this.connectedPort;
    }

    async isAlive() {
        if (!this.connectedPort) return false;

        try {
            const result = await this.pos.poll();
            if (result === undefined) {
                throw new Error('Respuesta indefinida del POS');
            }
            return true;
        } catch (e) {
            console.error("Error verificando estado del POS:", e.message || 'Error en comunicación con POS');

            if (e.message.includes('desconectado') || e.message.includes('no conectado')) {
                return false;
            }
            return true;
        }
    }

    async listAvailablePorts() {
        try {
            const ports = await this.pos.listPorts();
            console.log("Puertos encontrados exitosamente");
            return ports;
        } catch (err) {
            console.log('Ocurrió un error listando los puertos, ', err.message);
            return [];
        }
    }

    async loadKey() {
        try {
            await this.pos.loadKeys();
            return { success: true, message: 'Llaves cargadas correctamente' };
        } catch (error) {
            console.log("Error al cargar llaves:", error)
            throw error;
        }
    }

    async connectToPort(portPath) {
        try {
            const response = await this.pos.connect(portPath);
            if (!response) {
                throw new Error('Respuesta indefinida al conectar');
            }
            this.connectedPort = Object.assign({ path: portPath }, response);
            return true;
        } catch (err) {
            console.error('Ocurrió un error al conectar con el POS:', err.message || 'Error desconocido');
            this.connectedPort = null;
            return false;
        }
    }

    async autoConnect() {
        try {
            const response = await this.pos.autoconnect();
            this.connectedPort = Object.assign({ path: portPath }, response);
            return true;
        } catch (err) {
            console.error('Ocurrió un error al autoconectar con el POS:', err.message);
            this.connectedPort = null;
            return false;
        }
    }

    async closeConnection() {
        if (!this.connectedPort) {
            console.log("No hay conexión activa para cerrar");
            return false;
        }

        try {
            await this.pos.disconnect();
            console.log('Conexión con POS cerrada correctamente');
            this.connectedPort = null;
            return true;
        } catch (error) {
            console.log('Error al cerrar conexión con POS:', error.message);
        }
    }

    async closeDay() {
        try {
            const response = await this.pos.closeDay();
            return { success: true, data: response };
        } catch (error) {
            console.error("Error cerrando día:", error.message);
            throw error;
        }
    }

    async getLastSale() {
        try {
            const response = await this.pos.getLastSale();
            return { success: true, data: response };
        } catch (error) {
            console.error("Error obteniendo última venta:", error.message);
            throw error;
        }
    }

    async getTotals() {
        try {
            const response = await this.pos.getTotals();
            return { success: true, data: response };
        } catch (error) {
            console.error("Error obteniendo totales:", error.message);
            throw error;
        }
    }

    async salesDetail(printOnPos = false) {
        try {
            const response = await this.pos.salesDetail(printOnPos);
            return { success: true, data: response };
        } catch (error) {
            console.error("Error obteniendo detalle de ventas:", error.message);
            throw error;
        }
    }

    async refund(operationId) {
        try {
            const response = await this.pos.refund(operationId);
            return { success: true, data: response };
        } catch (error) {
            console.error("Error realizando reversa:", error.message);
            throw error;
        }
    }

    async sale(amount, ticket, sendStatus = false, callback = null) {
        try {
            if (!this.connectedPort) {
                throw new Error('POS no conectado');
            }

            const response = await this.pos.sale(amount, ticket, sendStatus, callback);

            if (!response || typeof response !== 'object') {
                throw new Error('Respuesta inválida del POS');
            }

            return { success: true, data: response };
        } catch (error) {
            console.error("Error procesando venta:", error.message);
            return {
                success: false,
                error: error.message,
                shouldReconnect: error.message.includes('desconectado')
            };
        }
    }

    async send(payload, waitResponse = true, callback = null) {
        try {
            const response = await this.pos.send(payload, waitResponse, callback);
            return { success: true, data: response };
        } catch (error) {
            console.error("Error enviando comando:", error.message);
            throw error;
        }
    }

    async getTxStatus() {
        try {
            const response = await this.pos.getTxStatus();
            return { success: true, data: response };
        } catch (error) {
            console.error("Error obteniendo estado de transacción:", error.message);
            throw error;
        }
    }
}

module.exports = new TransbankService();
