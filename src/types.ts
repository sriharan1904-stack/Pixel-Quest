/**
 * Type declarations for Pixel Quest 2012
 */

export interface Vector2D {
  x: number;
  y: number;
}

export type ThemeType = 'forest' | 'desert' | 'ice' | 'volcano' | 'sky';

export interface LevelElement {
  id: string;
  x: number;  // Tile-based or absolute position depending on usage, let's store absolute pixel sizes or tile coords
  y: number;
  width: number;
  height: number;
  type?: string;
}

export interface Platform extends LevelElement {
  behavior?: 'static' | 'moving' | 'falling';
  rangeX?: [number, number];
  rangeY?: [number, number];
  speed?: number;
  direction?: number;
  state?: 'idle' | 'falling' | 'destroyed';
  timer?: number;
  resetTimer?: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'walker' | 'flyer' | 'jumper' | 'boss';
  health: number;
  maxHealth: number;
  speed: number;
  patrolRange: number;
  startX: number;
  startY: number;
  direction: number;
  jumpTimer?: number;
  state?: string;
  shootTimer?: number;
}

export interface Collectible {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'coin' | 'gem' | 'star' | 'chest';
  collected: boolean;
  value: number;
}

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'shield' | 'speed' | 'magnet' | 'double_jump' | 'invincibility';
  collected: boolean;
  duration?: number;
}

export interface Checkpoint {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  activated: boolean;
}

export interface LevelLayout {
  theme: ThemeType;
  difficulty: 'easy' | 'medium' | 'hard';
  length: number; // total width in tiles coordinates (e.g. 150)
  platforms: Platform[];
  enemies: Enemy[];
  collectibles: Collectible[];
  powerups: PowerUp[];
  checkpoint: Vector2D;
  goal: { x: number; y: number; width: number; height: number };
  boss?: Enemy;
}

// Player States
export interface PlayerStats {
  speedLevel: number;
  jumpLevel: number;
  dashLevel: number;
  healthLevel: number;
  magnetLevel: number;
  coins: number;
  starsUnlocked: number;
  unlockedSkins: string[];
  activeSkin: 'retro' | 'robot' | 'ninja' | 'space';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  icon: string;
}

export interface AIQuest {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  targetCount: number;
  currentCount: number;
  type: 'collect_coins' | 'defeat_enemies' | 'collect_gems' | 'no_damage_clear' | 'time_trial';
  completed: boolean;
}

export interface NPCDialogue {
  greeting: string;
  hint: string;
  farewell: string;
}

export interface LevelScore {
  stars: number;
  coinsCollected: number;
  timeTaken: number;
  enemiesDefeated: number;
  completed: boolean;
  unlocked: boolean;
}
