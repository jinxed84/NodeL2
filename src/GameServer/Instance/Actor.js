const ServerResponse = invoke('GameServer/Network/Response');
const ActorModel     = invoke('GameServer/Model/Actor');
const Automation     = invoke('GameServer/Instance/Automation');
const Attack         = invoke('GameServer/Instance/Attack');
const Skillset       = invoke('GameServer/Instance/Skillset');
const Backpack       = invoke('GameServer/Instance/Backpack');
const DataCache      = invoke('GameServer/DataCache');
const World          = invoke('GameServer/World');
const ConsoleText    = invoke('GameServer/ConsoleText');
const Formulas       = invoke('GameServer/Formulas');
const Database       = invoke('Database');

class Actor extends ActorModel {
    constructor(data) {
        // Parent inheritance
        super(data);

        // Local
        this.automation = new Automation();
        this.attack     = new Attack();
        this.skillset   = new Skillset();
        this.backpack   = new Backpack(data);
        this.destId     = undefined;

        delete this.model.items;
        delete this.model.paperdoll;
    }

    enterWorld(session) {
        // Calculate accumulated
        this.setCollectiveAll();
        this.skillset.populate(this);

        // Start vitals replenish
        this.automation.replenishVitals(session, this);

        // Show npcs based on radius
        this.updatePosition(session, {
            locX: this.fetchLocX(),
            locY: this.fetchLocY(),
            locZ: this.fetchLocZ(),
            head: this.fetchHead(),
        });

        // Default
        ConsoleText.transmit(session, ConsoleText.caption.welcome);
    }

    destructor() {
        this.automation.destructor();
    }

    moveTo(session, coords) {
        if (this.isBlocked(session)) {
            if (this.state.fetchCombats() || this.state.fetchCasts()) {
                this.attack.queueEvent('move', coords);
            }
            return;
        }

        // Abort scheduled movement, user redirected the actor
        this.automation.abortAll(this);
        session.dataSend(ServerResponse.moveToLocation(this.fetchId(), coords));
    }

    updatePosition(session, coords) {
        // TODO: Write less in DB about movement
        this.setLocXYZH(coords);
        Database.updateCharacterLocation(this.fetchId(), coords);

        // Render npcs found inside user's radius
        const inRadiusNpcs = World.npc.spawns.filter(ob => Formulas.calcWithinRadius(coords.locX, coords.locY, ob.fetchLocX(), ob.fetchLocY(), 3500)) ?? [];
        inRadiusNpcs.forEach((npc) => {
            session.dataSend(ServerResponse.npcInfo(npc));
        });

        // Reschedule attacks based on updated position
        if (this.destId && this.storedAttack) {
            this.attackFinish(session, structuredClone(this.storedAttack));
            this.storedAttack = undefined;
        }

        if (this.destId && this.storedSpell) {
            this.skillFinish(session, structuredClone(this.storedSpell));
            this.storedSpell = undefined;
        }

        // Reschedule smooth pick-up
        if (this.storedPickup) {
            World.fetchItem(this.storedPickup.id).then((item) => {
                this.automation.schedulePickup(session, this, item, () => {
                    session.dataSend(ServerResponse.pickupItem(this.fetchId(), item));
                });
            }).catch((err) => {
                utils.infoWarn('GameServer :: Pickup Finish -> ' + err);
            });
            this.storedPickup = undefined;
        }
    }

    select(session, data) {
        if (this.fetchId() === data.id) { // Click on self
            this.destId = this.fetchId();
            session.dataSend(ServerResponse.destSelected(this.destId));
            return;
        }

        World.fetchNpc(data.id).then((npc) => { // Creature selected
            if (npc.fetchId() !== this.destId) { // First click on a Creature
                this.destId = npc.fetchId();
                session.dataSend(ServerResponse.destSelected(this.destId, this.fetchLevel() - npc.fetchLevel()));
                this.statusUpdateVitals(session, npc);
            }
            else { // Second click on same Creature
                this.attackAction(session, data);
            }
        }).catch(() => { // Pickup item
            this.pickupAction(session, data);
        });
    }

