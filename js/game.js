const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;
const GRAVITY = 0.6;
const FRICTION = 0.8;
const MAX_FALL_SPEED = 15;
let GROUND_Y = GAME_HEIGHT - 100;
let gameState = 'LOGIN';
let lastTime = 0;
let camera = { x: 0, y: 0 };
let mapWidth = 3000;
let localPlayer = null;
let entities = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
const keys = {};
let isChatFocused = false;
const uiHUD = document.getElementById('hud');
const uiLogin = document.getElementById('loginScreen');
const uiInventory = document.getElementById('inventory');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
let network = null;

const raceConfigs = {
    sayan: {
        title: 'Sayan',
        desc: 'Tóc dựng, chiến binh anime. HP cao, sát thương vật lý mạnh.',
        skills: 'Đánh cận chiến mạnh, bắn năng lượng cơ bản, tăng sức mạnh tạm thời.',
        maxHp: 180,
        maxMp: 70,
        baseDamage: 22,
        speed: 5.5,
        jumpForce: -12,
        maxExp: 110,
        levelGrowth: { hp: 28, mp: 8, damage: 6, expFactor: 1.35 },
        aura: 'rgba(255,152,0,0.25)',
        bodyColor: '#ff8a65',
        hairColor: '#ffeb3b',
        skinColor: '#ffccaa',
        outfitColor: '#d84315',
        projectileColor: '#ffeb3b',
        attackBonus: 4,
        shootCost: 12,
        shootCooldown: 1000,
        skillCooldown: 8000,
        skillName: 'Thịnh nộ Sayan',
        skillDesc: 'Tăng damage tạm thời và aura mạnh trong vài giây.'
    },
    namek: {
        title: 'Namek',
        desc: 'Da xanh, thần bí, thiên về năng lượng với phòng thủ tốt.',
        skills: 'Bắn năng lượng, hồi máu nhẹ, khiên năng lượng.',
        maxHp: 140,
        maxMp: 120,
        baseDamage: 16,
        speed: 4.8,
        jumpForce: -11,
        maxExp: 100,
        levelGrowth: { hp: 18, mp: 18, damage: 4, expFactor: 1.25 },
        aura: 'rgba(0,255,128,0.25)',
        bodyColor: '#81c784',
        hairColor: '#388e3c',
        skinColor: '#a5d6a7',
        outfitColor: '#2e7d32',
        projectileColor: '#00e5ff',
        attackBonus: 2,
        shootCost: 10,
        shootCooldown: 1200,
        skillCooldown: 10000,
        skillName: 'Hồi phục Namek',
        skillDesc: 'Hồi HP và tạo khiên năng lượng tạm thời.'
    },
    earth: {
        title: 'Trái Đất',
        desc: 'Võ sĩ con người, trang phục đơn giản và dáng nhanh nhẹn.',
        skills: 'Combo cận chiến nhanh, bắn năng lượng nhỏ, né/dash nhanh.',
        maxHp: 150,
        maxMp: 80,
        baseDamage: 18,
        speed: 6.5,
        jumpForce: -13,
        maxExp: 95,
        levelGrowth: { hp: 20, mp: 10, damage: 5, expFactor: 1.15 },
        aura: 'rgba(0,150,255,0.2)',
        bodyColor: '#90caf9',
        hairColor: '#212121',
        skinColor: '#ffe0b2',
        outfitColor: '#1976d2',
        projectileColor: '#80d8ff',
        attackBonus: 1,
        shootCost: 8,
        shootCooldown: 700,
        skillCooldown: 9000,
        skillName: 'Bước nhanh Trái Đất',
        skillDesc: 'Dịch chuyển nhanh và tăng tốc độ di chuyển tạm thời.'
    }
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    GAME_WIDTH = canvas.width;
    GAME_HEIGHT = canvas.height;
    GROUND_Y = GAME_HEIGHT - 100;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateRacePreview() {
    const raceKey = document.getElementById('playerRaceInput').value;
    const config = raceConfigs[raceKey] || raceConfigs.sayan;
    document.getElementById('racePreviewName').innerText = config.title;
    document.getElementById('racePreviewDesc').innerText = config.desc;
    document.getElementById('raceHp').innerText = config.maxHp;
    document.getElementById('raceMp').innerText = config.maxMp;
    document.getElementById('raceDamage').innerText = config.baseDamage;
    document.getElementById('raceSpeed').innerText = config.speed;
    document.getElementById('racePreviewSkillName').innerText = config.skillName;
    document.getElementById('racePreviewSkillDesc').innerText = config.skillDesc;
}

document.getElementById('playerRaceInput').addEventListener('change', updateRacePreview);
updateRacePreview();

function checkAABBCollision(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y);
}

function addSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg-sys';
    el.innerText = `[Hệ thống] ${text}`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function spawnDamageText(x, y, damage, color = 'white') {
    floatingTexts.push({
        x: x, y: y, text: `-${damage}`,
        color: color, life: 60, maxLife: 60, vy: -2
    });
}

function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 20 + Math.random() * 20,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

class GameObject {
    constructor(x, y, width, height) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.x = x; this.y = y;
        this.width = width; this.height = height;
        this.vx = 0; this.vy = 0;
        this.dir = 1;
        this.isGrounded = false;
        this.state = 'idle';
        this.stateTimer = 0;
    }

    update(dt) {
        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
        this.x += this.vx;
        this.y += this.vy;
        let localGround = GROUND_Y;
        if (this.y + this.height > localGround) {
            this.y = localGround - this.height;
            this.vy = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }
        if (this.x < 0) this.x = 0;
        if (this.x > mapWidth - this.width) this.x = mapWidth - this.width;
        this.vx *= FRICTION;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        this.stateTimer += dt;
    }

    draw(ctx) {
    }
}

class Character extends GameObject {
    constructor(x, y, name) {
        super(x, y, 40, 60);
        this.name = name;
        this.maxHp = 100; this.hp = 100;
        this.maxMp = 50; this.mp = 50;
        this.level = 1;
        this.speed = 5;
        this.jumpForce = -12;
        this.isDead = false;
        this.color = '#fff';
        this.attackCooldown = 0;
        this.shootCooldown = 0;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.hp -= amount;
        spawnDamageText(this.x + this.width / 2, this.y, amount, '#ff3333');
        createParticles(this.x + this.width / 2, this.y + this.height / 2, 'red');
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.state = 'dead';
    }

