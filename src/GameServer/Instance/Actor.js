const ServerResponse = invoke('GameServer/Network/Response');
const ActorModel     = invoke('GameServer/Model/Actor');
const Automation     = invoke('GameServer/Instance/Automation');
const Attack         = invoke('GameServer/Instance/Attack');
const Skillset       = invoke('GameServer/Instance/Skillset');
const Backpack       = invoke('GameServer/Instance/Backpack');
const World          = invoke('GameServer/World');
const Formulas       = invoke('GameServer/Formulas');

class Actor extends ActorModel {
    constructor(session, data) {
        // Parent inheritance
        super(data);

        // Local
        this.automation = new Automation();
        this.attack     = new Attack();
        this.skillset   = new Skillset();
        this.backpack   = new Backpack(data);
        this.session    = session;

        delete this.model.items;
        delete this.model.paperdoll;
    }

    destructor() {
        invoke('GameServer/Generics').unselect(this.session, this);
        this.clearStoredActions();
        this.attack.destructor();
        this.automation.destructor(this);
    }

    queueRequest(event, data) {
        if (this.state.fetchHits() || this.state.fetchCasts()) {
            this.attack.queueEvent(event, data);
        }
    }

    clearStoredActions() {
        this.storedAttack = undefined;
        this.storedSpell  = undefined;
        this.storedPickup = undefined;
    }

    requestStopAutomation() {
        this.automation.abortAll(this);

        this.session.dataSend(
            ServerResponse.stopMove(this.fetchId(), {
                locX: this.fetchLocX(),
                locY: this.fetchLocY(),
                locZ: this.fetchLocZ(),
                head: this.fetchHead(),
            })
        );
    }

    npcDied(npc) {
        World.removeNpc(this.session, npc);

        if (this.isDead() === false) {
            invoke('GameServer/Generics').experienceReward(this.session, this, npc.fetchRewardExp(), npc.fetchRewardSp());
        }
    }

    // State

    isBlocked() {
        if (this.state.isBlocked()) {
            this.session.dataSend(ServerResponse.actionFailed());
            return true;
        }
        return false;
    }

    isDead() {
        if (this.state.fetchDead()) {
            this.session.dataSend(ServerResponse.actionFailed());
            return true;
        }
        return false;
    }

    // Calculate stats

    setCollectiveTotalHp() {
        const base = Formulas.calcHp(this.fetchLevel(), this.fetchClassId(), this.fetchCon());
        this.setMaxHp(base);
        this.setHp(Math.min(this.fetchHp(), this.fetchMaxHp()));
    }

    setCollectiveTotalMp() { // TODO: Fix hardcoded class transfer parameter
        const base  = Formulas.calcMp(this.fetchLevel(), this.isSpellcaster(), 0, this.fetchMen());
        const bonus = this.backpack.fetchTotalArmorBonusMp();
        this.setMaxMp(base + bonus);
        this.setMp(Math.min(this.fetchMp(), this.fetchMaxMp()));
    }

    setCollectiveTotalLoad() {
        const base = Formulas.calcMaxLoad(this.fetchCon());
        this.setMaxLoad(base);
        this.setLoad(this.backpack.fetchTotalLoad());
    }

    setCollectiveTotalPAtk() {
        const pAtk = this.backpack.fetchTotalWeaponPAtk() ?? this.fetchPAtk();
        const base = Formulas.calcPAtk(this.fetchLevel(), this.fetchStr(), pAtk);
        this.setCollectivePAtk(base);
    }

    setCollectiveTotalMAtk() {
        const mAtk = this.backpack.fetchTotalWeaponMAtk() ?? this.fetchMAtk();
        const base = Formulas.calcMAtk(this.fetchLevel(), this.fetchInt(), mAtk);
        this.setCollectiveMAtk(base);
    }

