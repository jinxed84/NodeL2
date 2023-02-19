const SQL = require('like-sql'), builder = new SQL();

let conn;

const Database = {
    init: (callback) => {
        const optn = options.connection.Database;

        require('mariadb').createConnection({
            host     : optn.hostname,
            port     : optn.port,
            user     : optn.user,
            password : optn.password,
            database : optn.databaseName

        }).then((instance) => {
            utils.infoSuccess('DB:: connected');
            conn = instance;
            callback();

        }).catch(error => {
            utils.infoFail('DB:: failed(%d) -> %s', error.errno, error.text);
        });
    },

    execute: (sql) => {
        return conn.query(sql[0], sql[1]);
    },

    // Creates a `New Account` in the database with provided credentials
    createAccount: (username, password) => {
        return Database.execute(
            builder.insert('accounts', {
                username: username,
                password: password
            })
        );
    },

    // Returns the `Password` from a provided account
    fetchUserPassword: (username) => {
        return Database.execute(
            builder.selectOne('accounts', ['password'], 'username = ?', username)
        );
    },

    // Returns the `Characters` stored on a user's account
    fetchCharacters: (username) => {
        return Database.execute(
            builder.select('characters', ['*'], 'username = ?', username)
        );
    },

    // Stores a new `Character` in database with provided details
    createCharacter(username, data) {
        return Database.execute(
            builder.insert('characters', {
                 username: username,
                     name: data.name,
                     race: data.race,
                  classId: data.classId,
                    maxHp: data.maxHp,
                    maxMp: data.maxMp,
                      sex: data.sex,
                     face: data.face,
                     hair: data.hair,
                hairColor: data.hairColor,
                     locX: data.locX,
                     locY: data.locY,
                     locZ: data.locZ,
            })
        );
    },

    deleteCharacter(username, name) {
        return Database.execute(
            builder.delete('characters', 'username = ? AND name = ?', username, name)
        );
    },

    setSkill(skill, characterId) {
        return Database.execute(
            builder.insert('skills', {
                    skillId: skill.id,
                characterId: characterId,
                       name: skill.name,
                    passive: skill.passive,
                      level: skill.level
            })
        );
    },

    fetchSkills(characterId) {
        return Database.execute(
            builder.select('skills', ['*'], 'characterId = ?', characterId)
        );
    },

    deleteSkills(characterId) {
        return Database.execute(
            builder.delete('skills', 'characterId = ?', characterId)
        );
    },

    setItem(item, characterId) {
        return Database.execute(
            builder.insert('items', {
                     itemId: item.itemId,
                characterId: characterId,
                       name: item.name,
                   equipped: item.equipped,
                       slot: item.slot
            })
        );
    },

    fetchItems(characterId) {
        return Database.execute(
            builder.select('items', ['*'], 'characterId = ?', characterId)
        );
    },

    deleteItems(characterId) {
        return Database.execute(
            builder.delete('items', 'characterId = ?', characterId)
        );
    },

    setShortcut(characterId, shortcut) {
        return Database.execute(
            builder.insert('shortcuts', {
                    worldId: shortcut.worldId,
                characterId: characterId,
                       kind: shortcut.kind,
                       slot: shortcut.slot,
                    unknown: shortcut.unknown,
            })
        );
    },

    fetchShortcuts(characterId) {
        return Database.execute(
            builder.select('shortcuts', ['*'], 'characterId = ?', characterId)
        );
    },

    deleteShortcuts(characterId) {
        return Database.execute(
            builder.delete('shortcuts', 'characterId = ?', characterId)
        );
    },

    updateCharacterLocation(id, coords) {
        return Database.execute(
            builder.update('characters', {
                locX: coords.locX,
                locY: coords.locY,
                locZ: coords.locZ,
                head: coords.head,
            }, 'id = ? LIMIT 1', id)
        );
    }
};

module.exports = Database;
