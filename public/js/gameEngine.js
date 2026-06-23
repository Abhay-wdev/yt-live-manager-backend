
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

// --- GLOBAL GAME STATE ---
let isPlaying = false;
let isAutoPlayer = true;
document.getElementById('chkAutoPlayer')?.addEventListener('change', (e) => { isAutoPlayer = e.target.checked; });

let score = 0;
let highScore = 0;
let level = 1;
let enemiesDestroyed = 0;
let combo = 0;
let comboTimer = 0; // Frames until combo drops
let maxComboTimer = 180; // 3 seconds at 60fps

let shakeTime = 0;
let bgY1 = 0, bgY2 = 0, bgY3 = 0;

// --- INPUTS ---
let keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// --- OBJECT POOLS (Performance 60FPS) ---
class Pool {
    constructor(factory, size) {
        this.items = Array.from({length: size}, factory);
        this.active = [];
    }
    get() {
        if (this.items.length > 0) {
            let item = this.items.pop();
            this.active.push(item);
            return item;
        }
        return null;
    }
    release(item) {
        let idx = this.active.indexOf(item);
        if (idx > -1) this.active.splice(idx, 1);
        this.items.push(item);
    }
}

// Entity definitions
function createBullet() { return { active: false, x:0, y:0, w:6, h:20, vx:0, vy:0, color:'#fff', glow:'#0ff', isEnemy:false, dmg:10 }; }
function createParticle() { return { active: false, x:0, y:0, vx:0, vy:0, life:0, maxLife:1, size:1, color:'#fff' }; }
function createFloatingText() { return { active: false, x:0, y:0, text:'', life:0, color:'#fff' }; }

const bulletPool = new Pool(createBullet, 1000);
const particlePool = new Pool(createParticle, 2000);
const textPool = new Pool(createFloatingText, 100);

// --- ENTITIES ---
let player = {
    x: 270, y: 800, w: 50, h: 50, speed: 8,
    hp: 100, maxHp: 100, shield: 100, maxShield: 100,
    weaponType: 0, // 0: Single, 1: Double, 2: Triple, 3: Rapid, 4: Laser, 5: Homing, 6: Plasma
    weaponLevel: 1,
    fireTimer: 0,
    magnetRange: 0,
    invincibleTimer: 0,
    ultCharge: 0
};

let enemies = [];
let powerups = [];