    setCollectiveTotalPDef() {
        const pDef = this.backpack.fetchTotalArmorPDef(this.isSpellcaster()) ?? this.fetchPDef();
        const base = Formulas.calcPDef(this.fetchLevel(), pDef);
        this.setCollectivePDef(base);
    }

    setCollectiveTotalMDef() {
        const mDef = this.backpack.fetchTotalArmorMDef() ?? this.fetchMDef();
        const base = Formulas.calcMDef(this.fetchLevel(), this.fetchMen(), mDef);
        this.setCollectiveMDef(base);
    }

    setCollectiveTotalAccur() {
        const accur = this.backpack.fetchTotalWeaponAccur() ?? this.fetchAccur();
        const base  = Formulas.calcAccur(this.fetchLevel(), this.fetchDex(), accur);
        this.setCollectiveAccur(base);
    }

    setCollectiveTotalEvasion() {
        const evasion = this.backpack.fetchTotalArmorEvasion() ?? this.fetchEvasion();
        const base    = Formulas.calcEvasion(this.fetchLevel(), this.fetchDex(), evasion);
        this.setCollectiveEvasion(base);
    }

    setCollectiveTotalCritical() {
        const critical = this.backpack.fetchTotalWeaponCritical() ?? this.fetchCritical();
        const base    = Formulas.calcCritical(this.fetchDex(), critical);
        this.setCollectiveCritical(base);
    }

    setCollectiveTotalAtkSpd() {
        const atkSpd = this.backpack.fetchTotalWeaponAtkSpd() ?? this.fetchAtkSpd();
        const base   = Formulas.calcAtkSpd(this.fetchDex(), atkSpd);
        this.setCollectiveAtkSpd(base);
    }

    setCollectiveTotalCastSpd() {
        const base = Formulas.calcCastSpd(this.fetchWit());
        this.setCollectiveCastSpd(base);
    }

    setCollectiveTotalWalkSpd() {
        const base = Formulas.calcSpeed(this.fetchDex());
        this.setCollectiveWalkSpd(base);
    }

    setCollectiveTotalRunSpd() {
        const base = Formulas.calcSpeed(this.fetchDex());
        this.setCollectiveRunSpd(base);
    }

    setCollectiveAll() {
        this.setCollectiveTotalHp();
        this.setCollectiveTotalMp();
        this.setCollectiveTotalLoad();
        this.setCollectiveTotalPAtk();
        this.setCollectiveTotalMAtk();
        this.setCollectiveTotalPDef();
        this.setCollectiveTotalMDef();
        this.setCollectiveTotalAccur();
        this.setCollectiveTotalEvasion();
        this.setCollectiveTotalCritical();
        this.setCollectiveTotalAtkSpd();
        this.setCollectiveTotalCastSpd();
        this.setCollectiveTotalWalkSpd();
        this.setCollectiveTotalRunSpd();
    }

    // Update stats

    statusUpdateLevelExpSp(creature) {
        this.session.dataSend(
            ServerResponse.statusUpdate(creature.fetchId(), [
                { id: 0x1, value: creature.fetchLevel() },
                { id: 0x2, value: creature.fetchExp  () },
                { id: 0xd, value: creature.fetchSp   () },
            ])
        );
    }

    statusUpdateVitals(creature) {
        this.session.dataSend(
            ServerResponse.statusUpdate(creature.fetchId(), [
                { id: 0x9, value: creature.fetchHp   () },
                { id: 0xa, value: creature.fetchMaxHp() },
                { id: 0xb, value: creature.fetchMp   () },
                { id: 0xc, value: creature.fetchMaxMp() },
            ])
        );
    }

    statusUpdateStats(creature) {
        this.session.dataSend(
            ServerResponse.statusUpdate(creature.fetchId(), [
                { id: 0x11, value: creature.fetchCollectivePAtk  () },
                { id: 0x17, value: creature.fetchCollectiveMAtk  () },
                { id: 0x12, value: creature.fetchCollectiveAtkSpd() },
            ])
        );
    }
}

module.exports = Actor;
