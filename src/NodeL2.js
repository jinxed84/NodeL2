require('./Globals');

// User imports
const AuthSession = invoke('Server/Auth/Session');
const GameSession = invoke('Server/Game/Session');
const DataCache   = invoke('Server/Game/DataCache');
const Database    = invoke('Server/Database');
const Server      = invoke('Server/Server');

console.info('\n\
    + ================================== \n\
    # Server Name: ......... NodeL2      \n\
    # Build Revision: ...... %s          \n\
    # Chronicle: ........... C2 [485]    \n\
    # Build date: .......... %s          \n\
    # NodeJS version: ...... %s          \n\
    + ================================== \n\
', utils.buildNumber(), utils.currentDate(), utils.nodeVersion());

// Startup procedure, first `Database`, then `AuthServer`, finally `GameServer`
Database.init(() => {
    DataCache.init();

    new Server('AuthServer', options.connection.AuthServer, (socket) => {
        return new AuthSession(socket);
    });

    new Server('GameServer', options.connection.GameServer, (socket) => {
        return new GameSession(socket);
    });
});