// --- ASSETS (SVGs) ---
// 30 High Quality SVGs grouped by Tier
const svgData = [
    // BASIC (0-4)
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,90 20,30 50,10 80,30" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/><circle cx="50" cy="50" r="10" fill="#93c5fd"/></svg>`, // Scout
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#64748b" stroke="#334155" stroke-width="3"/><circle cx="50" cy="50" r="15" fill="#f87171"/></svg>`, // Drone
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,80 10,20 30,20 50,40 70,20 90,20" fill="#10b981" stroke="#047857" stroke-width="2"/></svg>`, // Alien Fighter
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="40" ry="20" fill="#8b5cf6" stroke="#5b21b6" stroke-width="2"/><circle cx="50" cy="50" r="10" fill="#ddd"/></svg>`, // Plasma Ship
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,70 20,40 80,40" fill="#f59e0b" stroke="#b45309" stroke-width="2"/><rect x="40" y="20" width="20" height="20" fill="#fef08a"/></svg>`, // Mini UFO
    
    // ADVANCED (5-9)
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="20" width="80" height="60" rx="10" fill="#475569" stroke="#1e293b" stroke-width="4"/><circle cx="30" cy="50" r="10" fill="#ef4444"/><circle cx="70" cy="50" r="10" fill="#ef4444"/></svg>`, // Heavy Bomber
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,90 0,10 50,40 100,10" fill="#0ea5e9" stroke="#0369a1" stroke-width="3"/></svg>`, // Laser Destroyer
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M 10 20 Q 50 100 90 20 Z" fill="#ec4899" stroke="#be185d" stroke-width="3"/></svg>`, // Shield Fighter
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,100 10,50 50,0 90,50" fill="#14b8a6" stroke="#0f766e" stroke-width="2"/></svg>`, // Stealth Hunter
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#f43f5e" stroke-width="8"/><polygon points="50,80 30,30 70,30" fill="#f43f5e"/></svg>`, // Missile Carrier
    
    // ELITE (10-14)
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,90 20,10 50,30 80,10" fill="#000" stroke="#a855f7" stroke-width="4"/></svg>`, // Quantum Ship
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="30" y="10" width="40" height="80" fill="#0f172a" stroke="#22d3ee" stroke-width="3"/><line x1="10" y1="50" x2="90" y2="50" stroke="#22d3ee" stroke-width="4"/></svg>`, // Cyber Fighter
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#1e1b4b" stroke="#818cf8" stroke-dasharray="10,5" stroke-width="4"/></svg>`, // Teleport Ship
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M 50 90 Q 0 50 20 10 Q 50 40 80 10 Q 100 50 50 90 Z" fill="#fbbf24" stroke="#d97706" stroke-width="2"/></svg>`, // Energy Beast
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,100 0,20 100,20" fill="#3f3f46" stroke="#dc2626" stroke-width="5"/><circle cx="50" cy="40" r="15" fill="#dc2626"/></svg>`, // Dark Cruiser

    // BOSSES (15-19)
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="40" rx="48" ry="30" fill="#312e81" stroke="#4f46e5" stroke-width="4"/><circle cx="50" cy="70" r="15" fill="#ef4444"/><circle cx="20" cy="50" r="10" fill="#ef4444"/><circle cx="80" cy="50" r="10" fill="#ef4444"/></svg>`, // Alien Mothership
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#1c1917" stroke="#ea580c" stroke-width="6"/><rect x="30" y="30" width="40" height="40" fill="#ea580c"/></svg>`, // Titan Destroyer
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M 50 100 Q 10 70 30 10 Q 50 30 70 10 Q 90 70 50 100 Z" fill="#022c22" stroke="#10b981" stroke-width="4"/><circle cx="40" cy="40" r="5" fill="#fff"/><circle cx="60" cy="40" r="5" fill="#fff"/></svg>`, // Plasma Dragon
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#000" stroke="#0ea5e9" stroke-width="3"/><path d="M 10 50 Q 50 10 90 50 Q 50 90 10 50" fill="#0284c7"/></svg>`, // Space Leviathan
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,10 90,90 50,70 10,90" fill="#4a044e" stroke="#d946ef" stroke-width="5"/><circle cx="50" cy="40" r="10" fill="#fff"/></svg>`, // Galactic Emperor

    // ADDITIONAL VARIATIONS TO REACH 30
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,90 20,50 50,10 80,50" fill="#fca5a5" stroke="#ef4444" stroke-width="2"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" fill="#86efac" stroke="#22c55e" stroke-width="3"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="40" y="0" width="20" height="100" fill="#93c5fd" stroke="#3b82f6" stroke-width="2"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="0,50 50,100 100,50 50,0" fill="#c4b5fd" stroke="#8b5cf6" stroke-width="2"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="30" cy="30" r="20" fill="#fde047"/><circle cx="70" cy="70" r="20" fill="#fde047"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M 10 10 L 90 90 M 10 90 L 90 10" stroke="#f87171" stroke-width="15"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,20 80,80 20,80" fill="#6ee7b7" stroke="#10b981" stroke-width="4"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="15" ry="45" fill="#cbd5e1" stroke="#64748b" stroke-width="3"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" rx="25" fill="#f472b6" stroke="#db2777" stroke-width="4"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,90 0,40 50,50 100,40" fill="#000" stroke="#fbbf24" stroke-width="3"/></svg>`
];

const enemyImages = svgData.map(svg => {
    let img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
});

const playerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="hull" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient>
      <linearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#0369a1"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <polygon points="50,15 95,65 95,95 50,75 5,95 5,65" fill="none" stroke="#06b6d4" stroke-width="6" opacity="0.6" filter="url(#glow)"/>
    <polygon points="50,20 90,60 90,90 50,70 10,90 10,60" fill="url(#hull)" stroke="#22d3ee" stroke-width="3" stroke-linejoin="round"/>
    <rect x="18" y="40" width="10" height="30" fill="#64748b" stroke="#38bdf8" stroke-width="2"/>
    <rect x="72" y="40" width="10" height="30" fill="#64748b" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="50,28 65,58 50,70 35,58" fill="url(#glass)" stroke="#bae6fd" stroke-width="2"/>
  </svg>`;
const playerImg = new Image(); playerImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(playerSvg);

// Powerup SVGs (0:HP, 1:Shield, 2:Weapon, 3:Magnet)
const puSvgData = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#064e3b"/><path d="M 30 50 L 70 50 M 50 30 L 50 70" stroke="#34d399" stroke-width="15" stroke-linecap="round"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#1e3a8a"/><path d="M 20 30 Q 50 100 80 30 Z" fill="#60a5fa"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#78350f"/><polygon points="50,20 80,80 20,80" fill="#fbbf24"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#4c1d95"/><path d="M 20 80 L 20 20 A 30 30 0 0 1 80 20 L 80 80" fill="none" stroke="#c084fc" stroke-width="15"/></svg>`
];
const puImages = puSvgData.map(svg => { let img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); return img; });