    requestPreciseLocation(session) {
        session.dataSend(
            ServerResponse.stopMove(this.fetchId(), {
                locX: this.fetchLocX(),
                locY: this.fetchLocY(),
                locZ: this.fetchLocZ(),
                head: this.fetchHead(),
            })
        );
    }

    unselect(session) {
        this.destId = undefined;
        session.dataSend(ServerResponse.destDeselected(this));
    }

    attackAction(session, data) {
        if (this.isBlocked(session)) {
            if (this.state.fetchCombats() || this.state.fetchCasts()) {
                this.attack.queueEvent('attack', data);
            }
            return;
        }

        if (this.state.fetchAtkMelee()) {
            return;
        }

        this.storedAttack = data;
        this.automation.abortScheduledAtkRemote(this);
        this.automation.abortScheduledPickup   (this);
        this.requestPreciseLocation(session);
    }

    attackFinish(session, data) {
        World.fetchNpc(data.id).then((npc) => {
            this.automation.scheduleAtkMelee(session, this, npc, 0, () => {
                if (npc.fetchAttackable() || data.ctrl) {
                    this.attack.meleeHit(session, npc);
                }
                else {
                    World.npcTalk(session, npc);
                }
            });
        }).catch((err) => {
            utils.infoWarn('GameServer :: Attack Finish -> ' + err);
        });
    }

    skillAction(session, data) {
        if ((data.id = this.destId) === undefined) {
            return;
        }

        if (this.isBlocked(session)) {
            if (this.state.fetchCombats() || this.state.fetchCasts()) {
                this.attack.queueEvent('spell', data);
            }
            return;
        }

        if (this.state.fetchAtkRemote()) {
            return;
        }

        this.storedSpell = data;
        this.automation.abortScheduledAtkMelee(this);
        this.automation.abortScheduledPickup  (this);
        this.requestPreciseLocation(session);
    }

    skillFinish(session, data) {
        World.fetchNpc(data.id).then((npc) => {
            const skill = this.skillset.fetchSkill(data.selfId);
            this.automation.scheduleAtkRemote(session, this, npc, skill.fetchDistance(), () => {
                if (npc.fetchAttackable() || data.ctrl) { // TODO: Else, find which `response` fails the attack
                    this.attack.remoteHit(session, npc, skill);
                }
            });
        }).catch((err) => {
            utils.infoWarn('GameServer :: Skill Finish -> ' + err);
        });
    }

    pickupAction(session, data) {
        if (this.isBlocked(session)) {
            if (this.state.fetchCombats() || this.state.fetchCasts()) {
                this.attack.queueEvent('pickup', data);
            }
            return;
        }

        if (this.state.fetchPickinUp()) {
            return;
        }

        this.storedPickup = data;
        this.automation.abortScheduledAtkMelee (this);
        this.automation.abortScheduledAtkRemote(this);
        this.requestPreciseLocation(session);
    }

    basicAction(session, data) {
        if (this.state.inMotion()) {
            return;
        }

        switch (data.actionId) {
        case 0x00: // Sit / Stand
            if (this.state.fetchCasts() || this.state.fetchCombats() || this.state.fetchAnimated()) {
                if (this.state.fetchCombats() || this.state.fetchCasts()) {
                    this.attack.queueEvent('sit', data);
                }
                return;
            }

            this.state.setAnimated(true);
            this.state.setSeated(!this.state.fetchSeated());
            session.dataSend(ServerResponse.sitAndStand(this));

            setTimeout(() => {
                this.state.setAnimated(false);
            }, 2500);
            break;

        case 0x01: // Walk / Run
            this.state.setWalkin(!this.state.fetchWalkin());
            session.dataSend(
                ServerResponse.walkAndRun(this)
            );
            break;

        case 0x28: // Recommend without selection
            break;

        default:
            utils.infoWarn('GameServer :: unknown basic action 0x%s', utils.toHex(data.actionId));
            break;
        }
    }

