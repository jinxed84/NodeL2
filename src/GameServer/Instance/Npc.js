const NpcModel = invoke('GameServer/Model/Npc');

class Npc extends NpcModel {
    constructor(id, data) {
        // Parent inheritance
        super(data);

        // Specific
        this.setId(id);
        this.setHp(utils.randomNumber(this.fetchMaxHp()));
        this.setMp(utils.randomNumber(this.fetchMaxMp()));

        this.replenishHp = setInterval(() => {
            const value = this.fetchHp() + 3;
            const max   = this.fetchMaxHp();

            this.setHp(Math.min(value, max));
        }, 3500);
    }

    destructor() {
        clearInterval(this.replenishHp);
    }
}

module.exports = Npc;
