var transbankService = require('../services/transbankService');
var responseHandler = require('../utils/responseHandler');

exports.getStatus = function (req, res) {
  return responseHandler.success(res, 'Estado de conexión', {
    connected: transbankService.deviceConnected,
    port: transbankService.connection && transbankService.connection.path ? transbankService.connection.path : null,
    status: transbankService.deviceConnected ? 'Conectado' : 'Desconectado'
  });
};

exports.listPorts = async function (req, res) {
  try {
    var ports = await transbankService.listAvailablePorts();
    responseHandler.success(res, 'Puertos disponibles', ports);
  } catch (err) {
    responseHandler.error(res, 'Error al listar puertos', 500, 'PORT_LIST_ERROR', {
      detail: err.message
    });
  }
};

exports.connectPort = async function (req, res) {
  var portPath = req.body.portPath;
  if (!portPath) {
    return responseHandler.error(res, 'Debe proporcionar un puerto', 400, 'MISSING_PORT');
  }

  try {
    var result = await transbankService.connectToPort(portPath);
    if (!result) {
      return responseHandler.error(res, 'No se pudo conectar al puerto', 500, 'PORT_CONNECTION_FAILED');
    }

    // Intentar cargar llaves automáticamente
    try {
      await transbankService.loadKey();
      responseHandler.success(res, 'Conectado al puerto y llaves cargadas', {
        port: portPath,
        keysLoaded: true
      });
    } catch (keyError) {
      responseHandler.success(res, 'Conectado al puerto pero no se cargaron las llaves', {
        port: portPath,
        keysLoaded: false,
        warning: keyError.message
      });
    }
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'CONNECTION_ERROR');
  }
};

exports.autoConnect = async function (req, res) {
  try {
    var connected = await transbankService.autoConnect();
    if (!connected) {
      return responseHandler.error(res, 'No se pudo autoconectar', 500, 'AUTOCONNECT_FAILED');
    }

    // Intentar cargar llaves automáticamente
    try {
      await transbankService.loadKey();
      responseHandler.success(res, 'Autoconectado y llaves cargadas', {
        port: transbankService.connection && transbankService.connection.path ? transbankService.connection.path : null,
        keysLoaded: true
      });
    } catch (keyError) {
      responseHandler.success(res, 'Autoconectado pero no se cargaron las llaves', {
        port: transbankService.connection && transbankService.connection.path ? transbankService.connection.path : null,
        keysLoaded: false,
        warning: keyError.message
      });
    }
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'AUTOCONNECT_ERROR');
  }
};

exports.disconnect = async function (req, res) {
  try {
    var result = await transbankService.closeConnection();
    if (!result) {
      return responseHandler.error(res, 'No había conexión activa', 400, 'NO_ACTIVE_CONNECTION');
    }
    responseHandler.success(res, 'Desconectado del POS correctamente');
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'DISCONNECT_ERROR');
  }
};

exports.loadKeys = async function (req, res) {
  try {
    var result = await transbankService.loadKey();
    responseHandler.success(res, result.message, result);
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'LOAD_KEYS_ERROR', {
      detail: err.message
    });
  }
};

exports.poll = async function (req, res) {
  try {
    var alive = await transbankService.isAlive();
    responseHandler.success(res, 'Estado del POS', {
      alive: alive,
      port: transbankService.connection && transbankService.connection.path ? transbankService.connection.path : null
    });
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'POLL_ERROR');
  }
};

exports.closeDay = async function (req, res) {
  try {
    var response = await transbankService.closeDay();
    responseHandler.success(res, 'Cierre de día ejecutado', response);
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'CLOSE_DAY_ERROR', {
      detail: err.message
    });
  }
};

exports.getLastTransaction = async function (req, res) {
  try {
    var response = await transbankService.getLastSale();
    var data = response.data;

    var formattedResponse = {
      approved: data.successful,
      operationNumber: data.operationNumber,
      amount: data.amount,
      cardNumber: data.last4Digits ? '••••' + data.last4Digits : null,
      authorizationCode: data.authorizationCode,
      timestamp: data.realDate && data.realTime ? data.realDate + ' ' + data.realTime : null,
      cardType: data.cardType,
      cardBrand: data.cardBrand
    };

    responseHandler.success(res, 'Última transacción obtenida', formattedResponse);
  } catch (error) {
    responseHandler.error(res, 'Error al obtener la transacción', 500, 'LAST_TXN_FAILED', {
      detail: error.message,
      stack: error.stack
    });
  }
};

exports.getTotals = async function (req, res) {
  try {
    var response = await transbankService.getTotals();
    responseHandler.success(res, 'Totales obtenidos', response.data);
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'GET_TOTALS_ERROR');
  }
};

exports.salesDetail = async function (req, res) {
  try {
    var printOnPos = req.query.print === 'true';
    var response = await transbankService.salesDetail(printOnPos);
    responseHandler.success(res, 'Detalle de ventas obtenido', response.data);
  } catch (err) {
    responseHandler.error(res, err.message, 500, 'SALES_DETAIL_ERROR');
  }
};
