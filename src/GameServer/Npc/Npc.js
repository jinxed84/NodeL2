const ServerResponse = invoke('GameServer/Network/Response');
const NpcModel       = invoke('GameServer/Model/Npc');
const Automation     = invoke('GameServer/Automation');
const ConsoleText    = invoke('GameServer/ConsoleText');
const Formulas       = invoke('GameServer/Formulas');

class Npc extends NpcModel {
    constructor(id, data) {
        // Parent inheritance
        super(data);

        // Local
        this.automation = new Automation();
        this.automation.setRevHp(this.fetchRevHp());
        this.automation.setRevMp(this.fetchRevMp());

        this.setId(id);
        this.fillupVitals();

        // User preferences
        const optn = options.default.General;

        if (optn.showMonsterLevel) {
            this.showLevelTitle();
        }

        // TODO: Move this into actual GameServer timer
        this.timer = {
            combat: undefined
        };
    }

    destructor(session) {
        this.automation.stopReplenish();
        this.abortCombatState(session);
    }

    showLevelTitle() {
        if (this.fetchAttackable() && this.fetchTitle() === '') {
            this.setTitle('Lv ' + this.fetchLevel() + (this.fetchHostile() ? ' @' : ''));
        }
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
            let dstZ = 0;

            this.timer.combat = setInterval(() => {
                if (this.state.isBlocked()) {
                    return;
                }

                const newDstX = actor.fetchLocX();
                const newDstY = actor.fetchLocY();
                const newDstZ = actor.fetchLocZ();

                if (this.state.inMotion()) {
                    if (dstX !== newDstX || dstY !== newDstY) {
                        const ratio  = this.automation.fetchDistanceRatio();
                        const coords = Formulas.calcMidPointCoordinates(this.fetchLocX(), this.fetchLocY(), this.fetchLocZ(), dstX, dstY, dstZ, ratio);
                        this.setLocX(coords.locX);
                        this.setLocY(coords.locY);
                        this.setLocZ(coords.locZ);

                        this.automation.abortAll(this);
                    }
                    return;
                }

                dstX = newDstX;
                dstY = newDstY;
                dstZ = newDstZ;

                this.automation.scheduleAction(session, this, actor, actor.fetchRadius(), () => {
                    this.setLocX(dstX);
                    this.setLocY(dstY);
                    this.setLocZ(dstZ);

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

    abortCombatState(session) {
        clearInterval(this.timer.combat);
        this.timer.combat = undefined;

        this.clearDestId();
        this.state.setCombats(false);
        this.state.setHits   (false);
        this.state.setCasts  (false);
        this.automation.destructor(this);

        this.setStateRun(false);
        this.setStateAttack(false);
        session.dataSend(ServerResponse.walkAndRun(this.fetchId(), this.fetchStateRun()));
        session.dataSend(ServerResponse.autoAttackStop(this.fetchId()));
    }

    meleeHit(session, src, dst) {
        if (this.checkParticipants(session, src, dst)) {
            return;
        }

        const speed = Formulas.calcMeleeAtkTime(src.fetchCollectiveAtkSpd());
        const hitLanded = Formulas.calcHitChance();
        session.dataSend(ServerResponse.attack(src, dst.fetchId(), hitLanded ? 0x00 : 0x80));
        src.state.setHits(true);

        setTimeout(() => {
            if (this.checkParticipants(session, src, dst)) {
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

    checkParticipants(session, src, dst) {
        if (src.state.fetchDead() || dst.state.fetchDead()) {
            this.abortCombatState(session);
            return true;
        }
        return false;
    }

    hit(session, actor, hit) {
        ConsoleText.transmit(session, ConsoleText.caption.monsterHit, [
            { kind: ConsoleText.kind.npc, value: this.fetchDispSelfId() }, { kind: ConsoleText.kind.number, value: hit }
        ]);
        invoke('GameServer/Actor/Generics').receivedHit(session, actor, hit);
    }

    hitReceived(session, actor, hit) {
        this.setHp(Math.max(0, this.fetchHp() - hit)); // HP bar would disappear if less than zero
        actor.statusUpdateVitals(this);

        if (this.fetchHp() <= 0) {
            this.die(session, actor);
            return;
        }

        this.automation.replenishVitals(this);
        this.enterCombatState(session, actor);
    }

    die(session, actor) {
        this.destructor(session);
        this.state.setDead(true);
        session.dataSend(ServerResponse.die(this.fetchId()));
        invoke('GameServer/Actor/Generics').npcDied(session, actor, this);
    }

    broadcastToSubscribers() {
        const World = invoke('GameServer/World');

        const inRadiusActors = World.user.sessions.filter((ob) => this.fetchId() === ob.actor?.fetchDestId() && Formulas.calcWithinRadius(this.fetchLocX(), this.fetchLocY(), ob.actor?.fetchLocX(), ob.actor?.fetchLocY(), 3500)) ?? [];
        inRadiusActors.forEach((session) => {
            session.actor.statusUpdateVitals(this);
        });
    }
}

module.exports = Npc;