const bgGradient = ctx.createLinearGradient(0, 0, 0, 960);
bgGradient.addColorStop(0, "#020617"); bgGradient.addColorStop(1, "#1e1b4b");
const starLayers = [ [], [], [] ];
for(let i=0; i<150; i++) starLayers[0].push({ x: Math.random()*540, y: Math.random()*960, r: 1 });
for(let i=0; i<70; i++)  starLayers[1].push({ x: Math.random()*540, y: Math.random()*960, r: 2 });
for(let i=0; i<30; i++)  starLayers[2].push({ x: Math.random()*540, y: Math.random()*960, r: 3 });

// --- WAVE SYSTEM ---
class WaveManager {
    constructor() {
        this.active = false;
        this.waveTimer = 0;
        this.waveIndex = 0;
    }
    spawnFormation(type, count) {
        let startY = -50;
        let spacing = 60;
        let enemyType = Math.floor(Math.random() * 10); // basic/adv
        if (level % 5 === 0) enemyType = 15 + Math.floor(Math.random()*5); // boss
        
        let hpBase = 10 + (level * 5);
        let speedBase = 2 + (level * 0.2);

        for (let i = 0; i < count; i++) {
            let ex = 270, ey = startY;
            if (type === 'V') {
                ex = 270 + (i % 2 === 0 ? 1 : -1) * (Math.floor((i+1)/2) * spacing);
                ey = startY - Math.floor((i+1)/2) * spacing;
            } else if (type === 'Wall') {
                ex = 50 + (i * (440 / count));
                ey = startY - (i%2)*20;
            } else if (type === 'Snake') {
                ex = 270;
                ey = startY - (i * spacing);
            }
            
            enemies.push({
                x: ex, y: ey, w: 50, h: 50, 
                type: enemyType, speed: speedBase, hp: hpBase, maxHp: hpBase,
                spawnTime: Date.now(), formation: type, index: i
            });
        }
    }
    update() {
        this.waveTimer--;
        if (this.waveTimer <= 0 && enemies.length === 0) {
            this.waveIndex++;
            level = Math.floor(this.waveIndex / 3) + 1;
            let formations = ['V', 'Wall', 'Snake'];
            this.spawnFormation(formations[this.waveIndex % formations.length], 5 + level);
            this.waveTimer = 300; // Delay before next wave
        }
    }
}
const waveManager = new WaveManager();

// --- RECORDING & AUDIO STATE ---
let audioCtx; let audioDest;
function playTone(freq, type, duration, vol) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.1, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination); gain.connect(audioDest);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}
function playShoot() { playTone(800, 'square', 0.1, 0.05); }
function playExplosion() { playTone(150, 'sawtooth', 0.3, 0.1); }
function playPing() { playTone(1200, 'sine', 0.1, 0.1); } // Bullet intercept
let mediaRecorder; let recordedChunks = []; let isUploading = false; let animationId;
let currentLoop = 0; let loopCountTarget = 0;

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        let p = particlePool.get();
        if(p) {
            p.active = true; p.x = x; p.y = y; p.color = color;
            p.vx = (Math.random() - 0.5) * 15; p.vy = (Math.random() - 0.5) * 15;
            p.life = p.maxLife = 20 + Math.random() * 20; p.size = 2 + Math.random() * 4;
        }
    }
}

function spawnText(x, y, text, color) {
    let t = textPool.get();
    if(t) { t.active = true; t.x = x; t.y = y; t.text = text; t.color = color; t.life = 40; }
}

function fireBullet(x, y, vx, vy, isEnemy, color, dmg) {
    let b = bulletPool.get();
    if(b) {
        b.active = true; b.x = x; b.y = y; b.vx = vx; b.vy = vy;
        b.isEnemy = isEnemy; b.color = color; b.dmg = dmg;
    }
}

