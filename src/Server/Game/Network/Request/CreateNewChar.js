const ServerResponse = invoke('Server/Game/Network/Response');
const DataCache      = invoke('Server/Game/DataCache');
const ReceivePacket  = invoke('Server/Packet/Receive');
const Database       = invoke('Server/Database');

function createNewChar(session, buffer) {
    const packet = new ReceivePacket(buffer);

    packet
        .readS()  // Name
        .readD()  // Race
        .readD()  // Sex
        .readD()  // Class ID
        .readD()  // Int (constant 0?)
        .readD()  // Str (constant 0?)
        .readD()  // Con (constant 0?)
        .readD()  // Men (constant 0?)
        .readD()  // Dex (constant 0?)
        .readD()  // Wit (constant 0?)
        .readD()  // Hair
        .readD()  // Hair Color
        .readD(); // Face

    consume(session, {
             name: packet.data[ 0],
             race: packet.data[ 1],
              sex: packet.data[ 2],
          classId: packet.data[ 3],
             hair: packet.data[10],
        hairColor: packet.data[11],
             face: packet.data[12],
    });
}

function consume(session, data) {
    DataCache.fetchClassInformation(data.classId).then((classInfo) => {
        const points = classInfo.bornAt;
        const coords = points[utils.randomNumber(points.length)];

        data = {
            ...data, ...classInfo.vitals, ...coords
        };

        Database.createCharacter(session.accountId, data).then(() => {
            session.dataSend(
                ServerResponse.charCreateSuccess()
            );

            Database.fetchCharacters(session.accountId).then((userChars) => {
                const last = userChars.slice(-1)[0];
                awardBaseSkills(last.id, last.classId);
                awardBaseGear  (last.id, last.classId);

                session.dataSend(
                    ServerResponse.charSelectInfo(userChars)
                );
            });
        });
    });
}

function awardBaseSkills(id, classId) {
    const item   = DataCache.skillTree.find(ob => ob.classId === classId);
    const level1 = item?.skills.filter(ob => ob.pLevel === 1);

    if (level1) {
        for (let skill of level1) {
            skill.passive = DataCache.skills.find(ob => ob.id === skill.id)?.passive ?? true;
            Database.setSkill(skill, id);
        }
        return;
    }

    utils.infoWarn('GameServer:: first run, level 1 skills not found for ClassId ' + classId);
}

function awardBaseGear(id, classId) {
    utils.infoWarn('GameServer:: first run, items not found for ClassId ' + classId);
}

module.exports = createNewChar;
