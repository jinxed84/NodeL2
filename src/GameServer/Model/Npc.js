const CreatureModel = invoke('GameServer/Model/Creature');

class NpcModel extends CreatureModel {

    // Set

    setStateRun(data) {
        this.model.stateRun = data;
    }

    setStateAttack(data) {
        this.model.stateAttack = data;
    }

    setStateDead(data) {
        this.model.stateDead = data;
    }

    setStateInvisible(data) {
        this.model.stateInvisible = data;
    }

    // Get

    fetchSelfId() {
        return this.model.selfId;
    }

    fetchKind() {
        return this.model.kind;
    }

    fetchHostile() {
        return this.model.hostile;
    }

    fetchAtkRadius() {
        return this.model.atkRadius;
    }

    fetchRevHp() {
        return this.model.revHp;
    }

    fetchRevMp() {
        return this.model.revMp;
    }

    fetchWeapon() {
        return this.model.weapon;
    }

    fetchShield() {
        return this.model.shield;
    }

    fetchArmor() {
        return this.model.armor;
    }

    fetchRewardExp() {
        return this.model.exp;
    }

    fetchRewardSp() {
        return this.model.sp;
    }

    fetchStateRun() {
        return this.model.stateRun;
    }

    fetchStateAttack() {
        return this.model.stateAttack;
    }

    fetchStateDead() {
        return this.model.stateDead;
    }

    fetchStateInvisible() {
        return this.model.stateInvisible;
    }

    // Abstract

    fetchDispSelfId() {
        return this.fetchSelfId() + 1000000;
    }

    fetchAttackable() {
        return this.model.kind === 'Monster' || this.model.kind === 'Boss';
    }
}

module.exports = NpcModel;
