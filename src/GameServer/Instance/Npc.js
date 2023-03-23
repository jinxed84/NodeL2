const ServerResponse = invoke('GameServer/Network/Response');
const NpcModel       = invoke('GameServer/Model/Npc');
const Automation     = invoke('GameServer/Instance/Automation');
const ConsoleText    = invoke('GameServer/ConsoleText');
const Formulas       = invoke('GameServer/Formulas');

class Npc extends NpcModel {
    constructor(id, data) {
        // Parent inheritance
        super(data);

        // Local
        this.automation = new Automation();

        this.setId(id);
        this.fillupVitals();

        // User preferences
        const optn = options.default.General;

        if (optn.showMonsterLevel) {
            this.showLevelTitle();
        }

        // TODO: Move this into actual GameServer timer
        this.timer = {
            replenish : undefined,
            combat    : undefined,
        };
    }

    destructor() {
        this.stopReplenish();
        this.enterCooldownState();
    }

    showLevelTitle() {
        if (this.fetchAttackable() && this.fetchTitle() === '') {
            this.setTitle('Lv ' + this.fetchLevel() + (this.fetchHostile() ? ' @' : ''));
        }
    }

    replenishVitals() {
        if (this.timer.replenish) {
            return;
        }

        this.stopReplenish();
        this.timer.replenish = setInterval(() => {
            const maxHp = this.fetchMaxHp();
            const maxMp = this.fetchMaxMp();

            const minHp = Math.min(this.fetchHp() + this.fetchRevHp(), maxHp);
            const minMp = Math.min(this.fetchMp() + this.fetchRevMp(), maxMp);

            this.setHp(minHp);
            this.setMp(minMp);

            if (minHp >= maxHp && minMp >= maxMp) {
                this.stopReplenish();
            }
        }, 3000);
    }

    stopReplenish() {
        clearInterval(this.timer.replenish);
        this.timer.replenish = undefined;
    }

    enterCombatState(session, actor) {
        if (this.state.fetchCombats()) {
            return;
        }

        this.state.setCombats(true);

        this.setStateRun(true);
        this.setStateAttack(true);
        session.dataSend(ServerResponse.walkAndRun(this.fetchId(), this.fetchStateRun()));
        session.dataSend(ServerResponse.autoAttackStart(this.fetchId()));

        setTimeout(() => {
            const perimeter = this.fetchRadius() + this.fetchAtkRadius();
            let dstX = 0;
            let dstY = 0;

            this.timer.combat = setInterval(() => {
                if (this.state.isBlocked()) {
                    return;
                }

                const newDstX = actor.fetchLocX();
                const newDstY = actor.fetchLocY();

                if (this.state.inMotion()) {
                    if (dstX !== newDstX || dstY !== newDstY) {
                        const ratio  = this.automation.fetchDistanceRatio();
                        const coords = Formulas.calcMidPointCoordinates(this.fetchLocX(), this.fetchLocY(), dstX, dstY, ratio);
                        this.setLocX(coords.locX);
                        this.setLocY(coords.locY);

                        this.automation.abortAll(this);
                    }
                    return;
                }

                dstX = newDstX;
                dstY = newDstY;

                this.automation.scheduleAction(session, this, actor, actor.fetchRadius(), () => {
                    this.setLocX(dstX);
                    this.setLocY(dstY);

                    if (Formulas.calcDistance(dstX, dstY, actor.fetchLocX(), actor.fetchLocY()) <= perimeter) {
                        session.dataSend(
                            ServerResponse.stopMove(this.fetchId(), {
                                locX: this.fetchLocX(),
                                locY: this.fetchLocY(),
                                locZ: this.fetchLocZ(),
                                head: this.fetchHead(),
                            })
                        );

                        this.meleeHit(session, this, actor);
                    }
                });

            }, 100);

        }, 1000);
    }

    abortCombatState() {
        clearInterval(this.timer.combat);
        this.timer.combat = undefined;
    }

    meleeHit(session, src, dst) {
        if (this.checkParticipants(src, dst)) {
            return;
        }

        const speed = Formulas.calcMeleeAtkTime(src.fetchCollectiveAtkSpd());
        const hitLanded = Formulas.calcHitChance();
        session.dataSend(ServerResponse.attack(src, dst.fetchId(), hitLanded ? 0x00 : 0x80));
        src.state.setHits(true);

        setTimeout(() => {
            if (this.checkParticipants(src, dst)) {
                return;
            }

            if (hitLanded) {
                const pAtk = src.fetchCollectivePAtk();
                this.hit(session, dst, Formulas.calcMeleeHit(pAtk, 0, dst.fetchCollectivePDef()));
            }

        }, speed * 0.644);

        setTimeout(() => {
            this.state.setHits(false);

        }, speed); // Until end of combat move
    }

    checkParticipants(src, dst) {
        if (src.state.fetchDead() || dst.state.fetchDead()) {
            this.enterCooldownState();
            return true;
        }
        return false;
    }

    enterCooldownState() {
        this.clearDestId();
        this.abortCombatState();
        this.state.destructor();
        this.automation.destructor(this);
    }

    hit(session, actor, hit) {
        ConsoleText.transmit(session, ConsoleText.caption.monsterHit, [
            { kind: ConsoleText.kind.npc, value: this.fetchDispSelfId() }, { kind: ConsoleText.kind.number, value: hit }
        ]);
        actor.hitReceived(hit);
    }

    hitReceived(session, actor, hit) {
        this.setHp(Math.max(0, this.fetchHp() - hit)); // HP bar would disappear if less than zero
        this.replenishVitals();

        actor.statusUpdateVitals(this);

        if (this.fetchHp() <= 0) {
            actor.npcDied(this);
            return;
        }

        this.enterCombatState(session, actor);
    }

    die(session) {
        this.destructor(session);
        this.state.setDead(true);
        session.dataSend(ServerResponse.die(this.fetchId()));
    }
}

module.exports = Npc;
