var transbankService = require('../services/transbankService');
var responseHandler = require('../utils/responseHandler');

exports.processPayment = async function (req, res) {
    try {
        var amount = req.body.amount;
        var ticketNumber = req.body.ticketNumber;

        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Monto inválido');
        }

        if (!ticketNumber || typeof ticketNumber !== 'string') {
            throw new Error('Número de ticket/boleta inválido');
        }

        var response = await transbankService.sale(amount, ticketNumber);
        var data = response.data;

        var formattedResponse = {
            approved: data.successful,
            operationId: data.operationNumber,
            amount: data.amount,
            cardNumber: data.last4Digits ? '••••' + data.last4Digits : null,
            authorizationCode: data.authorizationCode,
            timestamp: new Date().toISOString()
        };

        responseHandler.success(res, 'Pago procesado', formattedResponse);
    } catch (error) {
        var message = (error.message || '').toLowerCase();
        var isUserCancelled = message.indexOf('cancelada') !== -1 || message.indexOf('cancelado') !== -1;
        var isPosDisconnected = message.indexOf('no se pudo conectar') !== -1 ||
            message.indexOf('pos no conectado') !== -1 ||
            message.indexOf('pos desconectado') !== -1;

        var statusCode = (isUserCancelled || isPosDisconnected) ? 400 : 500;
        var errorCode = isUserCancelled ? 'USER_CANCELLED'
            : isPosDisconnected ? 'POS_DISCONNECTED'
                : (error.responseCode || 'UNKNOWN');

        var userMessage = isUserCancelled
            ? 'Transacción cancelada por el usuario'
            : isPosDisconnected
                ? 'El POS no está conectado'
                : 'Error al procesar el pago';

        responseHandler.error(res, userMessage, statusCode, errorCode, {
            detail: error.message
        });
    }
};

exports.processRefund = async function (req, res) {
    try {
        var amount = req.body.amount;
        var originalOperationNumber = req.body.originalOperationNumber;

        if (!amount || isNaN(amount) || amount <= 0) {
            return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
        }

        if (!originalOperationNumber) {
            return responseHandler.error(res, 'Número de operación original requerido', 400, 'MISSING_ORIGINAL_OPERATION');
        }

        var response = await transbankService.refund(originalOperationNumber);
        var data = response.data;

        var formattedResponse = {
            success: data.successful,
            operationId: data.operationNumber,
            amount: data.amount,
            originalOperation: originalOperationNumber,
            timestamp: new Date().toISOString()
        };

        responseHandler.success(res, 'Reversa exitosa', formattedResponse);
    } catch (error) {
        responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN', {
            detail: error.message
        });
    }
};

exports.getTxStatus = async function (req, res) {
    try {
        var response = await transbankService.getTxStatus();
        responseHandler.success(res, 'Estado de transacción', response.data);
    } catch (error) {
        responseHandler.error(res, error.message, 500, 'TX_STATUS_ERROR');
    }
};
