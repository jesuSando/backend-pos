const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require("./routes/posRoutes");
const transbankService = require("./services/transbankService");
const { initializePOS } = require("./utils/posConnect")

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', routes);

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, function () {
    console.log('Servidor corriendo en http://localhost:' + PORT);
});

let connectionMonitor = null;

async function startPOSConnection() {
    const result = await initializePOS();

    if (result.success) {
        console.log(`[POS] ${result.message}`);

        connectionMonitor = monitorConnection(async () => {
            console.log('[POS] Reconectando...');
            await sleep(5000);
            startPOSConnection();
        });

        connectionMonitor.start();
    } else {
        console.error(`[POS] Error: ${result.reason}`);
        console.log('[POS] Reintentando en 10 segundos...');
        setTimeout(startPOSConnection, 10000);
    }
}

setTimeout(startPOSConnection, 10000);

// Manejo de cierre
process.on('SIGINT', async () => {
    if (connectionMonitor) connectionMonitor.stop();
    await transbankService.closeConnection();
    process.exit(0);
});