function playerShoot() {
    if (player.fireTimer > 0) return;
    player.fireTimer = player.weaponType === 3 ? 5 : 12; // Rapid vs Normal
    let dmg = 10 + (player.weaponLevel * 5);
    
    // Critical hit chance
    let isCrit = Math.random() < 0.1;
    if (isCrit) { dmg *= 2; spawnText(player.x, player.y - 20, "CRIT!", "#fbbf24"); }

    if (player.weaponType === 0) fireBullet(player.x + 22, player.y, 0, -15, false, isCrit ? '#fbbf24' : '#fff', dmg);
    else if (player.weaponType === 1) {
        fireBullet(player.x + 10, player.y, 0, -15, false, '#fff', dmg);
        fireBullet(player.x + 34, player.y, 0, -15, false, '#fff', dmg);
    } else {
        fireBullet(player.x + 22, player.y, 0, -15, false, '#fff', dmg);
        fireBullet(player.x + 10, player.y, -3, -14, false, '#fff', dmg);
        fireBullet(player.x + 34, player.y, 3, -14, false, '#fff', dmg);
    }
    playShoot();
}

function enemyShoot(e) {
    fireBullet(e.x + e.w/2 - 3, e.y + e.h, 0, 8 + (level*0.5), true, '#ef4444', 10);
}

function triggerGameOver() {
    if (!isPlaying) return;
    isPlaying = false;
    cancelAnimationFrame(animationId);
    mediaRecorder.stop();
    isUploading = true;
    document.getElementById('statusIndicator').innerText = "Processing Video...";
    document.getElementById('uploadProgress').classList.remove('hidden');

    mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', blob, 'recording.webm');
        formData.append('score', score);
        try {
            await fetch(`${backendUrl}/api/recordings/upload`, { method: 'POST', body: formData });
            loadLibrary();
        } catch (e) { console.error(e); } finally {
            isUploading = false; document.getElementById('uploadProgress').classList.add('hidden');
            if (loopCountTarget === -1 || currentLoop < loopCountTarget) setTimeout(startRun, 1000);
            else { document.getElementById('statusIndicator').innerText = "Ready"; document.getElementById('btnStart').disabled = false; }
        }
    };
}

function initGame() {
    if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); audioDest = audioCtx.createMediaStreamDestination(); }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    score = 0; level = 1; combo = 0; enemiesDestroyed = 0;
    player.x = 245; player.y = 800; player.hp = player.maxHp; player.shield = player.maxShield; player.weaponType = 0; player.weaponLevel = 1;
    bulletPool.active.forEach(b => bulletPool.release(b));
    particlePool.active.forEach(p => particlePool.release(p));
    textPool.active.forEach(t => textPool.release(t));
    enemies = []; powerups = [];
    waveManager.waveIndex = 0; waveManager.waveTimer = 60;
    shakeTime = 0;
}

