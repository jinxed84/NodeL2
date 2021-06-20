let ClientRequest = invoke('GameServer/Request');
let Utils         = invoke('Utils');

class Session {
    constructor(socket) {
        this.socket = socket;
    }

    receiveData(data) {
        let decryptedPacket = Buffer.from(data).slice(2);

        // Opcodes
        switch (decryptedPacket[0]) {
            case 0x00:
                ClientRequest.protocolVersion(this, decryptedPacket);
                break;

            default:
                console.log('GameServer:: unknown opcode 0x%s', Utils.toHex(decryptedPacket[0], 2));
                break;
        }
    }

    sendData(data) {
        let header = Buffer.alloc(2);
        header.writeInt16LE(data.length + 2);

        this.socket.write(
            Buffer.concat([header, data])
        );
    }
}

module.exports = Session;