    socialAction(session, actionId) {
        if (this.isBlocked(session)) {
            return;
        }

        if (this.state.inMotion()) {
            return;
        }

        this.automation.abortAll(this);
        session.dataSend(ServerResponse.socialAction(this.fetchId(), actionId));
    }

    isBlocked(session) {
        if (this.state.isBlocked()) {
            session.dataSend(ServerResponse.actionFailed());
            return true;
        }
        return false;
    }

    statusUpdateLevelExpSp(session, creature) {
        session.dataSend(
            ServerResponse.statusUpdate(creature.fetchId(), [
                { id: 0x1, value: creature.fetchLevel() },
                { id: 0x2, value: creature.fetchExp  () },
                { id: 0xd, value: creature.fetchSp   () },
            ])
        );
    }

    statusUpdateVitals(session, creature) {
        session.dataSend(
            ServerResponse.statusUpdate(creature.fetchId(), [
                { id: 0x9, value: creature.fetchHp   () },
                { id: 0xa, value: creature.fetchMaxHp() },
                { id: 0xb, value: creature.fetchMp   () },
                { id: 0xc, value: creature.fetchMaxMp() },
            ])
        );
    }

    statusUpdateStats(session, creature) {
        session.dataSend(
            ServerResponse.statusUpdate(creature.fetchId(), [
                { id: 0x11, value: creature.fetchCollectivePAtk  () },
                { id: 0x17, value: creature.fetchCollectiveMAtk  () },
                { id: 0x12, value: creature.fetchCollectiveAtkSpd() },
            ])
        );
    }

    rewardExpAndSp(session, exp, sp) {
        const optn = options.default.General;

        let totalExp = this.fetchExp() + (exp *= optn.expRate);
        let totalSp  = this.fetchSp () + ( sp *= optn.expRate);

        this.setExpSp(totalExp, totalSp);
        ConsoleText.transmit(session, ConsoleText.caption.earnedExpAndSp, [{ kind: ConsoleText.kind.number, value: exp}, { kind: ConsoleText.kind.number, value: sp }]);

        for (let i = 0; i < 75; i++) {
            if (totalExp >= DataCache.experience[i] && totalExp < DataCache.experience[i + 1]) {
                if (i + 1 > this.fetchLevel()) { // Leveled up
                    this.levelUp(session, i + 1);
                    break;
                }
            }
        }

        // Update database with new exp, sp
        Database.updateCharacterExperience(this.fetchId(), this.fetchLevel(), totalExp, totalSp);
        session.dataSend(ServerResponse.userInfo(this));
    }

    levelUp(session, level) {
        // Stop automation to prevent false data
        this.automation.stopReplenish();

        // Update stats
        this.setLevel(level);
        this.setCollectiveAll();
        this.fillupVitals();

        // Level up effect
        session.dataSend(ServerResponse.socialAction(this.fetchId(), 15));
        ConsoleText.transmit(session, ConsoleText.caption.levelUp);

        // Update database with new hp, mp
        Database.updateCharacterVitals(this.fetchId(), this.fetchHp(), this.fetchMaxHp(), this.fetchMp(), this.fetchMaxMp());
    }

    teleportTo(session, coords) {
        if (this.isBlocked(session)) {
            return;
        }

        this.automation.abortAll(this);
        session.dataSend(ServerResponse.teleportToLocation(this.fetchId(), coords));

        // Turns out to be a viable solution
        setTimeout(() => {
            this.updatePosition(session, coords);
        }, 1000);
    }

    admin(session) {
        session.dataSend(
            ServerResponse.npcHtml(this.fetchId(), utils.parseRawFile('data/Html/Admin/main.html'))
        );
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
}

module.exports = Actor;