function update() {
    if (!isPlaying) return;

    // Background
    bgY1 = (bgY1 + 0.5) % canvas.height; bgY2 = (bgY2 + 1.5) % canvas.height; bgY3 = (bgY3 + 3.0) % canvas.height;
    if (shakeTime > 0) shakeTime--;
    if (player.fireTimer > 0) player.fireTimer--;
    
    // Combo
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) combo = 0; // Combo dropped
    }

    // Player Movement & AI
    if (isAutoPlayer) {
        let target = null; let maxThreat = -Infinity;
        enemies.forEach(e => {
            let threat = e.y - Math.abs((e.x+e.w/2) - (player.x+player.w/2)) * 0.5;
            if (threat > maxThreat) { maxThreat = threat; target = e; }
        });
        if (target) {
            let tx = target.x + target.w/2 - player.w/2;
            if (target.formation === 'Snake') tx += Math.cos(Date.now()/200)*30;
            player.x += (tx - player.x) * 0.15;
        }
        if (Math.random() < 0.3) playerShoot();
    } else {
        if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
        if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
        if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed;
        if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed;
        if (keys['Space']) playerShoot();
    }
    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));

    // Waves
    waveManager.update();

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        e.y += e.speed;
        if (e.formation === 'Snake') e.x += Math.sin(Date.now()/300 + e.index) * 3;
        e.x = Math.max(0, Math.min(canvas.width - e.w, e.x));

        if (Math.random() < 0.01 + (level*0.002)) enemyShoot(e);

        if (e.y > canvas.height) { enemies.splice(i, 1); continue; }
        
        // Player Collision
        if (player.x < e.x+e.w && player.x+player.w > e.x && player.y < e.y+e.h && player.y+player.h > e.y) {
            player.shield -= 20; if (player.shield < 0) { player.hp += player.shield; player.shield = 0; }
            shakeTime = 20; enemies.splice(i, 1);
            if (player.hp <= 0) triggerGameOver();
        }
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        let p = powerups[i];
        p.y += 2;
        if (player.x < p.x+p.w && player.x+player.w > p.x && player.y < p.y+p.h && player.y+player.h > p.y) {
            if (p.type === 0) { player.hp = Math.min(player.maxHp, player.hp + 40); spawnText(player.x, player.y, "+HP", "#10b981"); }
            if (p.type === 1) { player.shield = Math.min(player.maxShield, player.shield + 50); spawnText(player.x, player.y, "+SHIELD", "#3b82f6"); }
            if (p.type === 2) { player.weaponType = Math.min(2, player.weaponType + 1); spawnText(player.x, player.y, "WEAPON UP", "#f59e0b"); }
            powerups.splice(i, 1);
        } else if (p.y > canvas.height) {
            powerups.splice(i, 1);
        }
    }

    // Bullets & Interception
    const pBullets = bulletPool.active.filter(b => !b.isEnemy);
    const eBullets = bulletPool.active.filter(b => b.isEnemy);

    bulletPool.active.forEach(b => {
        b.x += b.vx; b.y += b.vy;
        if (b.y < -50 || b.y > canvas.height + 50) bulletPool.release(b);
    });

    // Interception (Bullet vs Bullet)
    for (let i = pBullets.length - 1; i >= 0; i--) {
        let pb = pBullets[i];
        for (let j = eBullets.length - 1; j >= 0; j--) {
            let eb = eBullets[j];
            if (pb.active && eb.active && pb.x < eb.x+eb.w && pb.x+pb.w > eb.x && pb.y < eb.y+eb.h && pb.y+pb.h > eb.y) {
                bulletPool.release(pb); bulletPool.release(eb);
                spawnParticles(pb.x, pb.y, '#fbbf24', 5);
                playPing();
                score += 5; // Skill bonus
                spawnText(pb.x, pb.y, "INTERCEPT!", "#0ea5e9");
                break;
            }
        }
    }

    // Bullet vs Enemy
    pBullets.forEach(pb => {
        if (!pb.active) return;
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            if (pb.x < e.x+e.w && pb.x+pb.w > e.x && pb.y < e.y+e.h && pb.y+pb.h > e.y) {
                e.hp -= pb.dmg;
                bulletPool.release(pb);
                spawnParticles(pb.x, pb.y, pb.color, 3);
                
                if (e.hp <= 0) {
                    playExplosion(); shakeTime = 5;
                    combo++; comboTimer = maxComboTimer;
                    let pts = 10 * combo; score += pts; enemiesDestroyed++;
                    spawnText(e.x, e.y, `+${pts}`, "#fbbf24");
                    spawnParticles(e.x+e.w/2, e.y+e.h/2, '#f97316', 15);
                    if (Math.random() < 0.1) powerups.push({x: e.x+15, y: e.y+15, w: 20, h: 20, type: Math.floor(Math.random()*3)});
                    enemies.splice(i, 1);
                }
                break;
            }
        }
    });

    // Bullet vs Player
    eBullets.forEach(eb => {
        if (!eb.active) return;
        if (eb.x < player.x+player.w && eb.x+eb.w > player.x && eb.y < player.y+player.h && eb.y+eb.h > player.y) {
            bulletPool.release(eb);
            player.shield -= eb.dmg;
            if (player.shield < 0) { player.hp += player.shield; player.shield = 0; }
            shakeTime = 10;
            if (player.hp <= 0) triggerGameOver();
        }
    });

    // Particles & Text
    particlePool.active.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; p.size*=0.95; if(p.life<=0) particlePool.release(p); });
    textPool.active.forEach(t => { t.y -= 1; t.life--; if(t.life<=0) textPool.release(t); });
}

