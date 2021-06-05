let ClientPacket = invoke('ClientPacket');
let GameServerResponse = invoke('GameServer/GameServerResponse');
let World = invoke('GameServer/World');

function enterWorld(session, buffer) {
    let packet = new ClientPacket(buffer);

    packet
        .readC();

    let data = {
    };

    session.sendData(
        GameServerResponse.sunrise()
    );

    session.sendData(
        GameServerResponse.userInfo(session.player)
    );

    // Samples
    World.insertPlayer(session);
    World.insertNpcs(session);
    World.insertItems(session);
}

module.exports = enterWorld;
