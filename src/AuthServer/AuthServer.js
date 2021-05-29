let net = require('net');

// User define
let Config = invoke('Config');
let Database = invoke('Database');
let AuthServerSession = invoke('AuthServer/AuthServerSession');
let AuthServerMethods = invoke('AuthServer/AuthServerMethods');

class AuthServer {
    constructor() {
        // Start with db
        Database.connection();

        // Proceed with sockets
        let host = Config.loginServer.host;
        let port = Config.loginServer.port;

        net.createServer(this.onSocket).listen(port, host, () => {
            console.log('LS:: listening on %s:%s', host, port);
        });
    }

    onSocket(socket) {
        console.log('LS:: incoming connection from %s:%s', socket.remoteAddress, socket.remotePort);
        //socket.setEncoding('binary');

        let session = new AuthServerSession(socket);
        socket.on('data', session.receiveData.bind(session));
        socket.on('close', session.connectionClosed.bind(session));
        socket.on('error', session.connectionError.bind(session));

        session.sendData(AuthServerMethods.init(), false);
    }
}

module.exports = AuthServer;