    update(dt) {
        if (this.isDead) {
            this.vy += GRAVITY;
            this.y += this.vy;
            if (this.y + this.height > GROUND_Y) this.y = GROUND_Y - this.height;
            return;
        }
        super.update(dt);
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (this.state !== 'attack' && this.state !== 'shoot') {
            if (!this.isGrounded) this.state = 'jump';
            else if (Math.abs(this.vx) > 0.5) this.state = 'run';
            else this.state = 'idle';
        } else {
            if (this.stateTimer > 300) {
                this.state = 'idle';
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height);
        ctx.scale(this.dir, 1);
        if (this.isDead) {
            ctx.rotate(Math.PI / 2);
            ctx.translate(-this.height / 2, -this.width / 2);
        }
        if (this instanceof Player && (this.state === 'attack' || this.state === 'shoot')) {
            ctx.beginPath();
            ctx.arc(0, -this.height / 2, 40 + Math.sin(Date.now() / 50) * 5, 0, Math.PI * 2);
            ctx.fillStyle = this.raceConfig?.aura || 'rgba(255, 200, 0, 0.3)';
            ctx.fill();
        }
        let bobY = 0;
        let legRot = 0;
        if (this.state === 'idle') bobY = Math.sin(Date.now() / 200) * 2;
        if (this.state === 'run') {
            bobY = Math.abs(Math.sin(Date.now() / 100)) * 4;
            legRot = Math.sin(Date.now() / 100) * 0.5;
        }
        const headRadius = 18;
        const bodyW = 20, bodyH = 25;
        ctx.fillStyle = this.outfitColor || this.bodyColor || this.color;
        ctx.fillRect(-bodyW / 2, -bodyH - 10 + bobY, bodyW, bodyH);
        ctx.fillStyle = '#333';
        ctx.save();
        ctx.translate(0, -10 + bobY);
        ctx.rotate(legRot);
        ctx.fillRect(-8, 0, 6, 10);
        ctx.restore();
        ctx.save();
        ctx.translate(0, -10 + bobY);
        ctx.rotate(-legRot);
        ctx.fillRect(2, 0, 6, 10);
        ctx.restore();
        ctx.fillStyle = this.skinColor || '#ffccaa';
        ctx.beginPath();
        ctx.arc(0, -bodyH - 10 - headRadius + bobY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.hairColor || '#000';
        if (this instanceof Player) {
            if (this.raceKey === 'sayan') {
                ctx.beginPath();
                for (let i = -4; i <= 4; i++) {
                    ctx.lineTo(i * 6, -bodyH - 30 + Math.sin(i * 1.5) * 4 + bobY);
                }
                ctx.closePath();
                ctx.fill();
            } else if (this.raceKey === 'namek') {
                ctx.beginPath();
                ctx.ellipse(0, -bodyH - 16 + bobY, 12, 8, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(-10, -bodyH - 24 + bobY, 20, 8);
            }
        } else {
            ctx.fillRect(-10, -bodyH - 24 + bobY, 20, 8);
        }
        ctx.fillStyle = '#000';
        ctx.fillRect(2, -bodyH - 10 - headRadius - 2 + bobY, 4, 4);
        if (this.state === 'attack') {
            ctx.beginPath();
            ctx.arc(15, -this.height / 2, 25, -Math.PI / 4, Math.PI / 4);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
        ctx.restore();
        if (!this.isDead) {
            ctx.fillStyle = 'white';
            ctx.font = '12px "Press Start 2P", cursive, monospace';
            ctx.textAlign = 'center';
            let nameY = this.y - 15;
            ctx.fillText(this.name, this.x + this.width / 2, nameY - 5);
            ctx.fillStyle = '#555';
            ctx.fillRect(this.x, nameY, this.width, 4);
            ctx.fillStyle = '#f44336';
            let hpRatio = Math.max(0, this.hp / this.maxHp);
            ctx.fillRect(this.x, nameY, this.width * hpRatio, 4);
        }
    }
}

class Player extends Character {
    constructor(x, y, name, raceKey) {
        super(x, y, name);
        this.raceKey = raceKey;
        this.raceConfig = raceConfigs[raceKey] || raceConfigs.sayan;
        this.exp = 0;
        this.maxExp = this.raceConfig.maxExp;
        this.money = 0;
        this.inventory = [{ id: 'hp_potion', name: 'Bình Máu', count: 5 }];
        this.quest = { step: 0, progress: 0, target: 3 };
        this.maxHp = this.raceConfig.maxHp;
        this.maxMp = this.raceConfig.maxMp;
        this.speed = this.raceConfig.speed;
        this.jumpForce = this.raceConfig.jumpForce;
        this.baseDamage = this.raceConfig.baseDamage;
        this.shootCooldown = 0;
        this.skillCooldown = 0;
        this.skillDuration = 0;
        this.skillActive = false;
        this.bodyColor = this.raceConfig.bodyColor;
        this.hairColor = this.raceConfig.hairColor;
        this.skinColor = this.raceConfig.skinColor;
        this.outfitColor = this.raceConfig.outfitColor;
        this.projectileColor = this.raceConfig.projectileColor;
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.color = this.bodyColor;
    }

    addExp(amount) {
        this.exp += amount;
        addSystemMessage(`Bạn nhận được ${amount} EXP`);
        if (this.exp >= this.maxExp) {
            this.levelUp();
        }
        updateHUD();
    }

    levelUp() {
        this.level++;
        this.exp -= this.maxExp;
        this.maxExp = Math.floor(this.maxExp * this.raceConfig.levelGrowth.expFactor);
        this.maxHp += this.raceConfig.levelGrowth.hp;
        this.maxMp += this.raceConfig.levelGrowth.mp;
        this.baseDamage += this.raceConfig.levelGrowth.damage;
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        addSystemMessage(`Chúc mừng! Bạn đã đạt Cấp ${this.level}`);
        createParticles(this.x, this.y, 'gold', 20);
    }

    takeDamage(amount) {
        if (this.skillActive && this.raceKey === 'namek') {
            amount = Math.max(1, amount - 6);
        }
        super.takeDamage(amount);
    }

    update(dt) {
        super.update(dt);
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (this.skillDuration > 0) {
            this.skillDuration -= dt;
            if (this.skillDuration <= 0) {
                this.skillDuration = 0;
                if (this.skillActive) {
                    if (this.raceKey === 'sayan') {
                        this.baseDamage -= 10;
                    } else if (this.raceKey === 'earth') {
                        this.speed -= 2;
                    }
                    this.skillActive = false;
                    addSystemMessage('Kỹ năng đặc biệt đã kết thúc.');
                }
            }
        }
        if (this.skillCooldown > 0) this.skillCooldown -= dt;
    }

    useItem(itemId) {
        let item = this.inventory.find(i => i.id === itemId);
        if (item && item.count > 0) {
            if (itemId === 'hp_potion') {
                this.hp = Math.min(this.maxHp, this.hp + 50);
                item.count--;
                createParticles(this.x + this.width / 2, this.y + this.height, '#4caf50', 10);
                spawnDamageText(this.x + this.width / 2, this.y, '+50 HP', '#4caf50');
            }
            updateInventoryUI();
            updateHUD();
        }
    }

    attack() {
        if (this.attackCooldown > 0) return;
        this.state = 'attack';
        this.stateTimer = 0;
        this.attackCooldown = 500;
        let hitbox = {
            x: this.dir === 1 ? this.x + this.width : this.x - 40,
            y: this.y,
            width: 40,
            height: this.height
        };
        entities.forEach(ent => {
            if (ent !== this && ent instanceof Character && !ent.isDead && !(ent instanceof NPC)) {
                if (checkAABBCollision(hitbox, ent)) {
                    let dmg = this.baseDamage + Math.floor(Math.random() * 5) + (this.raceConfig.attackBonus || 0);
                    ent.takeDamage(dmg);
                    if (ent.hp <= 0 && ent instanceof Monster) {
                        this.addExp(ent.grantExp);
                        this.money += ent.grantGold;
                        if (this.quest.step === 1) {
                            this.quest.progress++;
                            if (this.quest.progress >= this.quest.target) {
                                this.quest.step = 2;
                                addSystemMessage('Nhiệm vụ hoàn thành! Hãy về báo cáo Trưởng Làng.');
                            }
                            updateQuestUI();
                        }
                    }
                }
            }
        });
    }

    shoot() {
        if (this.shootCooldown > 0 || this.mp < this.raceConfig.shootCost) return;
        this.mp -= this.raceConfig.shootCost;
        this.state = 'shoot';
        this.stateTimer = 0;
        this.shootCooldown = this.raceConfig.shootCooldown;
        let pX = this.dir === 1 ? this.x + this.width : this.x - 20;
        projectiles.push(new Projectile(pX, this.y + 20, this.dir, this, this.baseDamage * 1.2));
        updateHUD();
    }

    useRaceSkill() {
        if (this.skillCooldown > 0 || this.skillActive) return;
        this.skillCooldown = this.raceConfig.skillCooldown;
        this.skillDuration = 1800; // duration in milliseconds
        this.skillActive = true;
        if (this.raceKey === 'sayan') {
            this.baseDamage += 10;
            createParticles(this.x, this.y, 'orange', 30);
            addSystemMessage('Sayan bật Thịnh nộ: Tăng damage tạm thời!');
        } else if (this.raceKey === 'namek') {
            this.hp = Math.min(this.maxHp, this.hp + 40);
            createParticles(this.x, this.y, 'lightgreen', 20);
            addSystemMessage('Namek hồi phục nhẹ và tạo khiên năng lượng.');
        } else if (this.raceKey === 'earth') {
            this.speed += 2;
            createParticles(this.x, this.y, 'lightblue', 20);
            addSystemMessage('Trái Đất tiến vào trạng thái nhanh nhẹn!');
        }
    }

    interact() {
        let nearbyNpc = entities.find(ent => ent instanceof NPC && Math.abs(ent.x - this.x) < 100);
        if (nearbyNpc) {
            nearbyNpc.talkTo(this);
        }
    }
}

class Monster extends Character {
    constructor(x, y, level) {
        super(x, y, 'Quái Vật');
        this.level = level;
        this.maxHp = 50 * level; this.hp = this.maxHp;
        this.grantExp = 20 * level;
        this.grantGold = 10 * level;
        this.color = '#9c27b0';
        this.originX = x;
        this.patrolTimer = 0;
        this.respawnTimer = 0;
    }

    update(dt) {
        super.update(dt);
        if (this.isDead) {
            this.respawnTimer += dt;
            if (this.respawnTimer > 5000) {
                this.hp = this.maxHp;
                this.isDead = false;
                this.x = this.originX;
                this.respawnTimer = 0;
                this.state = 'idle';
            }
            return;
        }
        this.patrolTimer += dt;
        if (this.patrolTimer > 2000) {
            this.patrolTimer = 0;
            let rand = Math.random();
            if (rand < 0.3) { this.vx = 2; this.dir = 1; }
            else if (rand < 0.6) { this.vx = -2; this.dir = -1; }
            else { this.vx = 0; }
        }
    }
}

class NPC extends Character {
    constructor(x, y) {
        super(x, y, 'Trưởng Làng');
        this.color = '#ff9800';
        this.dialogTimer = 0;
        this.dialogText = '';
    }

    takeDamage() {}

    talkTo(player) {
        if (player.quest.step === 0) {
            this.showDialog('Chào dũng sĩ! Xung quanh làng có nhiều quái vật, hãy tiêu diệt 3 con giúp ta!');
            player.quest.step = 1;
            player.quest.progress = 0;
        } else if (player.quest.step === 1) {
            this.showDialog(`Cố lên! Ngươi đã diệt được ${player.quest.progress}/${player.quest.target} con.`);
        } else if (player.quest.step === 2) {
            this.showDialog('Tuyệt vời! Đây là phần thưởng của ngươi.');
            player.addExp(100);
            player.money += 500;
            player.quest.step = 3;
        } else {
            this.showDialog('Cảm ơn ngươi đã bảo vệ làng.');
        }
        updateQuestUI();
    }

    showDialog(text) {
        this.dialogText = text;
        this.dialogTimer = 3000;
    }

    draw(ctx) {
        super.draw(ctx);
        if (this.dialogTimer > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.roundRect(this.x - 50, this.y - 70, 140, 40, 5);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.font = '10px Roboto';
            ctx.textAlign = 'center';
            ctx.fillText(this.dialogText.substring(0, 20), this.x + this.width / 2, this.y - 55);
            if (this.dialogText.length > 20) {
                ctx.fillText(this.dialogText.substring(20, 40) + '...', this.x + this.width / 2, this.y - 43);
            }
        }
    }

    update(dt) {
        super.update(dt);
        if (this.dialogTimer > 0) this.dialogTimer -= dt;
    }
}

class Projectile {
    constructor(x, y, dir, owner, damage) {
        this.x = x; this.y = y;
        this.width = 20; this.height = 10;
        this.vx = dir * 10;
        this.dir = dir;
        this.owner = owner;
        this.damage = damage;
        this.life = 1000;
        this.color = owner.raceConfig?.projectileColor || '#ffeb3b';
    }

    update(dt) {
        this.x += this.vx;
        this.life -= dt;
        if (Math.random() > 0.5) createParticles(this.x, this.y + 5, this.color, 1);
        entities.forEach(ent => {
            if (ent !== this.owner && ent instanceof Character && !ent.isDead && !(ent instanceof NPC)) {
                if (checkAABBCollision(this, ent)) {
                    ent.takeDamage(this.damage);
                    createParticles(this.x, this.y, this.color, 10);
                    this.life = 0;
                    if (ent.hp <= 0 && ent instanceof Monster && this.owner instanceof Player) {
                        this.owner.addExp(ent.grantExp);
                        this.owner.money += ent.grantGold;
                        if (this.owner.quest.step === 1) {
                            this.owner.quest.progress++;
                            if (this.owner.quest.progress >= this.owner.quest.target) {
                                this.owner.quest.step = 2;
                                addSystemMessage('Nhiệm vụ hoàn thành! Hãy về báo cáo Trưởng Làng.');
                            }
                            updateQuestUI();
                        }
                    }
                }
            }
        });
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 5);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class MockNetwork {
    constructor() {
        this.mockPlayers = [];
        this.names = ['GokuFake', 'VegetaPro', 'YasuoGG'];
        setTimeout(() => {
            const raceKeys = Object.keys(raceConfigs);
            const botRace = raceKeys[Math.floor(Math.random() * raceKeys.length)];
            let bot = new Player(600, 300, this.names[0], botRace);
            bot.isBot = true;
            entities.push(bot);
            this.mockPlayers.push(bot);
            addSystemMessage(`${bot.name} đã đăng nhập với chủng tộc ${raceConfigs[botRace].title}.`);
        }, 2000);
    }

    updateBots(dt) {
        this.mockPlayers.forEach(bot => {
            if (Math.random() < 0.01) {
                bot.dir = Math.random() > 0.5 ? 1 : -1;
                bot.vx = bot.dir * bot.speed;
            } else if (Math.random() < 0.02) {
                bot.vx = 0;
            }
            if (Math.random() < 0.005 && bot.isGrounded) {
                bot.vy = bot.jumpForce;
            }
            if (Math.random() < 0.001) {
                this.receiveChat(bot.name, 'Có ai party up không?');
            }
        });
    }

    sendChat(name, msg) {
        this.receiveChat(name, msg);
    }

    receiveChat(name, msg) {
        const el = document.createElement('div');
        el.className = 'msg-player';
        el.innerHTML = `<span class="msg-name">${name}:</span> ${msg}`;
        chatMessages.appendChild(el);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

window.addEventListener('keydown', e => {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'Enter') {
        if (isChatFocused) {
            let msg = chatInput.value.trim();
            if (msg) {
                network.sendChat(localPlayer.name, msg);
                chatInput.value = '';
            }
            chatInput.blur();
        } else {
            chatInput.focus();
        }
        return;
    }
    if (isChatFocused) return;
    keys[e.code] = true;
    if (e.code === 'KeyW' && localPlayer.isGrounded && !localPlayer.isDead) {
        localPlayer.vy = localPlayer.jumpForce;
    }
    if (e.code === 'KeyJ' && !localPlayer.isDead) localPlayer.attack();
    if (e.code === 'KeyK' && !localPlayer.isDead) localPlayer.shoot();
    if (e.code === 'KeyQ' && !localPlayer.isDead) localPlayer.useRaceSkill();
    if (e.code === 'KeyE' && !localPlayer.isDead) localPlayer.interact();
    if (e.code === 'KeyI') toggleInventory();
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

chatInput.addEventListener('focus', () => isChatFocused = true);
chatInput.addEventListener('blur', () => isChatFocused = false);

function startGame() {
    if (gameState === 'PLAYING') return;
    let name = document.getElementById('playerNameInput').value || 'Gamer';
    let raceKey = document.getElementById('playerRaceInput').value;
    localPlayer = new Player(200, 200, name, raceKey);
    entities.push(localPlayer);
    entities.push(new NPC(400, 400));
    entities.push(new Monster(1000, 400, 1));
    entities.push(new Monster(1200, 400, 1));
    entities.push(new Monster(2000, 400, 2));
    if (!network) network = new MockNetwork();
    uiLogin.style.display = 'none';
    uiHUD.style.display = 'block';
    gameState = 'PLAYING';
    addSystemMessage(`Chào mừng ${name} đến với thế giới Aura Warriors!`);
    updateHUD();
    updateQuestUI();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function updateHUD() {
    if (!localPlayer) return;
    document.getElementById('hudName').innerText = localPlayer.name;
    document.getElementById('hudLevel').innerText = localPlayer.level;
    document.getElementById('hudHpText').innerText = `${Math.floor(localPlayer.hp)}/${localPlayer.maxHp}`;
    document.getElementById('hpBar').style.width = `${Math.max(0, (localPlayer.hp / localPlayer.maxHp) * 100)}%`;
    document.getElementById('hudMpText').innerText = `${Math.floor(localPlayer.mp)}/${localPlayer.maxMp}`;
    document.getElementById('mpBar').style.width = `${Math.max(0, (localPlayer.mp / localPlayer.maxMp) * 100)}%`;
    document.getElementById('hudExpText').innerText = `${localPlayer.exp}/${localPlayer.maxExp}`;
    document.getElementById('expBar').style.width = `${(localPlayer.exp / localPlayer.maxExp) * 100}%`;
    document.getElementById('hudMoney').innerText = localPlayer.money;
}

function updateQuestUI() {
    const qText = document.getElementById('questText');
    if (localPlayer.quest.step === 0) qText.innerText = 'Nói chuyện với Trưởng Làng (Bấm E)';
    else if (localPlayer.quest.step === 1) qText.innerText = `Tiêu diệt Quái vật: ${localPlayer.quest.progress}/${localPlayer.quest.target}`;
    else if (localPlayer.quest.step === 2) qText.innerText = 'Về báo cáo với Trưởng Làng';
    else if (localPlayer.quest.step === 3) qText.innerText = 'Chưa có nhiệm vụ mới';
}

function toggleInventory() {
    let inv = document.getElementById('inventory');
    if (inv.style.display === 'block') {
        inv.style.display = 'none';
    } else {
        inv.style.display = 'block';
        updateInventoryUI();
    }
}

function updateInventoryUI() {
    let grid = document.getElementById('invGrid');
    grid.innerHTML = '';
    localPlayer.inventory.forEach(item => {
        if (item.count > 0) {
            let slot = document.createElement('div');
            slot.className = 'item-slot';
            slot.onclick = () => localPlayer.useItem(item.id);
            if (item.id === 'hp_potion') {
                let icon = document.createElement('div');
                icon.className = 'item-icon-hp';
                slot.appendChild(icon);
            }
            let cnt = document.createElement('div');
            cnt.className = 'item-count';
            cnt.innerText = item.count;
            slot.appendChild(cnt);
            grid.appendChild(slot);
        }
    });
    for (let i = localPlayer.inventory.length; i < 12; i++) {
        let slot = document.createElement('div');
        slot.className = 'item-slot';
        grid.appendChild(slot);
    }
}

function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;
    let dt = timestamp - lastTime;
    if (dt > 50) dt = 50;
    lastTime = timestamp;
    if (!localPlayer.isDead && !isChatFocused) {
        if (keys['KeyA']) { localPlayer.vx = -localPlayer.speed; localPlayer.dir = -1; }
        else if (keys['KeyD']) { localPlayer.vx = localPlayer.speed; localPlayer.dir = 1; }
        else { localPlayer.vx = 0; }
    }
    if (!localPlayer.isDead && localPlayer.mp < localPlayer.maxMp) {
        localPlayer.mp += 0.05;
    }
    entities.forEach(ent => ent.update(dt));
    projectiles = projectiles.filter(p => p.life > 0);
    projectiles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life--; p.vy += GRAVITY * 0.2;
    });
    floatingTexts = floatingTexts.filter(t => t.life > 0);
    floatingTexts.forEach(t => {
        t.y += t.vy; t.life--;
    });
    if (network) network.updateBots(dt);
    camera.x = localPlayer.x - GAME_WIDTH / 2 + localPlayer.width / 2;
    if (camera.x < 0) camera.x = 0;
    if (camera.x > mapWidth - GAME_WIDTH) camera.x = mapWidth - GAME_WIDTH;
    updateHUD();
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    let skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGradient.addColorStop(0, '#0a192f');
    skyGradient.addColorStop(1, '#172a45');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(0, GROUND_Y, mapWidth, 20);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(0, GROUND_Y + 20, mapWidth, GAME_HEIGHT - GROUND_Y);
    ctx.fillStyle = '#1b5e20';
    for (let i = 100; i < mapWidth; i += 400) {
        ctx.fillRect(i, GROUND_Y - 80, 20, 80);
        ctx.beginPath(); ctx.arc(i + 10, GROUND_Y - 80, 40, 0, Math.PI * 2); ctx.fill();
    }
    entities.sort((a, b) => a.y - b.y).forEach(ent => ent.draw(ctx));
    projectiles.forEach(p => p.draw(ctx));
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 40;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    floatingTexts.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = t.life / t.maxLife;
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1;
    });
    ctx.restore();
    requestAnimationFrame(gameLoop);
}
