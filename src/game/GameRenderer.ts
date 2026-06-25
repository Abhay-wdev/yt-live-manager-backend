let CanvasRenderingContext2D: any, Image: any, loadImage: any, Canvas: any, createCanvas: any;
let isCanvasSupported = false;
try {
  const canvasModule = require('canvas');
  CanvasRenderingContext2D = canvasModule.CanvasRenderingContext2D;
  Image = canvasModule.Image;
  loadImage = canvasModule.loadImage;
  Canvas = canvasModule.Canvas;
  createCanvas = canvasModule.createCanvas;
  isCanvasSupported = true;
} catch (e) {
  console.warn("Canvas module not found. Server-side rendering disabled.");
}

import { GameState } from './GameEngine';
import path from 'path';

export class GameRenderer {
  public static imageCache: Record<string, any> = {};
  public static get isSupported() { return isCanvasSupported; }

  public static async loadAssets() {
    if (!isCanvasSupported) return;
    const assets = ['rocket', 'scout-ship', 'alien-stare', 'alien-skull', 'glider', 'drill', 'grease-trap'];
    for (const name of assets) {
      if (!this.imageCache[name]) {
        const img = await loadImage(path.join(process.cwd(), 'src/assets/svg', `${name}.svg`));
        const offscreen = createCanvas(100, 100);
        const octx = offscreen.getContext('2d');
        octx.drawImage(img, 0, 0, 100, 100);
        this.imageCache[name] = offscreen;
      }
    }
  }
  private ctx: any;
  private width: number;
  private height: number;

  constructor(ctx: any, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  public render(state: GameState) {
    this.ctx.save();
    
    // Screen Shake
    if (state.shakeTime > 0) {
      const magnitude = (state.shakeTime / 30) * 10;
      const dx = (Math.random() - 0.5) * magnitude;
      const dy = (Math.random() - 0.5) * magnitude;
      this.ctx.translate(dx, dy);
    }

    // Deep Space Background
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    bgGradient.addColorStop(0, "#020617"); // slate-950
    bgGradient.addColorStop(1, "#1e1b4b"); // indigo-950
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Parallax Stars (Generated pseudo-randomly based on bgY1, bgY2, bgY3 so they are deterministic or we just use simple math)
    this.ctx.fillStyle = '#ffffff';
    this.drawStars(state.bgY1, 150, 1, 0.3);
    this.drawStars(state.bgY2, 70, 2, 0.6);
    this.drawStars(state.bgY3, 30, 3, 1.0);

    // Draw Player
    this.drawPlayer(state.player.x, state.player.y, state.player.w, state.player.h);
    
    // Engine thrust glow
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
    this.ctx.fillRect(state.player.x - 20, state.player.y + state.player.h - 10, state.player.w + 40, 30 + Math.random()*15);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fillRect(state.player.x + 10, state.player.y + state.player.h - 5, state.player.w - 20, 15 + Math.random()*10);
    this.ctx.globalCompositeOperation = 'source-over';

    // Bullets
    state.bullets.forEach(b => {
      this.ctx.fillStyle = 'rgba(217, 70, 239, 0.4)';
      this.ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    // Enemies
    state.enemies.forEach(e => {
      this.drawEnemy(e.type, e.x, e.y, e.w, e.h);
    });

    // Particles
    this.ctx.globalCompositeOperation = 'screen';
    state.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life / 50;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';

    // Floating Texts
    this.ctx.font = "bold 20px monospace";
    this.ctx.textAlign = "center";
    state.floatingTexts.forEach(ft => {
      this.ctx.fillStyle = `rgba(134, 239, 172, ${ft.life / 40})`;
      this.ctx.fillText(ft.text, ft.x, ft.y);
    });

    // Arcade Scanlines
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for(let i = 0; i < this.height; i += 4) {
      this.ctx.fillRect(0, i, this.width, 2);
    }
    
    // Score Text
    this.ctx.font = "bold 30px monospace";
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = "left";
    this.ctx.fillText(`SCORE: ${state.score}`, 20, 40);

    this.ctx.restore();
  }

  private drawStars(yOffset: number, count: number, radius: number, alpha: number) {
    this.ctx.globalAlpha = alpha;
    // Deterministic random for stars based on index so they don't jump around
    for (let i = 0; i < count; i++) {
      const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * this.width;
      const staticY = (Math.cos(i * 321.65) * 0.5 + 0.5) * this.height;
      const y = (staticY + yOffset) % this.height;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
  }

  private drawPlayer(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.translate(x, y);
    // Scale standard 100x100 SVG coordinates to w, h
    this.ctx.scale(w / 100, h / 100);
    
    // Neon aura
    this.ctx.strokeStyle = '#06b6d4';
    this.ctx.lineWidth = 6;
    this.ctx.globalAlpha = 0.6;
    this.ctx.beginPath();
    this.ctx.moveTo(50, 15);
    this.ctx.lineTo(95, 65);
    this.ctx.lineTo(95, 95);
    this.ctx.lineTo(50, 75);
    this.ctx.lineTo(5, 95);
    this.ctx.lineTo(5, 65);
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.globalAlpha = 1.0;
    this.ctx.fillStyle = '#082f49';
    this.ctx.strokeStyle = '#22d3ee';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(50, 20);
    this.ctx.lineTo(90, 60);
    this.ctx.lineTo(90, 90);
    this.ctx.lineTo(50, 70);
    this.ctx.lineTo(10, 90);
    this.ctx.lineTo(10, 60);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#64748b';
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(18, 40, 10, 30);
    this.ctx.strokeRect(18, 40, 10, 30);
    this.ctx.fillRect(72, 40, 10, 30);
    this.ctx.strokeRect(72, 40, 10, 30);

    this.ctx.fillStyle = '#bae6fd';
    this.ctx.beginPath();
    this.ctx.moveTo(50, 28);
    this.ctx.lineTo(65, 58);
    this.ctx.lineTo(50, 70);
    this.ctx.lineTo(35, 58);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawEnemy(type: string, x: number, y: number, w: number, h: number) {
    const img = GameRenderer.imageCache[type];
    if (img) {
      this.ctx.drawImage(img as any, x, y, w, h);
    } else {
      this.ctx.fillStyle = '#450a0a';
      this.ctx.fillRect(x, y, w, h);
    }
  }
}
