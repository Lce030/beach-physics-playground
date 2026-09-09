import type { PourEvent } from '../physics/ContainerSystem';
import type { SplashEvent } from '../physics/WaterSystem';

interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

/** The white crown thrown up at the point of impact. */
interface Crown {
  x: number;
  y: number;
  width: number;
  height: number;
  life: number;
  maxLife: number;
}

/**
 * Droplets and ripples. Visual only, not Matter bodies: a strong splash makes
 * around twenty, which would eat the body budget for nothing.
 */
export class SplashSystem {
  private readonly droplets: Droplet[] = [];
  private readonly rings: Ring[] = [];
  private readonly crowns: Crown[] = [];

  /** Hard cap. Past this we stop emitting, not simulating. */
  private static readonly MAX_DROPLETS = 220;

  spawn(event: SplashEvent): void {
    const count = Math.round(7 + event.strength * 18);
    const spread = Math.max(10, event.width * 0.4);

    for (let i = 0; i < count; i += 1) {
      if (this.droplets.length >= SplashSystem.MAX_DROPLETS) break;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = (0.12 + Math.random() * 0.22) * (0.5 + event.strength);
      const maxLife = 380 + Math.random() * 460;
      this.droplets.push({
        x: event.x + (Math.random() - 0.5) * spread,
        y: event.y - Math.random() * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.2 + Math.random() * 3.4,
        life: maxLife,
        maxLife,
      });
    }

    this.crowns.push({
      x: event.x,
      y: event.y,
      width: event.width * (0.5 + event.strength * 0.5),
      height: 14 + event.strength * 34,
      life: 340,
      maxLife: 340,
    });

    this.rings.push({
      x: event.x,
      y: event.y,
      radius: event.width * 0.35,
      maxRadius: event.width * (1.1 + event.strength * 1.4),
      life: 620,
      maxLife: 620,
    });
  }

  /** Stream from a tipped bucket: same droplets, no crown or ripple. */
  pour(event: PourEvent): void {
    if (this.droplets.length >= SplashSystem.MAX_DROPLETS) return;

    const count = event.amount > 30 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const maxLife = 420 + Math.random() * 320;
      this.droplets.push({
        x: event.x + (Math.random() - 0.5) * 7,
        y: event.y + (Math.random() - 0.5) * 5,
        vx: event.directionX * (0.02 + Math.random() * 0.06),
        vy: 0.02 + Math.random() * 0.06,
        radius: 2 + Math.random() * 2.6,
        life: maxLife,
        maxLife,
      });
    }
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 50);

    for (let i = this.droplets.length - 1; i >= 0; i -= 1) {
      const drop = this.droplets[i];
      if (!drop) continue;
      drop.life -= dt;
      if (drop.life <= 0) {
        this.droplets.splice(i, 1);
        continue;
      }
      drop.vy += 0.00085 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      if (!ring) continue;
      ring.life -= dt;
      if (ring.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const progress = 1 - ring.life / ring.maxLife;
      ring.radius = ring.maxRadius * (0.25 + progress * 0.75);
    }

    for (let i = this.crowns.length - 1; i >= 0; i -= 1) {
      const crown = this.crowns[i];
      if (!crown) continue;
      crown.life -= dt;
      if (crown.life <= 0) this.crowns.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const ring of this.rings) {
      const fade = ring.life / ring.maxLife;
      ctx.beginPath();
      ctx.ellipse(ring.x, ring.y, ring.radius, ring.radius * 0.22, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // The crown rises and falls in about a third of a second.
    for (const crown of this.crowns) {
      const progress = 1 - crown.life / crown.maxLife;
      const rise = Math.sin(progress * Math.PI);
      const fade = 1 - progress;
      ctx.beginPath();
      const peak = crown.y - crown.height * rise;
      ctx.moveTo(crown.x - crown.width / 2, crown.y);
      ctx.quadraticCurveTo(crown.x - crown.width * 0.22, peak, crown.x, peak * 0.28 + crown.y * 0.72);
      ctx.quadraticCurveTo(crown.x + crown.width * 0.22, peak, crown.x + crown.width / 2, crown.y);
      ctx.closePath();
      ctx.fillStyle = `rgba(245,253,255,${0.72 * fade})`;
      ctx.fill();
    }

    for (const drop of this.droplets) {
      const fade = Math.min(1, drop.life / (drop.maxLife * 0.6));
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(238,252,255,${0.85 * fade})`;
      ctx.fill();
    }

    ctx.restore();
  }

  clear(): void {
    this.droplets.length = 0;
    this.rings.length = 0;
    this.crowns.length = 0;
  }
}