function draw() {
    ctx.save();
    if (shakeTime > 0) ctx.translate((Math.random()-0.5)*(shakeTime/2), (Math.random()-0.5)*(shakeTime/2));

    ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const drawLayer = (layer, yOffset, opacity) => {
        ctx.globalAlpha = opacity; ctx.fillStyle = '#fff';
        layer.forEach(s => { ctx.beginPath(); ctx.arc(s.x, (s.y + yOffset)%canvas.height, s.r, 0, Math.PI*2); ctx.fill(); });
    };
    drawLayer(starLayers[0], bgY1, 0.3); drawLayer(starLayers[1], bgY2, 0.6); drawLayer(starLayers[2], bgY3, 1.0);
    ctx.globalAlpha = 1.0;

    if (playerImg.complete) ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
    
    // Engine Glow
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(34,211,238,0.5)'; ctx.fillRect(player.x-10, player.y+player.h-5, player.w+20, 20+Math.random()*15);
    ctx.globalCompositeOperation = 'source-over';

    enemies.forEach(e => {
        if (enemyImages[e.type] && enemyImages[e.type].complete) ctx.drawImage(enemyImages[e.type], e.x, e.y, e.w, e.h);
        // Enemy HP bar
        ctx.fillStyle = '#000'; ctx.fillRect(e.x, e.y-8, e.w, 4);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(e.x, e.y-8, e.w * (e.hp/e.maxHp), 4);
    });

    powerups.forEach(p => { if (puImages[p.type] && puImages[p.type].complete) ctx.drawImage(puImages[p.type], p.x, p.y, p.w, p.h); });

    bulletPool.active.forEach(b => {
        ctx.fillStyle = b.isEnemy ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.5)';
        ctx.fillRect(b.x-2, b.y-2, b.w+4, b.h+4);
        ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    ctx.globalCompositeOperation = 'screen';
    particlePool.active.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1.0;

    // HUD
    // Top Center: Score & Combo
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif';
    ctx.shadowBlur = 10; ctx.shadowColor = '#0ea5e9';
    ctx.fillText(`SCORE: ${score}`, canvas.width/2, 40);
    ctx.shadowBlur = 0;
    
    if (combo > 1) {
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`${combo}x COMBO`, canvas.width/2, 75);
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(canvas.width/2 - 50, 85, 100 * (comboTimer/maxComboTimer), 4);
    }
    
    // Top Left: HP/Shield
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(10, 10, 200, 50);
    ctx.fillStyle = '#3f3f46'; ctx.fillRect(20, 20, 180, 10); ctx.fillRect(20, 40, 180, 10);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(20, 20, Math.max(0, (player.hp/player.maxHp)*180), 10);
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(20, 40, Math.max(0, (player.shield/player.maxShield)*180), 10);
    
    // Top Right: Level
    ctx.textAlign = 'right'; ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`WAVE: ${level}`, canvas.width - 20, 35);

    // Floating Texts
    ctx.textAlign = 'center'; ctx.font = 'bold 16px monospace';
    textPool.active.forEach(t => {
        ctx.fillStyle = t.color; ctx.globalAlpha = t.life/40;
        ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
}

function loop() { update(); draw(); if(isPlaying) animationId = requestAnimationFrame(loop); }

// --- UI RECORDING BINDS ---
let isInfinite = false;
document.getElementById('btnStart').addEventListener('click', () => { loopCountTarget = isInfinite ? -1 : 1; currentLoop = 0; startRun(); });
document.getElementById('btnStop').addEventListener('click', () => { loopCountTarget = 0; triggerGameOver(); });

function startRun() {
    if (isUploading) return;
    currentLoop++; initGame(); isPlaying = true; recordedChunks = [];
    const combinedStream = new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...audioDest.stream.getAudioTracks()]);
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.start();
    document.getElementById('btnStart').disabled = true; document.getElementById('btnStop').disabled = false;
    document.getElementById('statusIndicator').innerText = "🔴 Recording Arcade Mode";
    document.getElementById('statusIndicator').className = 'bg-red-900 text-red-300 px-4 py-2 rounded-full border border-red-700 font-bold';
    loop();
}

// --- LIBRARY LOGIC ---
async function loadLibrary() {
    const list = document.getElementById('libraryList');
    try {
        const res = await fetch(`${backendUrl}/api/recordings`);
        const files = await res.json();
        list.innerHTML = files.length === 0 ? "<div class='text-slate-400 p-4'>No videos generated yet.</div>" : files.map(f => `
          <div class="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-700 mb-2">
            <span class="font-mono text-sm">${f}</span>
            <div class="flex gap-3">
              <a href="${backendUrl}/recordings/${f}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">View</a>
            </div>
          </div>
        `).join('');
    } catch (e) { list.innerHTML = "<div class='text-red-400'>Error loading library</div>"; }
}
loadLibrary();
