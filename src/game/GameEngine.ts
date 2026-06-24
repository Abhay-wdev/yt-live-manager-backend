export interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  vx?: number;
  vy?: number;
  speed?: number;
}

export interface Enemy extends Entity {
  type: string;
  hp: number;
  isWavy: boolean;
  isZigzag: boolean;
  spawnTime: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
}

export interface GameState {
  score: number;
  player: Entity;
  bullets: Entity[];
  enemies: Enemy[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  bgY1: number;
  bgY2: number;
  bgY3: number;
  shakeTime: number;
  isGameOver: boolean;
  frameCount: number;
}

export class GameEngine {
  public state: GameState;
  private isAutoPlay: boolean;

  constructor(isAutoPlay: boolean = true) {
    this.isAutoPlay = isAutoPlay;
    this.state = this.getInitialState();
  }

  public reset() {
    this.state = this.getInitialState();
  }

  private getInitialState(): GameState {
    return {
      score: 0,
      player: { x: 270, y: 850, w: 40, h: 40, speed: 7 },
      bullets: [],
      enemies: [],
      particles: [],
      floatingTexts: [],
      bgY1: 0,
      bgY2: 0,
      bgY3: 0,
      shakeTime: 0,
      isGameOver: false,
      frameCount: 0
    };
  }

  public update() {
    if (this.state.isGameOver) return;
    this.state.frameCount++;

    // --- AI AUTO-PLAYER LOGIC ---
    if (this.isAutoPlay) {
      let targetEnemy = null;
      let maxThreat = -Infinity;
      
      this.state.enemies.forEach(e => {
        let dist = Math.abs((e.x + e.w/2) - (this.state.player.x + this.state.player.w/2));
        let threat = e.y - (dist * 0.4); 
        if (threat > maxThreat) {
          maxThreat = threat;
          targetEnemy = e;
        }
      });

      if (targetEnemy) {
        let targetX = targetEnemy.x + targetEnemy.w/2;
        if (targetEnemy.isWavy) targetX += Math.cos((Date.now() - targetEnemy.spawnTime) / 200) * 25;
        if (targetEnemy.isZigzag) targetX -= Math.sin((Date.now() - targetEnemy.spawnTime) / 150) * 30;
        
        let desiredX = targetX - this.state.player.w/2;
        this.state.player.x += (desiredX - this.state.player.x) * 0.15;
      }
      
      if (Math.random() < 0.2) {
        if (this.state.bullets.length === 0 || this.state.bullets[this.state.bullets.length - 1].y < this.state.player.y - 30) {
          this.state.bullets.push({ x: this.state.player.x + this.state.player.w/2 - 2.5, y: this.state.player.y, w: 5, h: 20, speed: 15 });
        }
      }
    } else {
      // Apply manual player velocity
      if (this.state.player.vx) {
        this.state.player.x += this.state.player.vx;
        this.state.player.x = Math.max(0, Math.min(540 - this.state.player.w, this.state.player.x));
      }
    }

    // Update bullets
    this.state.bullets.forEach(b => b.y -= b.speed!);
    this.state.bullets = this.state.bullets.filter(b => b.y > -20);

    // Update enemies
    this.spawnEnemy();
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      let e = this.state.enemies[i];
      e.y += e.speed!;
      
      if (e.isWavy) e.x += Math.sin((Date.now() - e.spawnTime) / 200) * 3;
      if (e.isZigzag) e.x += Math.cos((Date.now() - e.spawnTime) / 150) * 4;

      e.x = Math.max(0, Math.min(540 - e.w, e.x));

      if (e.y > 960) {
        this.state.enemies.splice(i, 1);
        continue;
      }
    }
    
    // Update particles
    this.state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      p.size *= 0.95;
    });
    this.state.particles = this.state.particles.filter(p => p.life > 0);

    // Update floating texts
    this.state.floatingTexts.forEach(ft => {
      ft.y -= 1;
      ft.life -= 1;
    });
    this.state.floatingTexts = this.state.floatingTexts.filter(ft => ft.life > 0);

    // Update background parallax
    this.state.bgY1 = (this.state.bgY1 + 0.5) % 960;
    this.state.bgY2 = (this.state.bgY2 + 1.5) % 960;
    this.state.bgY3 = (this.state.bgY3 + 3.0) % 960;

    if (this.state.shakeTime > 0) this.state.shakeTime--;

    // Collision (Bullet hits Enemy)
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      for (let j = this.state.bullets.length - 1; j >= 0; j--) {
        const e = this.state.enemies[i];
        const b = this.state.bullets[j];
        if (!e || !b) continue;
        
        if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
          e.hp -= 1;
          this.state.bullets.splice(j, 1);
          
          if (e.hp <= 0) {
            for(let k=0; k<10; k++) {
              this.state.particles.push({
                x: e.x + e.w/2, y: e.y + e.h/2,
                vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15,
                life: 30 + Math.random() * 20,
                size: 3 + Math.random() * 5,
                color: Math.random() > 0.5 ? '#f97316' : '#ef4444'
              });
            }
            this.state.shakeTime = 10;
            this.state.score += 10;
            this.state.floatingTexts.push({ x: e.x + e.w/2, y: e.y, text: '+10', life: 40 });
            this.state.enemies.splice(i, 1);
          }
          break;
        }
      }
    }

    // Check game over
    this.state.enemies.forEach(e => {
      const p = this.state.player;
      if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        this.state.shakeTime = 30;
        this.state.isGameOver = true;
      }
    });
    
    this.state.enemies = this.state.enemies.filter(e => e.y < 960);
  }

  private spawnEnemy() {
    if (Math.random() < 0.05) { // 5% chance per frame
      const types = ['rocket', 'scout-ship', 'alien-stare', 'alien-skull', 'glider', 'drill', 'grease-trap'];
      let eType = types[Math.floor(Math.random() * types.length)];

      let hp = 1, speed = 3, w = 40, h = 40;
      if (eType === 'alien-stare' || eType === 'alien-skull') { speed = 1.5; w = 60; h = 60; }
      else if (eType === 'drill' || eType === 'grease-trap') { speed = 1; w = 80; h = 80; }
      else if (eType === 'rocket' || eType === 'glider') { speed = 6; w = 30; h = 30; }
      
      this.state.enemies.push({ 
        x: Math.random() * (540 - 50), 
        y: -50, 
        w: w, 
        h: h, 
        type: eType,
        speed: speed,
        hp: hp,
        isWavy: ['scout-ship', 'alien-stare', 'drill'].includes(eType),
        isZigzag: ['rocket', 'glider'].includes(eType),
        spawnTime: Date.now()
      });
    }
  }

  public handleInput(type: string, payload: any) {
    if (this.isAutoPlay) return;
    if (type === 'keydown') {
      if (payload.key === 'ArrowLeft') this.state.player.vx = -this.state.player.speed!;
      if (payload.key === 'ArrowRight') this.state.player.vx = this.state.player.speed!;
      if (payload.key === ' ' && this.state.bullets.length < 5) {
        this.state.bullets.push({ x: this.state.player.x + this.state.player.w/2 - 2.5, y: this.state.player.y, w: 5, h: 20, speed: 15 });
      }
    } else if (type === 'keyup') {
      if (payload.key === 'ArrowLeft' && this.state.player.vx! < 0) this.state.player.vx = 0;
      if (payload.key === 'ArrowRight' && this.state.player.vx! > 0) this.state.player.vx = 0;
    }
  }
}
