import React, { useRef, useEffect, useState } from 'react';
import { Gamepad2, Volume2, VolumeX, Shield, Zap, Sparkles, Heart, Activity, RotateCw, Play, Pause, ChevronLeft } from 'lucide-react';
import { sound } from '../sound';
import { LevelLayout, PlayerStats, ThemeType } from '../types';

interface GameCanvasProps {
  layout: LevelLayout;
  stats: PlayerStats;
  onUpdateCoins: (amount: number) => void;
  onLevelComplete: (coinsEarned: number, timeSpent: number, stars: number) => void;
  onExit: () => void;
}

export default function GameCanvas({ layout, stats, onUpdateCoins, onLevelComplete, onExit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game UI States
  const [isPlaying, setIsPlaying] = useState(true);
  const [isJetpackMode, setIsJetpackMode] = useState(true);
  const [lives, setLives] = useState(3);
  const [health, setHealth] = useState(3); // Start with 3 hearts (max health can be upgraded)
  const [maxHealth, setMaxHealth] = useState(3);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameWon, setIsGameWon] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.isMuted());

  // Input states (Keyboard)
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Mobile virtual buttons
  const virtualControlsRef = useRef({
    left: false,
    right: false,
    jump: false,
    dash: false,
    shoot: false,
  });

  // Track if level items are loaded / mutable copies
  const levelStateRef = useRef<{
    platforms: any[];
    enemies: any[];
    collectibles: any[];
    powerups: any[];
    checkpoint: { x: number; y: number; activated: boolean };
    goal: { x: number; y: number; width: number; height: number };
    zappers: any[];
  }>({
    platforms: [],
    enemies: [],
    collectibles: [],
    powerups: [],
    checkpoint: { x: 0, y: 0, activated: false },
    goal: { x: 0, y: 0, width: 40, height: 80 },
    zappers: [],
  });

  // Physics constraints & parameters
  const playerRef = useRef({
    x: 100,
    y: 350,
    width: 28,
    height: 48,
    vx: 0,
    vy: 0,
    isOnGround: false,
    doubleJumpUnlocked: true,
    hasDoubleJumped: false,
    canDash: true,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirection: 1,
    facing: 1, // 1 for right, -1 for left
    
    // Active power-up states with durations in frames
    shieldActive: false,
    speedBoostActive: false,
    speedBoostDuration: 0,
    magnetActive: false,
    magnetDuration: 0,
    invincibleActive: false,
    invincibleDuration: 0,
    immunityTimer: 0, // brief immunity after taking damage
    shootCooldown: 0, // Player shooting rate limiting

    // Animation frames
    animFrame: 0,
    animTimer: 0,
  });

  // Particle list
  const particlesRef = useRef<any[]>([]);

  // Player gun bullets list
  const playerBulletsRef = useRef<any[]>([]);

  // Timer loop
  useEffect(() => {
    if (!isPlaying || isGameOver || isGameWon) return;
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isGameOver, isGameWon]);

  // Sync Max HP upgrade from user stats selection
  useEffect(() => {
    const calculatedMaxHP = 3 + stats.healthLevel;
    setMaxHealth(calculatedMaxHP);
    setHealth(calculatedMaxHP);
    setLives(3);
    setCoinsCollected(0);
    setTimeSpent(0);
    setIsGameOver(false);
    setIsGameWon(false);

    // Deep copy and enrich layout elements with Mario Question Blocks and Jetpack Zappers!
    const rawPlatforms = JSON.parse(JSON.stringify(layout.platforms));
    const rawZappers = JSON.parse(JSON.stringify(layout.zappers || []));
    
    // Convert floating platforms at proper heights into Mario Question Blocks!
    rawPlatforms.forEach((plat: any) => {
      // Small to medium platforms in air
      if (plat.width <= 180 && !plat.behavior && plat.y < 390 && plat.id !== 'w_start' && plat.id !== 'w_end') {
        plat.isQuestionBlock = true;
        plat.questionState = 'active';
        plat.questionContent = Math.random() < 0.25 ? 'shield' : 'coin';
        plat.bounceY = 0;
      }
    });

    // Make sure we have at least 3 Question Blocks in the level if none found
    const qCount = rawPlatforms.filter((p: any) => p.isQuestionBlock).length;
    if (qCount < 3 && rawPlatforms.length > 5) {
      for (let i = 2; i < Math.min(rawPlatforms.length - 1, 8); i++) {
        const p = rawPlatforms[i];
        if (p.width >= 40 && p.y < 420 && p.id !== 'w_start' && p.id !== 'w_end') {
          p.isQuestionBlock = true;
          p.questionState = 'active';
          p.questionContent = 'coin';
          p.bounceY = 0;
        }
      }
    }

    // Generate procedural Jetpack Joyride electric zappers if none exist!
    if (rawZappers.length === 0) {
      const levelEndAbsoluteX = layout.goal ? layout.goal.x : (layout.length ? layout.length * 32 : 2500);
      let currentZpX = 450;
      let zpId = 1;
      while (currentZpX < levelEndAbsoluteX - 350) {
        const isSpinned = Math.random() < 0.4;
        const zpY = 120 + Math.floor(Math.random() * 150); // heights safe for flight
        
        if (isSpinned) {
          rawZappers.push({
            id: `zapper_proc_${zpId++}`,
            x: currentZpX,
            y: zpY,
            width: 80,
            height: 80,
            angle: Math.random() * Math.PI,
            active: true
          });
        } else {
          const isVert = Math.random() < 0.5;
          rawZappers.push({
            id: `zapper_proc_${zpId++}`,
            x: currentZpX,
            y: zpY,
            width: isVert ? 12 : 80,
            height: isVert ? 80 : 12,
            active: true
          });
        }
        currentZpX += 280 + Math.floor(Math.random() * 180); // Distance between zappers
      }
    }

    levelStateRef.current = {
      platforms: rawPlatforms,
      enemies: JSON.parse(JSON.stringify(layout.enemies)),
      collectibles: JSON.parse(JSON.stringify(layout.collectibles || [])),
      powerups: JSON.parse(JSON.stringify(layout.powerups || [])),
      checkpoint: { 
        x: layout.checkpoint ? layout.checkpoint.x : 500, 
        y: layout.checkpoint ? layout.checkpoint.y : 400, 
        activated: false 
      },
      goal: { ...layout.goal },
      zappers: rawZappers
    };

    // Spawn player at start (x 100, y 350)
    playerRef.current.x = 100;
    playerRef.current.y = 350;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.shieldActive = false;
    playerRef.current.speedBoostActive = false;
    playerRef.current.magnetActive = false;
    playerRef.current.invincibleActive = false;
    playerRef.current.immunityTimer = 0;
    playerRef.current.shootCooldown = 0;
    playerBulletsRef.current = [];

    // Play classic context BGM
    if (layout.customBgm) {
      sound.playAIComposition(layout.customBgm);
    } else {
      sound.playBGM(layout.theme === 'sky' || stats.healthLevel >= 2 ? 'boss' : 'world');
    }

    return () => sound.stopBGM();
  }, [layout, stats]);

  // Main input events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      keysRef.current[e.code] = true;
      
      // Prevent browser spatial scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // SQUISH ENEMY / SQUISH SMOKE Particles
  const spawnExplosionParticles = (x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        radius: Math.random() * 4 + 2,
        color,
        alpha: 1,
        life: 1,
        decay: Math.random() * 0.05 + 0.03
      });
    }
  };

  // Main Canvas Game Loop
  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateAndRender = () => {
      if (!isPlaying || isGameOver || isGameWon) {
        // Draw last screen frozen
        drawGame(ctx, canvas);
        animationId = requestAnimationFrame(updateAndRender);
        return;
      }

      // 1. UPDATE STATE
      updatePhysics();
      updateEnemies();
      updateZappers();
      updateParticles();
      updatePlayerBullets();

      // 2. RENDERING
      drawGame(ctx, canvas);

      animationId = requestAnimationFrame(updateAndRender);
    };

    animationId = requestAnimationFrame(updateAndRender);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, isGameOver, isGameWon]);

  // Helper AABB Collision
  const isOverlapping = (rect1: any, rect2: any) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // Physics Engine Solver
  const updatePhysics = () => {
    const player = playerRef.current;
    const level = levelStateRef.current;

    // Movement speed multiplier based on upgrade stats + active Speed Boost power-up
    const baseSpeed = 4 + stats.speedLevel * 0.5;
    const speedMultiplier = player.speedBoostActive ? 1.6 : 1.0;
    const targetSpeed = baseSpeed * speedMultiplier;

    // Jump force upgraded stats
    const baseJumpMultiplier = 11.5 + stats.jumpLevel * 0.35;

    // Immunity decay
    if (player.immunityTimer > 0) player.immunityTimer--;

    // Power-ups tick durations
    if (player.speedBoostActive) {
      player.speedBoostDuration--;
      if (player.speedBoostDuration <= 0) player.speedBoostActive = false;
    }
    if (player.magnetActive) {
      player.magnetDuration--;
      if (player.magnetDuration <= 0) player.magnetActive = false;
    }
    if (player.invincibleActive) {
      player.invincibleDuration--;
      if (player.invincibleDuration <= 0) player.invincibleActive = false;
    }

    // Horizontal Movement Inputs
    const leftInput = keysRef.current['ArrowLeft'] || keysRef.current['KeyA'] || virtualControlsRef.current.left;
    const rightInput = keysRef.current['ArrowRight'] || keysRef.current['KeyD'] || virtualControlsRef.current.right;
    const jumpInput = keysRef.current['ArrowUp'] || keysRef.current['Space'] || keysRef.current['KeyW'] || virtualControlsRef.current.jump;
    const dashInput = keysRef.current['ShiftLeft'] || keysRef.current['KeyX'] || virtualControlsRef.current.dash;
    const shootInput = keysRef.current['KeyF'] || keysRef.current['f'] || keysRef.current['Enter'] || keysRef.current['KeyZ'] || virtualControlsRef.current.shoot;

    // Firing shooting bullets using Mario's gun
    if (player.shootCooldown === undefined) player.shootCooldown = 0;
    if (player.shootCooldown > 0) player.shootCooldown--;

    if (shootInput && player.shootCooldown <= 0) {
      player.shootCooldown = 15; // 15 frames cooldown between shots
      sound.playShoot();
      
      const bulletX = player.facing > 0 ? player.x + player.width + 12 : player.x - 16;
      const bulletY = player.y + 24;
      
      playerBulletsRef.current.push({
        x: bulletX,
        y: bulletY,
        vx: player.facing * 11,
        vy: 0,
        width: 12,
        height: 6,
        color: '#fbbf24',
        life: 1.0,
        decay: 0.02
      });
    }

    // Facing direction
    if (leftInput && !rightInput) {
      player.facing = -1;
    } else if (rightInput && !leftInput) {
      player.facing = 1;
    }

    // Animation frame increments
    if (leftInput || rightInput) {
      player.animTimer++;
      if (player.animTimer % 6 === 0) {
        player.animFrame = (player.animFrame + 1) % 4;
      }
    } else {
      player.animFrame = 0;
    }

    // Dash execution
    if (player.dashCooldown > 0) player.dashCooldown--;

    if (dashInput && player.canDash && player.dashCooldown <= 0 && !player.isDashing) {
      player.isDashing = true;
      player.canDash = false;
      player.dashTimer = 10; // dash lasts 10 frames
      player.dashCooldown = 60 - stats.dashLevel * 6; // dash cooldown upgraded
      player.dashDirection = player.facing;
      player.vy = 0; // horizontal dash
      sound.playDash();
      
      // Spawn trail particles
      spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#a78bfa', 6);
    }

    if (player.isDashing) {
      player.vx = player.dashDirection * 12; // super dash velocity
      player.dashTimer--;
      if (player.dashTimer <= 0) {
        player.isDashing = false;
      }
      
      // Spawn tiny cosmetic wind line particles
      particlesRef.current.push({
        x: player.x + (player.dashDirection > 0 ? 0 : player.width),
        y: player.y + Math.random() * player.height,
        vx: -player.dashDirection * 2,
        vy: 0,
        radius: Math.random() * 2 + 1,
        color: 'rgba(255, 255, 255, 0.6)',
        alpha: 0.8,
        life: 0.8,
        decay: 0.08
      });
    } else {
      // Normal acceleration / friction
      if (leftInput) {
        player.vx = Math.max(player.vx - 0.5, -targetSpeed);
      } else if (rightInput) {
        player.vx = Math.min(player.vx + 0.5, targetSpeed);
      } else {
        // Friction on floor vs ice
        const friction = layout.theme === 'ice' ? 0.97 : 0.85;
        player.vx *= friction;
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
      }

      // Apply Gravity
      player.vy += 0.5; // Acceleration of gravity
      const terminalVelocity = 12;
      if (player.vy > terminalVelocity) player.vy = terminalVelocity;
    }

    // Jump / Thrust Input Triggers (Jetpack Joyride vs Super Mario)
    if (isJetpackMode) {
      if (jumpInput) {
        // Continuous upward thrust in jetpack mode
        player.vy = Math.max(player.vy - 0.75, -7.5);
        player.isOnGround = false;

        // Signature Jetpack Joyride Machine-Gun bullet sparks discharging downward!
        if (Math.random() < 0.45) {
          sound.playShoot(); // nice tactile audio feedback
          
          const sparkDirectionX = player.facing > 0 ? player.x + 2 : player.x + player.width - 6;
          const sparkY = player.y + player.height - 4;
          
          // These sparks travel down, stomping any walker / flyer enemies directly below Mario!
          playerBulletsRef.current.push({
            id: `spark_${Date.now()}_${Math.random()}`,
            x: sparkDirectionX + (Math.random() - 0.5) * 6,
            y: sparkY,
            vx: (Math.random() - 0.5) * 4,
            vy: 10 + Math.random() * 3, // fast downward speed
            width: 8,
            height: 12,
            color: '#fbbf24', // high-spark yellow
            life: 1.0,
            decay: 0.05,
            isJetpackSpark: true
          });
        }

        // Fire & smoke particles from the jetpack nozzle
        for (let i = 0; i < 2; i++) {
          particlesRef.current.push({
            x: (player.facing > 0 ? player.x - 2 : player.x + player.width + 2) + (Math.random() - 0.5) * 6,
            y: player.y + player.height - 10,
            vx: -player.facing * 1.5 + (Math.random() - 0.5) * 2,
            vy: 4 + Math.random() * 3,
            radius: Math.random() * 4 + 3,
            color: Math.random() < 0.65 ? '#fbbf24' : '#ef4444', // flame look
            alpha: 1.0,
            life: 1.0,
            decay: 0.12
          });
        }
      }
    } else {
      if (jumpInput) {
        // Prevent holding key down from repeating jump instantly
        if (!keysRef.current['processedJump'] && !virtualControlsRef.current.jump) {
          if (player.isOnGround) {
            player.vy = -baseJumpMultiplier;
            player.isOnGround = false;
            player.hasDoubleJumped = false;
            sound.playJump();
            spawnExplosionParticles(player.x + player.width / 2, player.y + player.height, 'rgba(255,255,255,0.4)', 4);
          } else if (!player.hasDoubleJumped) {
            player.vy = -baseJumpMultiplier * 0.9;
            player.hasDoubleJumped = true;
            sound.playJump();
            spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#67e8f9', 6);
          }
          
          keysRef.current['processedJump'] = true;
        }
      } else {
        keysRef.current['processedJump'] = false;
      }
    }

    // Move Player along Y and check platform collisions
    player.y += player.vy;
    resolveVerticalCollisions(level.platforms);

    // Move Player along X and check platform collisions
    player.x += player.vx;
    resolveHorizontalCollisions(level.platforms);

    // Screen out of bounds check
    if (player.y > 600) {
      handlePlayerDefeat();
    }
    if (player.x < 0) player.x = 0;

    // Check Checkpoint pole collision
    if (!level.checkpoint.activated) {
      const poleBox = { x: level.checkpoint.x - 10, y: level.checkpoint.y - 120, width: 20, height: 120 };
      if (isOverlapping(player, poleBox)) {
        level.checkpoint.activated = true;
        sound.playPowerUp();
        // Spawn beautiful checkpoint celebration particles
        spawnExplosionParticles(level.checkpoint.x, level.checkpoint.y - 100, '#4ade80', 15);
      }
    }

    // Collectibles collection & processing (Magnets!)
    level.collectibles.forEach((col: any) => {
      if (col.collected) return;

      // Magnet attraction
      if (player.magnetActive && col.type === 'coin') {
        const dx = (player.x + player.width / 2) - (col.x + col.width / 2);
        const dy = (player.y + player.height / 2) - (col.y + col.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const magnetRadius = 150 + stats.magnetLevel * 40; // upgraded magnet level
        
        if (dist < magnetRadius) {
          // Pull towards player
          const pullForce = 5;
          col.x += (dx / dist) * pullForce;
          col.y += (dy / dist) * pullForce;
        }
      }

      if (isOverlapping(player, col)) {
        col.collected = true;
        if (col.type === 'coin') {
          setCoinsCollected(prev => prev + 1);
          setCurrentScore(prev => prev + 10);
          sound.playCoin();
          spawnExplosionParticles(col.x + col.width / 2, col.y + col.height / 2, '#facc15', 3);
        } else if (col.type === 'gem') {
          setCoinsCollected(prev => prev + 10);
          setCurrentScore(prev => prev + 100);
          sound.playVictory();
          spawnExplosionParticles(col.x + col.width / 2, col.y + col.height / 2, '#22d3ee', 8);
        } else if (col.type === 'chest') {
          // Open chests explode with multiple coins on spot
          setCoinsCollected(prev => prev + 25);
          setCurrentScore(prev => prev + 250);
          sound.playVictory();
          spawnExplosionParticles(col.x + col.width / 2, col.y + col.height / 2, '#f97316', 15);
        } else if (col.type === 'star') {
          // Power Star cleared the stage!
          triggerLevelVictory();
        }
      }
    });

    // Power Ups collection
    level.powerups.forEach((pw: any) => {
      if (pw.collected) return;

      if (isOverlapping(player, pw)) {
        pw.collected = true;
        sound.playPowerUp();
        spawnExplosionParticles(pw.x + pw.width / 2, pw.y + pw.height / 2, '#a855f7', 10);

        if (pw.type === 'shield') {
          player.shieldActive = true;
        } else if (pw.type === 'speed') {
          player.speedBoostActive = true;
          player.speedBoostDuration = 400; // ~7 seconds
        } else if (pw.type === 'magnet') {
          player.magnetActive = true;
          player.magnetDuration = 500;
        } else if (pw.type === 'invincibility') {
          player.invincibleActive = true;
          player.invincibleDuration = 350;
        }
      }
    });

    // Check Goal door collision
    const goalBox = { ...level.goal };
    if (isOverlapping(player, goalBox)) {
      triggerLevelVictory();
    }
  };

  // Resolve platform heights vertically
  const resolveVerticalCollisions = (platforms: any[]) => {
    const player = playerRef.current;
    const level = levelStateRef.current;
    player.isOnGround = false;

    platforms.forEach((plat) => {
      // Moving or falling behavior updates
      if (plat.behavior === 'moving') {
        if (!plat.direction) {
          plat.direction = 1;
          plat.startX = plat.x;
          plat.startY = plat.y;
          plat.speed = 1.5;
        }
        // Patrol range of 100px
        plat.x += plat.direction * plat.speed;
        if (Math.abs(plat.x - plat.startX) > 120) {
          plat.direction *= -1;
        }
      }

      if (isOverlapping(player, plat)) {
        if (player.vy > 0 && player.y + player.height - player.vy <= plat.y + 4) {
          // Standing on top of platform
          player.y = plat.y - player.height;
          player.vy = 0;
          player.isOnGround = true;
          player.canDash = true;

          // If platform is moving horizontally, carry player along
          if (plat.behavior === 'moving') {
            player.x += plat.direction * plat.speed;
          }

          // If platform is falling, trigger countdown
          if (plat.behavior === 'falling') {
            if (!plat.state) {
              plat.state = 'idle';
              plat.timer = 20; // 20 frames until drop
            }
          }
        } else if (player.vy < 0 && player.y - player.vy >= plat.y + plat.height - 4) {
          // Colliding ceiling head-butt
          player.y = plat.y + plat.height;
          player.vy = 0.5; // slide down

          // Mario Question Block Trigger!
          if (plat.isQuestionBlock && plat.questionState !== 'empty') {
            plat.questionState = 'empty';
            plat.bounceY = -14;
            sound.playCoin();
            setCoinsCollected(prev => prev + 1);
            setCurrentScore(prev => prev + 150);
            
            // Nice gold coin explosion
            spawnExplosionParticles(plat.x + plat.width / 2, plat.y - 12, '#facc15', 12);
            
            // Randomly spawn a Powerup directly above the question block!
            if (Math.random() < 0.45) {
              const types = ['shield', 'speed', 'magnet', 'invincibility'];
              const chosen = types[Math.floor(Math.random() * types.length)];
              level.powerups.push({
                id: `pwup_box_${Date.now()}_${Math.random()}`,
                x: plat.x + plat.width / 2 - 15,
                y: plat.y - 45,
                width: 30,
                height: 30,
                type: chosen,
                collected: false
              });
              sound.playPowerUp();
              spawnExplosionParticles(plat.x + plat.width / 2, plat.y - 30, '#a855f7', 8);
            }
          }
        }
      }
    });
  };

  const resolveHorizontalCollisions = (platforms: any[]) => {
    const player = playerRef.current;
    platforms.forEach((plat) => {
      if (isOverlapping(player, plat)) {
        if (player.vx > 0) {
          player.x = plat.x - player.width;
          player.vx = 0;
        } else if (player.vx < 0) {
          player.x = plat.x + plat.width;
          player.vx = 0;
        }
      }
    });
  };

  // Enemies Patrol loop & interactive squishing
  const updateEnemies = () => {
    const level = levelStateRef.current;
    const player = playerRef.current;

    level.enemies.forEach((enemy: any) => {
      if (enemy.health <= 0) return;

      // Handle custom behavior AI patterns
      if (enemy.type === 'walker') {
        enemy.x += enemy.direction * enemy.speed;
        // Flip patrol
        if (Math.abs(enemy.x - enemy.startX) > enemy.patrolRange) {
          enemy.direction *= -1;
          enemy.x += enemy.direction * enemy.speed; // nudge
        }
      } else if (enemy.type === 'flyer') {
        enemy.x += enemy.direction * enemy.speed;
        // Float smoothly on Y
        enemy.y = enemy.startY + Math.sin(Date.now() / 200) * 20;
        if (Math.abs(enemy.x - enemy.startX) > enemy.patrolRange) {
          enemy.direction *= -1;
        }
      } else if (enemy.type === 'jumper') {
        if (!enemy.jumpTimer) enemy.jumpTimer = 60;
        enemy.jumpTimer--;
        
        if (enemy.jumpTimer <= 0) {
          // Jump up
          enemy.state = 'jumping';
          enemy.y -= 12;
          enemy.jumpTimer = 80; // cooldown
        } else {
          // Apply gravity decay to return to ground
          if (enemy.y < enemy.startY) {
            enemy.y += 2.5;
          } else {
            enemy.y = enemy.startY;
            enemy.state = 'idle';
          }
        }
      } else if (enemy.type === 'boss') {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        
        // --- CHOOSE BOSS SUB-TYPE BEHAVIOR OR DEFAULT ---
        const subType = enemy.bossSubType || 'default';
        
        if (subType === 'slime_emperor') {
          // --- LORD VOLDESLIME Pattern ---
          // Slithers on ground, then launches high sky slams
          if (!enemy.state) enemy.state = 'idle';
          if (!enemy.jumpTimer) enemy.jumpTimer = 110;
          
          enemy.jumpTimer--;
          
          if (enemy.state === 'idle') {
            // Move slowly towards the player horizontally
            enemy.x += Math.sign(dx) * 0.9;
            
            if (enemy.jumpTimer <= 0) {
              enemy.state = 'jumping';
              enemy.jumpTimer = 160; // reset cooldown
              enemy.vy = -16; // high vertical jump
              sound.playJump();
              // spawn landing particles
              spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height, '#10b981', 8);
            }
          } else if (enemy.state === 'jumping') {
            // Move horizontally while in the air
            enemy.x += Math.sign(dx) * 1.5;
            
            // Gravity
            enemy.vy += 0.55;
            enemy.y += enemy.vy;
            
            // Check ground land
            if (enemy.y >= 360) {
              enemy.y = 360;
              enemy.vy = 0;
              enemy.state = 'idle';
              sound.playDamage(); // shockwave rumble
              
              // 8-split green slime splatter burst!
              for (let angle = 0; angle < Math.PI; angle += Math.PI / 6) {
                particlesRef.current.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height - 10,
                  vx: Math.cos(angle) * 6,
                  vy: -Math.sin(angle) * 7,
                  radius: 7,
                  color: '#22c55e', // toxic slasher green
                  alpha: 1,
                  life: 1.5,
                  decay: 0.02,
                  isProjectile: true
                });
              }
              // Spawn little ground toxic slimes occasionally!
              if (Math.random() < 0.6) {
                level.enemies.push({
                  id: `slime_minion_${Date.now()}_${Math.random()}`,
                  x: enemy.x + (Math.random() - 0.5) * 60,
                  y: 405,
                  width: 24,
                  height: 24,
                  type: 'walker',
                  health: 1,
                  maxHealth: 1,
                  speed: 2.0,
                  patrolRange: 150,
                  startX: enemy.x,
                  startY: 405,
                  direction: Math.random() < 0.5 ? 1 : -1,
                  isMinion: true
                });
              }
            }
          }
          
          // Regular shooting
          if (!enemy.shootTimer) enemy.shootTimer = 90;
          enemy.shootTimer--;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = 90;
            // 3-way green splatter targeting
            for (let i = -1; i <= 1; i++) {
              particlesRef.current.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + 20,
                vx: Math.sign(dx) * 4.0 + i * 1.5,
                vy: i * 2.5 - 2,
                radius: 6,
                color: '#10b981',
                alpha: 1,
                life: 1.8,
                decay: 0.015,
                isProjectile: true
              });
            }
          }
          
        } else if (subType === 'mecha_cyborg') {
          // --- MECHA BOWSER 9000 Pattern ---
          // Hover and dashing lasers
          enemy.y = enemy.startY + Math.sin(Date.now() / 140) * 40;
          
          if (!enemy.dashCooldown) enemy.dashCooldown = 150;
          enemy.dashCooldown--;
          
          if (enemy.dashCooldown <= 40 && enemy.dashCooldown > 0) {
            // Charging flash warning
            if (Date.now() % 100 < 50) {
              enemy.isChargingWarning = true;
            } else {
              enemy.isChargingWarning = false;
            }
          } else if (enemy.dashCooldown <= 0) {
            // Unleash direct horizontal thruster ramming dash!
            enemy.dashCooldown = 150;
            enemy.isChargingWarning = false;
            // teleport-like extreme quick thrust speed
            enemy.x += Math.sign(dx) * 450;
            if (enemy.x < 50) enemy.x = 50;
            if (enemy.x > 1050) enemy.x = 1050;
            sound.playJump();
            spawnExplosionParticles(enemy.x, enemy.y + enemy.height/2, '#fbbf24', 15);
          } else {
            // Standard tracking movement
            enemy.x += Math.sign(dx) * 1.6;
          }
          
          // Mecha laser pulses
          if (!enemy.shootTimer) enemy.shootTimer = 70;
          enemy.shootTimer--;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = 70;
            sound.playShoot();
            // Ultra fast cyber spark projectile
            particlesRef.current.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              vx: Math.sign(dx) * 8.5,
              vy: (dy / (Math.abs(dx) || 1)) * 6.0,
              radius: 4,
              color: '#06b6d4', // cyan electric cyber bullet
              alpha: 1,
              life: 1.2,
              decay: 0.02,
              isProjectile: true
            });
          }
          
        } else if (subType === 'skull_eye') {
          // --- BEHOLDER OF DREAD ---
          // Floating colossal eye. Teleports closer and homing shots!
          enemy.y = enemy.startY + Math.sin(Date.now() / 180) * 30;
          
          if (!enemy.teleportTimer) enemy.teleportTimer = 220;
          enemy.teleportTimer--;
          
          if (enemy.teleportTimer <= 0) {
            enemy.teleportTimer = 220;
            // Spawn creepy purple smoke where it was
            spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#c084fc', 20);
            
            // Teleport to the safe opposite sector in the arena
            const newX = player.x > 600 ? 150 + Math.random()*200 : 750 + Math.random()*200;
            const newY = 130 + Math.random()*120;
            enemy.x = newX;
            enemy.y = newY;
            enemy.startY = newY;
            
            sound.playPowerUp();
            // Spawn purple smoke where it landed
            spawnExplosionParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#818cf8', 20);
          } else {
            // Micro creeping tracks
            enemy.x += Math.sign(dx) * 0.8;
          }
          
          // Blink/Eye Shield immunity cycle
          const eyeCycle = Math.round(Date.now() / 120) % 15;
          if (eyeCycle === 0 || eyeCycle === 1) {
            enemy.isEyeShieldActive = true; // bullets bounce off!
          } else {
            enemy.isEyeShieldActive = false;
          }
          
          // Homing death void sphere shooting
          if (!enemy.shootTimer) enemy.shootTimer = 110;
          enemy.shootTimer--;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = 110;
            sound.playShoot();
            // Spawn homing void orb
            particlesRef.current.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              vx: Math.sign(dx) * 2.2,
              vy: Math.sign(dy) * 2.2,
              radius: 9,
              color: '#d8b4fe', // light purple outline
              alpha: 1,
              life: 3.5,
              decay: 0.008,
              isProjectile: true,
              isHomingVoid: true // Custom homing behavior handled in particle loop!
            });
            // Spawn small creepy bat minions
            if (Math.random() < 0.45) {
              level.enemies.push({
                id: `creepy_bat_${Date.now()}_${Math.random()}`,
                x: enemy.x + (Math.random() - 0.5) * 50,
                y: enemy.y + 40,
                width: 24,
                height: 24,
                type: 'flyer',
                health: 1,
                maxHealth: 1,
                speed: 2.2,
                patrolRange: 200,
                startX: enemy.x,
                startY: enemy.y + 40,
                direction: Math.sign(dx),
                isMinion: true
              });
            }
          }
          
        } else {
          // --- DEFAULT STAGE 3 BOSS PATTERN ---
          enemy.x += Math.sign(dx) * 1.2;
          
          if (!enemy.shootTimer) enemy.shootTimer = 100;
          enemy.shootTimer--;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = 100;
            sound.playDamage();
            particlesRef.current.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + 10,
              vx: Math.sign(dx) * 4.5,
              vy: -1.5,
              radius: 5,
              color: '#ef4444',
              alpha: 1,
              life: 2.0,
              decay: 0.015,
              isProjectile: true
            });
          }
        }

        // Initialize Swords & Tentacles weapons if not present (Universal except for custom sizes)
        if (enemy.tentacleOffset === undefined) {
          enemy.tentacleOffset = 0;
          enemy.swords = [
            { angle: 0, speed: 0.045 },
            { angle: Math.PI, speed: 0.045 }
          ];
        }

        // Animate orbiters
        enemy.tentacleOffset += 0.06;
        enemy.swords.forEach((sw: any) => {
          sw.angle += sw.speed;
        });

        // Trace and check collision for Tentacle 1 (Left Tentacle Weapon)
        const tentacleReach = subType === 'skull_eye' ? 40 : 25;
        const t1x = enemy.x - 20 + Math.sin(enemy.tentacleOffset) * tentacleReach;
        const t1y = enemy.y + enemy.height / 2 + Math.cos(enemy.tentacleOffset) * (tentacleReach + 10);
        const distT1 = Math.sqrt(Math.pow((player.x + player.width/2) - t1x, 2) + Math.pow((player.y + player.height/2) - t1y, 2));
        if (distT1 < 25) {
          handleTakeDamage();
        }

        // Trace and check collision for Tentacle 2 (Right Tentacle Weapon)
        const t2x = enemy.x + enemy.width + 20 + Math.cos(enemy.tentacleOffset) * tentacleReach;
        const t2y = enemy.y + enemy.height / 2 + Math.sin(enemy.tentacleOffset) * (tentacleReach + 10);
        const distT2 = Math.sqrt(Math.pow((player.x + player.width/2) - t2x, 2) + Math.pow((player.y + player.height/2) - t2y, 2));
        if (distT2 < 25) {
          handleTakeDamage();
        }

        // Trace and check collision for Swords weapon orbits
        const rx = enemy.x + enemy.width / 2;
        const ry = enemy.y + enemy.height / 2;
        enemy.swords.forEach((sw: any) => {
          const orbitRadius = subType === 'skull_eye' ? 100 : 75;
          const swx = rx + Math.cos(sw.angle) * orbitRadius;
          const swy = ry + Math.sin(sw.angle) * orbitRadius;
          const distSw = Math.sqrt(Math.pow((player.x + player.width/2) - swx, 2) + Math.pow((player.y + player.height/2) - swy, 2));
          if (distSw < 24) {
            handleTakeDamage();
          }
        });
      }

      // Check collision with player
      if (isOverlapping(player, enemy)) {
        if (player.invincibleActive) {
          // Fly through and defeat instantly
          enemy.health = 0;
          sound.playVictory();
          spawnExplosionParticles(enemy.x, enemy.y, '#e879f9', 10);
          setCurrentScore(prev => prev + 200);
        } else if (player.vy > 0.5 && player.y + player.height - player.vy <= enemy.y + 12) {
          // Squish/Jump on enemy head!
          sound.playVictory();
          spawnExplosionParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#4ade80', 10);
          
          if (enemy.type === 'boss') {
            enemy.health--;
            player.vy = -8; // bounce high!
            if (enemy.health <= 0) {
              setCurrentScore(prev => prev + 1000);
              // Spawn giant treasure hoard at boss death
              spawnExplosionParticles(enemy.x, enemy.y, '#facc15', 30);
            }
          } else {
            enemy.health = 0;
            player.vy = -7.5; // bounce
            setCurrentScore(prev => prev + 150);
          }
        } else {
          // Take damage from sides
          handleTakeDamage();
        }
      }
    });

    // Process Falling/Dropping of platforms labeled 'falling'
    level.platforms.forEach((plat) => {
      if (plat.behavior === 'falling' && plat.state === 'idle') {
        plat.timer--;
        if (plat.timer <= 0) {
          plat.state = 'falling';
        }
      }
      if (plat.state === 'falling') {
        plat.y += 4; // descends fast
      }
    });
  };

  // Take Damage logic
  const handleTakeDamage = () => {
    const player = playerRef.current;
    if (player.immunityTimer > 0 || player.invincibleActive) return;

    if (player.shieldActive) {
      player.shieldActive = false;
      player.immunityTimer = 45; // 45 frames immune
      sound.playShieldBreak();
      spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#c084fc', 12);
      return;
    }

    // Direct damage
    const nextHealth = health - 1;
    setHealth(nextHealth);
    player.immunityTimer = 55;
    sound.playDamage();
    spawnExplosionParticles(player.x + player.width / 2, player.y + player.height / 2, '#ef4444', 10);

    if (nextHealth <= 0) {
      handlePlayerDefeat();
    }
  };

  const handlePlayerDefeat = () => {
    const player = playerRef.current;
    const nextLives = lives - 1;
    setLives(nextLives);
    
    if (nextLives <= 0) {
      setIsGameOver(true);
      sound.stopBGM();
      sound.playDamage();
    } else {
      // Respawn at Checkpoint if activated, otherwise spawn safe
      sound.playDamage();
      const respawnX = levelStateRef.current.checkpoint.activated ? levelStateRef.current.checkpoint.x : 100;
      const respawnY = levelStateRef.current.checkpoint.activated ? levelStateRef.current.checkpoint.y - 10 : 350;
      
      player.x = respawnX;
      player.y = respawnY;
      player.vx = 0;
      player.vy = 0;
      setHealth(maxHealth); // heal hearts
      player.immunityTimer = 60;
    }
  };

  const triggerLevelVictory = () => {
    setIsGameWon(true);
    sound.stopBGM();
    sound.playVictory();
    
    // Earned score stars: 1-3 based on performance
    let starRating = 1;
    if (coinsCollected >= 25 && timeSpent <= 40) {
      starRating = 3;
    } else if (coinsCollected >= 10 || timeSpent <= 70) {
      starRating = 2;
    }

    onUpdateCoins(coinsCollected);
    onLevelComplete(coinsCollected, timeSpent, starRating);
  };

  const updateParticles = () => {
    particlesRef.current.forEach((p: any, idx: number) => {
      if (p.isHomingVoid) {
        const player = playerRef.current;
        const hdx = player.x + player.width / 2 - p.x;
        const hdy = player.y + player.height / 2 - p.y;
        const hdist = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
        p.vx = (hdx / hdist) * 2.8;
        p.vy = (hdy / hdist) * 2.8;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      
      // Projectiles target player
      if (p.isProjectile) {
        const player = playerRef.current;
        const pBox = { x: p.x - p.radius, y: p.y - p.radius, width: p.radius * 2, height: p.radius * 2 };
        if (isOverlapping(pBox, player)) {
          handleTakeDamage();
          p.life = 0; // destroy projectile
        }
      }
    });

    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const updateZappers = () => {
    const level = levelStateRef.current;
    const player = playerRef.current;
    if (!level.zappers) level.zappers = [];

    // Tick zapper angle updates and check user damage collisions
    level.zappers.forEach((zp: any) => {
      if (!zp.active) return;
      
      const isSpinned = zp.angle !== undefined;
      
      if (isSpinned) {
        zp.angle += 0.035; // rotate smoothly over time
      }

      let didCollide = false;

      if (!isSpinned) {
        // Simple bounding box overlaps for stationary zapper
        if (isOverlapping(player, zp)) {
          didCollide = true;
        }
      } else {
        // High fidelity line collision tracking for rotating rods
        const rx = zp.x + zp.width / 2;
        const ry = zp.y + zp.height / 2;
        const len = 90; // length of rotating beam

        const numSamples = 10;
        for (let s = 0; s <= numSamples; s++) {
          const ratio = (s / numSamples) - 0.5; // -0.5 to 0.5
          const sx = rx + Math.cos(zp.angle) * len * ratio;
          const sy = ry + Math.sin(zp.angle) * len * ratio;
          
          if (
            sx >= player.x && sx <= player.x + player.width &&
            sy >= player.y && sy <= player.y + player.height
          ) {
            didCollide = true;
            break;
          }
        }
      }

      if (didCollide) {
        // Trigger damage & small electric lightning spark particles
        handleTakeDamage();
        if (Math.random() < 0.3) {
          spawnExplosionParticles(player.x + player.width/2, player.y + player.height/2, '#facc15', 5);
        }
      }
    });
  };

  const updatePlayerBullets = () => {
    const level = levelStateRef.current;
    playerBulletsRef.current.forEach((bullet: any) => {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      bullet.life -= bullet.decay;

      const bulletBox = { 
        x: bullet.x - bullet.width / 2, 
        y: bullet.y - bullet.height / 2, 
        width: bullet.width, 
        height: bullet.height 
      };
      
      // Check collision with ALL living enemies
      level.enemies.forEach((enemy: any) => {
        if (enemy.health > 0 && isOverlapping(bulletBox, enemy)) {
          // Check if shield/eye is closed (invincible)
          if (enemy.isEyeShieldActive) {
            bullet.life = 0;
            spawnExplosionParticles(bullet.x, bullet.y, '#60a5fa', 5); // deflective blue sparkles
            return;
          }

          // HIT!
          sound.playDamage();
          // Jetpack sparkles deal slightly less damage than main gun to maintain balance!
          enemy.health -= bullet.isJetpackSpark ? 0.4 : 1.0; 
          bullet.life = 0; // destroy bullet
          
          spawnExplosionParticles(bullet.x, bullet.y, bullet.isJetpackSpark ? '#f59e0b' : '#38bdf8', 6);
          
          if (enemy.health <= 0) {
            sound.playVictory();
            spawnExplosionParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#4ade80', 12);
            
            if (enemy.type === 'boss') {
              setCurrentScore(prev => prev + 1000);
              // Spawn giant treasure hoard at boss death
              spawnExplosionParticles(enemy.x, enemy.y, '#facc15', 30);

              if (layout.isBossOnlyLevel) {
                setTimeout(() => {
                  triggerLevelVictory();
                }, 1300);
              }
            } else {
              setCurrentScore(prev => prev + 150);
            }
          }
        }
      });

      // Bullets (horizontal gun shots) can break/activate Mario question blocks if hitting them!
      if (!bullet.isJetpackSpark) {
        level.platforms.forEach((plat: any) => {
          if (plat.isQuestionBlock && plat.questionState !== 'empty' && isOverlapping(bulletBox, plat)) {
            plat.questionState = 'empty';
            plat.bounceY = -12;
            bullet.life = 0; // destroy bullet
            sound.playCoin();
            setCoinsCollected(prev => prev + 1);
            setCurrentScore(prev => prev + 150);
            spawnExplosionParticles(plat.x + plat.width / 2, plat.y - 12, '#facc15', 12);
            
            // Randomly spawn a Powerup directly above the question block!
            if (Math.random() < 0.45) {
              const types = ['shield', 'speed', 'magnet', 'invincibility'];
              const chosen = types[Math.floor(Math.random() * types.length)];
              level.powerups.push({
                id: `pwup_box_${Date.now()}_${Math.random()}`,
                x: plat.x + plat.width / 2 - 15,
                y: plat.y - 45,
                width: 30,
                height: 30,
                type: chosen,
                collected: false
              });
              sound.playPowerUp();
              spawnExplosionParticles(plat.x + plat.width / 2, plat.y - 30, '#a855f7', 8);
            }
          }
        });
      }
    });

    playerBulletsRef.current = playerBulletsRef.current.filter(b => b.life > 0);
  };

  // Complete procedural 2D layout drawing
  const drawGame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const player = playerRef.current;
    const level = levelStateRef.current;

    // Viewport camera tracking
    const viewportMinX = 0;
    const viewportMaxX = layout.length * 32 - canvas.width;
    const cameraX = Math.min(Math.max(player.x - canvas.width / 2.5, viewportMinX), viewportMaxX);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // DRAW BACKGROUND (gorgeous parallax skies based on world themes)
    drawBackgroundGradient(ctx, canvas, cameraX);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw checkpoint flag
    drawCheckpointFlag(ctx, level.checkpoint);

    // Draw active platforms
    level.platforms.forEach((plat) => {
      drawPlatformProcedural(ctx, plat);
    });

    // Draw goal gateway
    drawGoalGateway(ctx, level.goal);

    // Draw collectibles
    level.collectibles.forEach((col) => {
      if (!col.collected) {
        drawCollectibleProcedural(ctx, col);
      }
    });

    // Draw powerups
    level.powerups.forEach((pw) => {
      if (!pw.collected) {
        drawPowerupProcedural(ctx, pw);
      }
    });

    // Draw active enemies
    level.enemies.forEach((enemy) => {
      if (enemy.health > 0) {
        drawEnemyProcedural(ctx, enemy);
      }
    });

    // Draw active Jetpack Joyride electric zappers
    drawZappers(ctx, level.zappers || []);

    // Draw particles
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.isProjectile ? p.color : `${p.color}`;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Player Gun Bullets
    playerBulletsRef.current.forEach((bullet: any) => {
      ctx.fillStyle = bullet.color;
      ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
      
      // Core of the bullet
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bullet.x - bullet.width / 2 + 2, bullet.y - bullet.height / 2 + 1, bullet.width - 4, bullet.height - 2);
      
      // Trail effect
      ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.fillRect(bullet.x - (bullet.vx > 0 ? 12 : -4), bullet.y - 1, 8, 2);
    });

    // Draw Player Mascot
    drawPlayerProcedural(ctx, player);

    ctx.restore();
  };

  // High contrast background textures/gradients
  const drawBackgroundGradient = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, cameraX: number) => {
    const t = layout.theme;
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);

    if (t === 'forest') {
      grad.addColorStop(0, '#10b981'); // lush emerald sky
      grad.addColorStop(1, '#065f46');
    } else if (t === 'desert') {
      grad.addColorStop(0, '#ec4899'); // high contrast warm sunset sun vibes
      grad.addColorStop(1, '#7c2d12');
    } else if (t === 'ice') {
      grad.addColorStop(0, '#bae6fd'); // soft ice blue skies
      grad.addColorStop(1, '#0c4a6e');
    } else if (t === 'volcano') {
      grad.addColorStop(0, '#451a03'); // extreme hot magma dark volcano core
      grad.addColorStop(1, '#1c1917');
    } else if (t === 'creepy') {
      // Different creepy gradients matching each specific boss
      const subType = layout.bossSubType || 'slime_emperor';
      if (subType === 'slime_emperor') {
        grad.addColorStop(0, '#022c22'); // toxic waste dark green
        grad.addColorStop(1, '#020617');
      } else if (subType === 'mecha_cyborg') {
        grad.addColorStop(0, '#111827'); // deep cyberpunk warning grey
        grad.addColorStop(1, '#0f051a');
      } else {
        grad.addColorStop(0, '#450a0a'); // bloody doom crimson red
        grad.addColorStop(1, '#000000');
      }
    } else {
      grad.addColorStop(0, '#1e1b4b'); // deep sky cosmic blue indigo
      grad.addColorStop(1, '#030712');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative retro elements in skies: glowing sun or fluffy mountains
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    if (t === 'creepy') {
      const subType = layout.bossSubType || 'slime_emperor';
      if (subType === 'slime_emperor') {
        // Spooky slithering green bubbles rising
        const time = Date.now() / 1400;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
        for (let i = 0; i < 7; i++) {
          const bubbleX = (canvas.width * (i * 0.15) + Math.sin(time + i) * 50) % canvas.width;
          const bubbleY = (canvas.height - (time * 80 + i * 70)) % canvas.height;
          ctx.beginPath();
          ctx.arc(bubbleX, bubbleY >= 0 ? bubbleY : bubbleY + canvas.height, 20 + Math.sin(time + i) * 8, 0, Math.PI * 2);
          ctx.fill();
        }
        // Blinking red demon eyes staring
        ctx.fillStyle = '#dc2626';
        for (let i = 0; i < 4; i++) {
          const eyeX = 180 + i * 230 + Math.sin(Date.now() / 900 + i) * 10;
          const eyeY = 80 + Math.cos(Date.now() / 800 + i) * 15;
          if (Math.floor(Date.now() / 900 + i) % 4 !== 0) {
            ctx.fillRect(eyeX, eyeY, 7, 3);
            ctx.fillRect(eyeX + 11, eyeY, 7, 3);
          }
        }
      } else if (subType === 'mecha_cyborg') {
        // High-voltage electric cage outlines
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.lineWidth = 2;
        for (let x = 80; x < canvas.width; x += 160) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        // Random warnings Sparks lightning lines
        if (Math.random() < 0.1) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.22)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.random() * canvas.width, 0);
          ctx.lineTo(Math.random() * canvas.width, canvas.height);
          ctx.stroke();
        }
      } else {
        // Red giant hell moon center
        ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 130, 95, 0, Math.PI * 2);
        ctx.fill();

        // Blood-red giant demonic eyes flickering in the heavy smog
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        for (let i = 0; i < 5; i++) {
          const eyeX = 90 + i * 200 + Math.sin(Date.now() / 1100 + i) * 12;
          const eyeY = 70 + Math.cos(Date.now() / 1000 + i) * 15;
          if (Math.floor(Date.now() / 850 + i) % 5 !== 0) {
            ctx.fillRect(eyeX, eyeY, 12, 4);
            ctx.fillRect(eyeX + 18, eyeY, 12, 4);
          }
        }
      }
    } else if (t === 'forest' || t === 'desert') {
      // Draw massive sun sphere
      ctx.beginPath();
      ctx.arc(canvas.width / 1.5 - cameraX * 0.15, 150, 95, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'sky') {
      // Draw cosmic clouds / planet details
      ctx.beginPath();
      ctx.arc(canvas.width / 5 - cameraX * 0.08, 100, 45, 0, Math.PI * 2);
      ctx.arc(canvas.width / 5 + 40 - cameraX * 0.08, 100, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawCheckpointFlag = (ctx: CanvasRenderingContext2D, cp: any) => {
    // flagpole
    ctx.fillStyle = '#a1a1aa';
    ctx.fillRect(cp.x - 4, cp.y - 100, 8, 100);

    // golden pommel top
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cp.x, cp.y - 100, 6, 0, Math.PI * 2);
    ctx.fill();

    // flapping flag triangle
    ctx.fillStyle = cp.activated ? '#4ade80' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(cp.x + 4, cp.y - 100);
    ctx.lineTo(cp.x + 36, cp.y - 80);
    ctx.lineTo(cp.x + 4, cp.y - 65);
    ctx.closePath();
    ctx.fill();

    // "CHECKPOINT" bold stamp text floating above
    if (!cp.activated) {
      ctx.fillStyle = '#f4f4f5';
      ctx.font = '8px monospace';
      ctx.fillText("TOUCH FLAG", cp.x - 18, cp.y - 110);
    }
  };

  const drawZappers = (ctx: CanvasRenderingContext2D, zappers: any[]) => {
    zappers.forEach((zp: any) => {
      const isSpinned = zp.angle !== undefined;
      const rx = zp.x + zp.width / 2;
      const ry = zp.y + zp.height / 2;
      const len = 90; // matching collision len

      ctx.save();
      
      // Draw terminal ends (spark plugs)
      ctx.fillStyle = '#27272a'; // zinc dark cap plugs
      ctx.strokeStyle = '#facc15'; // yellow glowing tips
      ctx.lineWidth = 3;

      const drawTerminalPlug = (cx: number, cy: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = (Date.now() / 250 % 2 < 1) ? '#ef4444' : '#22c55e'; // animated blinker light
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      };

      if (!isSpinned) {
        // Horizontal of vertical static zappers
        const isHoriz = zp.width > zp.height;
        const x1 = isHoriz ? zp.x : rx;
        const y1 = isHoriz ? ry : zp.y;
        const x2 = isHoriz ? zp.x + zp.width : rx;
        const y2 = isHoriz ? ry : zp.y + zp.height;

        // Draw animated electric lightning beam
        ctx.strokeStyle = '#fbbf24'; // hot orange/gold
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const segmentsCount = 8;
        for (let i = 1; i <= segmentsCount; i++) {
          const ratio = i / segmentsCount;
          const px = x1 + (x2 - x1) * ratio;
          const py = y1 + (y2 - y1) * ratio;
          
          // electric buzz distortion
          const dx = isHoriz ? 0 : (Math.random() - 0.5) * 8;
          const dy = isHoriz ? (Math.random() - 0.5) * 8 : 0;
          ctx.lineTo(px + dx, py + dy);
        }
        ctx.stroke();

        ctx.strokeStyle = '#ffffff'; // electric ultra core
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i <= segmentsCount; i++) {
          const ratio = i / segmentsCount;
          const px = x1 + (x2 - x1) * ratio;
          const py = y1 + (y2 - y1) * ratio;
          
          const dx = isHoriz ? 0 : (Math.random() - 0.5) * 3;
          const dy = isHoriz ? (Math.random() - 0.5) * 3 : 0;
          ctx.lineTo(px + dx, py + dy);
        }
        ctx.stroke();

        drawTerminalPlug(x1, y1);
        drawTerminalPlug(x2, y2);
      } else {
        // Rotating Zapper
        const x1 = rx + Math.cos(zp.angle) * len / 2;
        const y1 = ry + Math.sin(zp.angle) * len / 2;
        const x2 = rx - Math.cos(zp.angle) * len / 2;
        const y2 = ry - Math.sin(zp.angle) * len / 2;

        ctx.strokeStyle = '#f97316'; // orange neon fire
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        
        const segmentsCount = 10;
        for (let i = 1; i <= segmentsCount; i++) {
          const ratio = i / segmentsCount;
          const px = x1 + (x2 - x1) * ratio;
          const py = y1 + (y2 - y1) * ratio;
          
          // electric lightning buzz wave
          const normX = -Math.sin(zp.angle);
          const normY = Math.cos(zp.angle);
          const offset = (Math.random() - 0.5) * 9;
          ctx.lineTo(px + normX * offset, py + normY * offset);
        }
        ctx.stroke();

        // White core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i <= segmentsCount; i++) {
          const ratio = i / segmentsCount;
          const px = x1 + (x2 - x1) * ratio;
          const py = y1 + (y2 - y1) * ratio;
          
          const normX = -Math.sin(zp.angle);
          const normY = Math.cos(zp.angle);
          const offset = (Math.random() - 0.5) * 3;
          ctx.lineTo(px + normX * offset, py + normY * offset);
        }
        ctx.stroke();

        drawTerminalPlug(x1, y1);
        drawTerminalPlug(x2, y2);
      }

      ctx.restore();
    });
  };

  const drawPlatformProcedural = (ctx: CanvasRenderingContext2D, plat: any) => {
    // Mario style question block drawing override!
    if (plat.isQuestionBlock) {
      if (plat.bounceY === undefined) plat.bounceY = 0;
      
      // Decay bounceY
      if (plat.bounceY < 0) {
        plat.bounceY += 1.2;
        if (plat.bounceY > 0) plat.bounceY = 0;
      }

      const drawY = plat.y + plat.bounceY;

      ctx.save();
      if (plat.questionState === 'empty') {
        // Brown deactivated solid block
        ctx.fillStyle = '#7c2d12'; // deep rust Mario hit block
        ctx.fillRect(plat.x, drawY, plat.width, plat.height);
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 4;
        ctx.strokeRect(plat.x + 2, drawY + 2, plat.width - 4, plat.height - 4);
        
        // Small corner rivet dots
        ctx.fillStyle = '#000000';
        ctx.fillRect(plat.x + 6, drawY + 6, 4, 4);
        ctx.fillRect(plat.x + plat.width - 10, drawY + 6, 4, 4);
        ctx.fillRect(plat.x + 6, drawY + plat.height - 10, 4, 4);
        ctx.fillRect(plat.x + plat.width - 10, drawY + plat.height - 10, 4, 4);
      } else {
        // Vibrant flashing neon gold-orange Mario question block!
        const pulse = Date.now() / 150 % 2 < 1;
        ctx.fillStyle = pulse ? '#fbbf24' : '#f59e0b';
        ctx.fillRect(plat.x, drawY, plat.width, plat.height);
        
        ctx.strokeStyle = '#d97706'; // gold shadow margin
        ctx.lineWidth = 3;
        ctx.strokeRect(plat.x + 1.5, drawY + 1.5, plat.width - 3, plat.height - 3);

        // Render black "?" text centered perfectly
        ctx.fillStyle = '#7c2d12';
        ctx.font = `bold ${Math.round(plat.height * 0.7)}px "Space Grotesk", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("?", plat.x + plat.width / 2, drawY + plat.height / 2 + 1);

        // Highlight glints
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(plat.x + 4, drawY + 4, 4, 4);
        ctx.fillRect(plat.x + plat.width - 8, drawY + plat.height - 8, 4, 4);
      }
      ctx.restore();
      return;
    }

    const t = layout.theme;
    
    // Choose beautiful color schemas based on theme
    let topColor = '#10b981';
    let bottomColor = '#065f46';
    let detailColor = '#047857';

    if (t === 'desert') {
      topColor = '#f59e0b';
      bottomColor = '#b45309';
      detailColor = '#d97706';
    } else if (t === 'ice') {
      topColor = '#cbd5e1';
      bottomColor = '#475569';
      detailColor = '#94a3b8';
    } else if (t === 'volcano') {
      topColor = '#b91c1c';
      bottomColor = '#451a03';
      detailColor = '#f97316';
    } else if (t === 'sky') {
      topColor = '#fbbf24';
      bottomColor = '#4338ca';
      detailColor = '#eab308';
    }

    // platform outline
    ctx.fillStyle = bottomColor;
    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

    // grass / sand cap top layer (8px thick)
    ctx.fillStyle = topColor;
    ctx.fillRect(plat.x, plat.y, plat.width, 10);

    // blocky vertical lines to satisfy cute retro 2012 tiles look
    ctx.strokeStyle = detailColor;
    ctx.lineWidth = 2;
    for (let xOffset = 16; xOffset < plat.width; xOffset += 32) {
      ctx.beginPath();
      ctx.moveTo(plat.x + xOffset, plat.y + 10);
      ctx.lineTo(plat.x + xOffset, plat.y + plat.height);
      ctx.stroke();
    }

    // Special falling visual danger flashing
    if (plat.behavior === 'falling') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 8px monospace';
      ctx.fillText("!", plat.x + 6, plat.y + 22);
    } else if (plat.behavior === 'moving') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
    }
  };

  const drawGoalGateway = (ctx: CanvasRenderingContext2D, goal: any) => {
    // Door Pillars (Retro golden shiny frame)
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(goal.x, goal.y, 8, goal.height);
    ctx.fillRect(goal.x + goal.width - 8, goal.y, 8, goal.height);
    
    // arch lintel
    ctx.fillRect(goal.x, goal.y, goal.width, 12);

    // glowing space doorway void loop
    const gradient = ctx.createRadialGradient(
      goal.x + goal.width / 2,
      goal.y + goal.height / 2,
      3,
      goal.x + goal.width / 2,
      goal.y + goal.height / 2,
      25
    );
    gradient.addColorStop(0, '#f43f5e'); // warm star glow
    gradient.addColorStop(1, '#4c1d95'); // stellar cosmic portal

    ctx.fillStyle = gradient;
    ctx.fillRect(goal.x + 8, goal.y + 12, goal.width - 16, goal.height - 12);

    // Floating pixel star inside
    ctx.fillStyle = '#fff';
    ctx.fillRect(goal.x + goal.width / 2 - 4, goal.y + goal.height / 2 - 4, 8, 8);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText("GOAL", goal.x + 6, goal.y - 8);
  };

  const drawCollectibleProcedural = (ctx: CanvasRenderingContext2D, col: any) => {
    const rx = col.x + col.width / 2;
    const ry = col.y + col.height / 2;

    if (col.type === 'coin') {
      // Spinning yellow coin
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      // squashed ellipse to look like rotating vector
      const radiusX = 8 + Math.sin(Date.now() / 120) * 3;
      ctx.ellipse(rx, ry, radiusX, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // inner star detail
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx - 1.5, ry - 3, 3, 6);
    } else if (col.type === 'gem') {
      // Shiny blue diamond
      ctx.fillStyle = '#06b6d4';
      ctx.strokeStyle = '#0891b2';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(rx, col.y);
      ctx.lineTo(col.x + col.width, ry);
      ctx.lineTo(rx, col.y + col.height);
      ctx.lineTo(col.x, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // diamond sparkle white triangle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(rx, col.y + 3);
      ctx.lineTo(rx + 4, ry);
      ctx.lineTo(rx, ry + 2);
      ctx.closePath();
      ctx.fill();
    } else if (col.type === 'chest') {
      // Wood-bound gold chest
      ctx.fillStyle = '#7c2d12'; // dark mahogany
      ctx.fillRect(col.x, col.y + 12, col.width, col.height - 12);
      ctx.fillStyle = '#fbbf24'; // brass fittings
      ctx.fillRect(col.x + 6, col.y + 12, 4, col.height - 12);
      ctx.fillRect(col.x + col.width - 10, col.y + 12, 4, col.height - 12);

      // closed dynamic secure lid
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(col.x, col.y, col.width, 12);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(col.x + col.width / 2 - 4, col.y + 10, 8, 4); // latch
    } else if (col.type === 'star') {
      // Main Victory Star
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      // standard 5 point geometric star coordinate sweeps
      ctx.moveTo(rx, col.y);
      ctx.lineTo(col.x + 22, col.y + 10);
      ctx.lineTo(col.x + col.width, col.y + 12);
      ctx.lineTo(col.x + 24, col.y + 22);
      ctx.lineTo(col.x + 28, col.y + col.height);
      ctx.lineTo(rx, col.y + 26);
      ctx.lineTo(col.x + 4, col.y + col.height);
      ctx.lineTo(col.x + 8, col.y + 22);
      ctx.lineTo(col.x, col.y + 12);
      ctx.lineTo(col.x + 10, col.y + 10);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawPowerupProcedural = (ctx: CanvasRenderingContext2D, pw: any) => {
    // Floating purple custom cargo crate
    ctx.fillStyle = '#701a75';
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 2;
    ctx.fillRect(pw.x, pw.y, pw.width, pw.height);
    ctx.strokeRect(pw.x, pw.y, pw.width, pw.height);

    // glowing question/symbol in white
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px font-sans';
    let symbol = "?";
    if (pw.type === 'shield') symbol = "S";
    if (pw.type === 'speed') symbol = "V";
    if (pw.type === 'magnet') symbol = "M";
    if (pw.type === 'invincibility') symbol = "I";
    
    ctx.fillText(symbol, pw.x + 10, pw.y + 20);
  };

  const drawEnemyProcedural = (ctx: CanvasRenderingContext2D, enemy: any) => {
    const rx = enemy.x + enemy.width / 2;
    const ry = enemy.y + enemy.height / 2;

    if (enemy.type === 'walker') {
      // Dangerous spiky shell crawler (Goomba/Koopa mix style)
      ctx.fillStyle = '#ef4444'; // deep red
      ctx.fillRect(enemy.x, enemy.y + 12, enemy.width, enemy.height - 12);
      
      // Spiky cap
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y + 12);
      ctx.lineTo(rx, enemy.y);
      ctx.lineTo(enemy.x + enemy.width, enemy.y + 12);
      ctx.closePath();
      ctx.fill();

      // glowing dangerous yellow pixel eyes
      ctx.fillStyle = '#facc15';
      ctx.fillRect(enemy.x + 6, enemy.y + 16, 4, 4);
      ctx.fillRect(enemy.x + enemy.width - 10, enemy.y + 16, 4, 4);

    } else if (enemy.type === 'flyer') {
      // Classic flying winged eyeball or bubble bat
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(rx, ry, enemy.width / 2, 0, Math.PI * 2);
      ctx.fill();

      // wings flapping
      ctx.fillStyle = '#94a3b8';
      const flapY = Math.sin(Date.now() / 90) * 12;
      ctx.fillRect(enemy.x - 12, ry - 4 + flapY, 12, 6);
      ctx.fillRect(enemy.x + enemy.width, ry - 4 - flapY, 12, 6);

      // red pupil center
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(rx, ry, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'jumper') {
      // Toxic lime bouncy spring slime
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      // dynamic squash look
      const squeezeY = enemy.state === 'jumping' ? 24 : 16;
      ctx.ellipse(rx, enemy.y + enemy.height - squeezeY, 16, squeezeY, 0, 0, Math.PI * 2);
      ctx.fill();

      // happy cute pixel eyes
      ctx.fillStyle = '#111827';
      ctx.fillRect(rx - 6, enemy.y + enemy.height - squeezeY - 4, 3, 3);
      ctx.fillRect(rx + 3, enemy.y + enemy.height - squeezeY - 4, 3, 3);
    } else if (enemy.type === 'boss') {
      const subType = enemy.bossSubType || 'default';
      
      if (subType === 'slime_emperor') {
        // --- SLIME EMPEROR (Lord Voldeslime) ---
        const pulse = 1 + Math.sin(Date.now() / 150) * 0.08;
        const width = enemy.width * pulse;
        const height = enemy.height * (2 - pulse);
        const bx = enemy.x + (enemy.width - width) / 2;
        const by = enemy.y + (enemy.height - height);

        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        ctx.ellipse(bx + width / 2, by + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(bx + width * 0.35, by + height * 0.35, width * 0.12, 0, Math.PI * 2);
        ctx.arc(bx + width * 0.65, by + height * 0.45, width * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + width * 0.25, by + 4);
        ctx.lineTo(bx + width * 0.35, by - 14);
        ctx.lineTo(bx + width * 0.5, by - 4);
        ctx.lineTo(bx + width * 0.65, by - 14);
        ctx.lineTo(bx + width * 0.75, by + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bx + width * 0.46, by - 10, width * 0.08, width * 0.08);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + width * 0.28, by + height * 0.42, 10, 10);
        ctx.fillRect(bx + width * 0.62, by + height * 0.42, 10, 10);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(bx + width * 0.30, by + height * 0.44, 4, 4);
        ctx.fillRect(bx + width * 0.64, by + height * 0.44, 4, 4);

        ctx.strokeStyle = '#064e3b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + width * 0.22, by + height * 0.3);
        ctx.lineTo(bx + width * 0.42, by + height * 0.38);
        ctx.moveTo(bx + width * 0.78, by + height * 0.3);
        ctx.lineTo(bx + width * 0.58, by + height * 0.38);
        ctx.stroke();
        
      } else if (subType === 'mecha_cyborg') {
        // --- MECHA BOWSER 9000 ---
        ctx.fillStyle = enemy.isChargingWarning ? '#dc2626' : '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);

        const flameHeight = 12 + Math.random() * 12;
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(enemy.x + 12, enemy.y + enemy.height, 14, flameHeight);
        ctx.fillRect(enemy.x + enemy.width - 26, enemy.y + enemy.height, 14, flameHeight);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(enemy.x + 16, enemy.y + enemy.height, 6, flameHeight/2);
        ctx.fillRect(enemy.x + enemy.width - 22, enemy.y + enemy.height, 6, flameHeight/2);

        ctx.fillStyle = '#334155';
        ctx.fillRect(enemy.x + 6, enemy.y + 6, 6, 6);
        ctx.fillRect(enemy.x + enemy.width - 12, enemy.y + 6, 6, 6);
        ctx.fillRect(enemy.x + 6, enemy.y + enemy.height - 12, 6, 6);
        ctx.fillRect(enemy.x + enemy.width - 12, enemy.y + enemy.height - 12, 6, 6);

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(rx, ry, enemy.width * 0.24, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = enemy.isChargingWarning ? '#facc15' : '#ef4444';
        ctx.beginPath();
        ctx.arc(rx, ry, enemy.width * 0.08 + (Math.random() * 3), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + 15);
        ctx.lineTo(enemy.x - 16, enemy.y + enemy.height/2);
        ctx.lineTo(enemy.x, enemy.y + enemy.height - 15);
        ctx.moveTo(enemy.x + enemy.width, enemy.y + 15);
        ctx.lineTo(enemy.x + enemy.width + 16, enemy.y + enemy.height/2);
        ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height - 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (subType === 'skull_eye') {
        // --- BEHOLDER OF DREAD ---
        ctx.fillStyle = '#310a0a';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(rx, ry, enemy.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (enemy.isEyeShieldActive) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(rx, ry - 30);
          ctx.lineTo(rx, ry + 30);
          ctx.stroke();

          ctx.fillStyle = '#a855f7';
          ctx.fillRect(rx - 15, ry - 3, 30, 6);
        } else {
          ctx.fillStyle = '#fef2f2';
          ctx.beginPath();
          ctx.ellipse(rx, ry, enemy.width*0.35, enemy.width*0.25, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rx - 25, ry - 10);
          ctx.lineTo(rx - 12, ry - 3);
          ctx.moveTo(rx + 25, ry + 10);
          ctx.lineTo(rx + 12, ry + 3);
          ctx.stroke();

          ctx.fillStyle = '#7e22ce';
          ctx.beginPath();
          ctx.arc(rx, ry, enemy.width * 0.16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0f051d';
          ctx.beginPath();
          ctx.arc(rx, ry, enemy.width * 0.08, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(rx - 4, ry - 4, 4, 4);
        }

        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx - enemy.width/2, ry - 10);
        ctx.quadraticCurveTo(rx - enemy.width/2 - 20, ry - 35, rx - enemy.width/2 - 5, ry - 45);
        ctx.quadraticCurveTo(rx - enemy.width/2 - 10, ry - 25, rx - enemy.width/2, ry);
        ctx.moveTo(rx + enemy.width/2, ry - 10);
        ctx.quadraticCurveTo(rx + enemy.width/2 + 20, ry - 35, rx + enemy.width/2 + 5, ry - 45);
        ctx.quadraticCurveTo(rx + enemy.width/2 + 10, ry - 25, rx + enemy.width/2, ry);
        ctx.fill();
        ctx.stroke();

      } else {
        ctx.fillStyle = '#7c2d12';
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 3;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);

        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(enemy.x + 4, enemy.y - 8, 8, 8);
        ctx.fillRect(enemy.x + enemy.width - 12, enemy.y - 8, 8, 8);

        ctx.fillStyle = '#facc15';
        ctx.fillRect(enemy.x + 12, enemy.y + 14, 10, 6);
        ctx.fillRect(enemy.x + enemy.width - 22, enemy.y + 14, 10, 6);
      }

      // Draw active Weapons: Waving slime Tentacles arising from left and right sides!
      if (enemy.tentacleOffset !== undefined) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#10b981'; // Green slime tentacle base
        
        // Left Tentacle curve
        const t1x = enemy.x - 20 + Math.sin(enemy.tentacleOffset) * 25;
        const t1y = enemy.y + enemy.height / 2 + Math.cos(enemy.tentacleOffset) * 35;
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + enemy.height / 2);
        ctx.quadraticCurveTo(enemy.x - 20, enemy.y + enemy.height / 2 - 10, t1x, t1y);
        ctx.stroke();

        // Left Tentacle purple spiky pod tip
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(t1x, t1y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff'; // white eyeball tip
        ctx.fillRect(t1x - 3, t1y - 3, 4, 4);

        // Right Tentacle curve
        const t2x = enemy.x + enemy.width + 20 + Math.cos(enemy.tentacleOffset) * 25;
        const t2y = enemy.y + enemy.height / 2 + Math.sin(enemy.tentacleOffset) * 35;
        ctx.beginPath();
        ctx.moveTo(enemy.x + enemy.width, enemy.y + enemy.height / 2);
        ctx.quadraticCurveTo(enemy.x + enemy.width + 20, enemy.y + enemy.height / 2 - 10, t2x, t2y);
        ctx.stroke();

        // Right Tentacle purple spiky pod tip
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(t2x, t2y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(t2x - 3, t2y - 3, 4, 4);
      }

      // Draw active Weapons: Floating, orbiting pixelated dangerous swords!
      if (enemy.swords) {
        enemy.swords.forEach((sw: any) => {
          const swx = rx + Math.cos(sw.angle) * 75;
          const swy = ry + Math.sin(sw.angle) * 75;

          ctx.save();
          ctx.translate(swx, swy);
          ctx.rotate(sw.angle + Math.PI / 4); // angle matching the path + offset

          // Draw double-edged sword hilt & blade
          // Guard
          ctx.fillStyle = '#fbbf24'; // Golden guard
          ctx.fillRect(-8, -2, 16, 4);
          
          // Grip
          ctx.fillStyle = '#78350f'; // Leather grip
          ctx.fillRect(-2, 2, 4, 6);
          ctx.fillStyle = '#b91c1c'; // Pommel red
          ctx.fillRect(-3, 8, 6, 2);

          // Blade (Glowing laser steel)
          ctx.fillStyle = '#e2e8f0'; // Slated silver blade
          ctx.fillRect(-3, -22, 6, 20);
          ctx.fillStyle = '#38bdf8'; // Sky blue glowing center edge line
          ctx.fillRect(-1, -22, 2, 20);

          // Tip point
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(-3, -22);
          ctx.lineTo(0, -28);
          ctx.lineTo(3, -22);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        });
      }

      // HP Bar above boss
      const barY = enemy.y - 20;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(enemy.x, barY, enemy.width, 6);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(enemy.x, barY, enemy.width * (enemy.health / enemy.maxHealth), 6);
    }
  };

  const drawPlayerProcedural = (ctx: CanvasRenderingContext2D, player: any) => {
    // Flash transparent while immune
    if (player.immunityTimer > 0 && Math.floor(player.immunityTimer / 4) % 2 === 0) {
      return;
    }

    const s = stats.activeSkin;
    let mainColor = '#f43f5e'; // red-pink Retro Hero default
    let hatColor = '#3f3f46';
    let trailSparklesColor = 'rgba(244, 63, 94, 0.4)';

    if (s === 'robot') {
      mainColor = '#22d3ee'; // titanium cyan
      hatColor = '#1e293b';
      trailSparklesColor = 'rgba(34, 211, 238, 0.4)';
    } else if (s === 'ninja') {
      mainColor = '#18181b'; // stealth black
      hatColor = '#ef4444'; // crimson accent
      trailSparklesColor = 'rgba(168, 85, 247, 0.4)';
    } else if (s === 'space') {
      mainColor = '#ffffff'; // cosmic spacesuit
      hatColor = '#a855f7'; // helmet purple glass
      trailSparklesColor = 'rgba(192, 132, 252, 0.5)';
    }

    // DRAW SHADOW / GHOST DASH TRAIL IF DASHING
    if (player.isDashing) {
      ctx.fillStyle = trailSparklesColor;
      ctx.fillRect(player.x - player.vx * 1.5, player.y, player.width, player.height);
      ctx.fillRect(player.x - player.vx * 0.7, player.y, player.width, player.height);
    }

    // Main torso rectangle structure
    ctx.fillStyle = mainColor;
    ctx.fillRect(player.x, player.y + 12, player.width, player.height - 18);

    // Head sphere (Cap/Helm overlay)
    ctx.fillStyle = hatColor;
    ctx.fillRect(player.x + (player.facing > 0 ? 4 : 0), player.y, player.width - 4, 12);
    ctx.fillStyle = '#fbcfe8'; // peach face skin
    ctx.fillRect(player.x + (player.facing > 0 ? 8 : 0), player.y + 6, player.width - 8, 6);

    // Active skin visual additions
    if (s === 'retro') {
      // cap brim
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(player.x + (player.facing > 0 ? 16 : -4), player.y + 2, 16, 4);
    } else if (s === 'robot') {
      // Cyan glowing core eye
      ctx.fillStyle = '#eff6ff';
      ctx.fillRect(player.x + (player.facing > 0 ? 18 : 6), player.y + 6, 4, 3);
    } else if (s === 'ninja') {
      // red ninja wrap forehead knot
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(player.x + (player.facing > 0 ? -4 : 24), player.y + 4, 8, 4);
    } else if (s === 'space') {
      // cosmic backpack
      ctx.fillStyle = '#e4e4e7';
      ctx.fillRect(player.x + (player.facing > 0 ? -6 : 24), player.y + 16, 6, 16);
    }

    // Draw Jetpack Joyride styled jetpack canister on player's back!
    if (isJetpackMode) {
      ctx.fillStyle = '#fbbf24'; // bright golden jetpack frame yellow!
      const packX = player.facing > 0 ? player.x - 8 : player.x + player.width + 2;
      const packY = player.y + 14;
      ctx.fillRect(packX, packY, 6, 20); // main jetpack frame (dual canisters)
      
      ctx.fillStyle = '#ef4444'; // red thruster bands
      ctx.fillRect(packX - 1, packY + 4, 8, 3);
      ctx.fillRect(packX - 1, packY + 12, 8, 3);
      
      // nozzle tip at bottom
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(packX + 1, packY + 20, 4, 3);
    }

    // Animated hopping legs to resemble walking
    ctx.fillStyle = '#1e1b4b'; // dark trouser lines
    const legOffset = (player.animFrame % 2) * 3;
    ctx.fillRect(player.x + 2, player.y + player.height - 6 + legOffset, 8, 6);
    ctx.fillRect(player.x + player.width - 10, player.y + player.height - 6 - legOffset, 8, 6);

    // Active power-up shield bubble drawing
    if (player.shieldActive) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(192, 132, 252, 0.1)';
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Rainbow sparkling trails for temporary invincibility
    if (player.invincibleActive) {
      ctx.strokeStyle = `hsl(${(Date.now() / 4) % 360}, 100%, 70%)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(player.x - 4, player.y - 4, player.width + 8, player.height + 8);
    }

    // Draw modern holding GUN (Retro mobile arcade style gun!)
    ctx.fillStyle = '#4b5563'; // metal armor gray
    const gunX = player.facing > 0 ? player.x + player.width - 2 : player.x - 12;
    const gunY = player.y + 22;
    ctx.fillRect(gunX, gunY, 14, 8); // main barrel block
    ctx.fillStyle = '#111827'; // stock and barrel hole
    const gunMuzzleX = player.facing > 0 ? gunX + 10 : gunX;
    ctx.fillRect(gunMuzzleX, gunY, 4, 4); 
    ctx.fillStyle = '#9ca3af'; // grip/trigger
    const gripX = player.facing > 0 ? gunX + 2 : gunX + 8;
    ctx.fillRect(gripX, gunY + 6, 3, 5);

    // Muzzle flash when shooting!
    if (player.shootCooldown > 9) {
      const flashX = player.facing > 0 ? gunX + 14 : gunX - 10;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(flashX, gunY + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(flashX, gunY + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleMuteToggle = () => {
    const isMutedNow = sound.toggleMute();
    setIsMuted(isMutedNow);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-[580px] text-white">
      {/* HUD Header Status */}
      <div className="w-full max-w-[800px] bg-zinc-950 border-4 border-zinc-700 p-4 rounded-t-lg flex flex-wrap items-center justify-between gap-4 font-mono select-none">
        
        {/* Lives & Hearts */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <Heart className="w-5 h-5 text-red-500 fill-red-500 animate-pulse" />
            <span className="text-sm font-bold">{lives} <span className="text-xs text-zinc-500">LIVES</span></span>
          </div>

          <div className="flex items-center gap-1">
            {[...Array(maxHealth)].map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-sm border border-zinc-800 ${
                  i < health ? 'bg-red-500' : 'bg-zinc-900 border-dashed'
                }`}
              />
            ))}
            <span className="text-xs text-zinc-500 ml-1">HP</span>
          </div>
        </div>

        {/* Level Stats counts */}
        <div className="flex items-center gap-6 text-sm">
          <div className="text-yellow-400 font-bold">
            COINS: <span className="text-yellow-200">{coinsCollected}</span>
          </div>
          <div className="text-cyan-400 font-bold">
            SEC: <span className="text-cyan-200">{timeSpent}s</span>
          </div>
          <div className="text-purple-400 font-bold hidden sm:block">
            SCORE: <span className="text-purple-200">{currentScore}</span>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsJetpackMode(!isJetpackMode)}
            className={`text-[10px] sm:text-xs py-1 px-2 rounded font-mono uppercase cursor-pointer flex items-center gap-1 border transition-all ${
              isJetpackMode
                ? "bg-yellow-950/60 border-yellow-500 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.25)] font-bold animate-pulse"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            }`}
            title="Toggle between Jetpack Joyride continuous flight or pure Super Mario jumps"
          >
            🚀 {isJetpackMode ? "Jetpack Mode: ON" : "Mario Jumps: ON"}
          </button>
          <button
            onClick={handleMuteToggle}
            className="p-1.5 bg-zinc-900 border border-zinc-700 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 bg-zinc-900 border border-zinc-700 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={onExit}
            className="text-xs py-1 px-2.5 bg-red-950 border border-red-700 text-red-300 rounded font-bold uppercase hover:bg-red-900 cursor-pointer flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Stop
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="w-full max-w-[800px] aspect-[4/3] max-h-[600px] border-4 border-t-0 border-zinc-700 relative overflow-hidden bg-zinc-950">
        
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-full block bg-zinc-950"
        />

        {/* Epic Grand Boss HUD Health Bar Overlay at Top Center of Screen! */}
        {(() => {
          const boss = levelStateRef.current?.enemies?.find((e: any) => e.type === 'boss' && e.health > 0);
          if (!boss || !isPlaying || isGameOver || isGameWon) return null;

          const percent = Math.max(0, (boss.health / boss.maxHealth) * 100);
          return (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-[280px] sm:max-w-[360px] bg-zinc-950/90 border-2 border-red-600/80 p-2.5 rounded shadow-[0_0_15px_rgba(220,38,38,0.4)] font-mono text-center select-none z-10">
              <div className="flex justify-between text-[10px] sm:text-xs font-black uppercase text-red-500 tracking-wider mb-1">
                <span className="animate-pulse">⚠️ BOSS COMBAT</span>
                <span>{boss.bossName || 'SPIKE DRAGON'}</span>
              </div>
              <div className="w-full h-3 bg-red-950 rounded-sm overflow-hidden border border-red-700">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 transition-all duration-150"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="text-[9px] text-zinc-500 mt-1 uppercase">
                HEALTH POINTS: {Math.ceil(boss.health)} / {boss.maxHealth}
              </div>
            </div>
          );
        })()}

        {/* Pause Overlay */}
        {!isPlaying && !isGameOver && !isGameWon && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center font-mono">
            <h2 className="text-3xl font-extrabold text-yellow-400 uppercase tracking-widest animate-pulse">GAME PAUSED</h2>
            <p className="text-xs text-zinc-500 mt-2">TAP SPACE OR CLICK PLAY TO CONTINUE</p>
            <button
              onClick={() => setIsPlaying(true)}
              className="mt-6 py-2 px-5 bg-yellow-500 text-zinc-950 font-bold uppercase rounded hover:bg-yellow-400 transition cursor-pointer"
            >
              Resume Journey
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm flex flex-col items-center justify-center font-mono">
            <h2 className="text-4xl font-black text-red-500 uppercase tracking-widest">GAME OVER</h2>
            <p className="text-xs text-red-300 mt-2 leading-relaxed uppercase">You lost all your lives on this stage</p>
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="py-2.5 px-5 bg-red-600 border border-red-400 text-white font-bold uppercase rounded hover:bg-red-500 transition cursor-pointer flex items-center gap-2"
              >
                <RotateCw className="w-4 h-4" /> RETRY LEVEL
              </button>
              <button
                onClick={onExit}
                className="py-2.5 px-5 bg-zinc-800 text-zinc-300 font-bold uppercase rounded hover:bg-zinc-700 transition cursor-pointer"
              >
                EXIT ZONE
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {isGameWon && (
          <div className="absolute inset-0 bg-emerald-950/95 backdrop-blur-sm flex flex-col items-center justify-center font-mono">
            <h2 className="text-4xl font-black text-yellow-400 uppercase tracking-widest animate-bounce">VICTORY ZONE!</h2>
            
            <div className="bg-zinc-950 p-6 border-4 border-zinc-800 rounded-lg max-w-sm w-full mt-6 space-y-3 font-mono">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase">COINS FOUND</span>
                <span className="text-yellow-400 font-bold">+{coinsCollected}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-500 uppercase">TIME ELAPSED</span>
                <span className="text-cyan-400 font-bold">{timeSpent}s</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-zinc-500 uppercase">STAR RATE</span>
                <span className="text-yellow-400 font-extrabold text-base">
                  {"★".repeat(coinsCollected >= 25 && timeSpent <= 40 ? 3 : coinsCollected >= 10 || timeSpent <= 70 ? 2 : 1)}
                </span>
              </div>
            </div>

            <button
              onClick={onExit}
              className="mt-8 py-3 px-8 bg-yellow-500 text-zinc-950 font-extrabold uppercase rounded-lg hover:bg-yellow-400 border-b-4 border-yellow-700 transition cursor-pointer active:translate-y-1 block"
            >
              FINISH LEVEL
            </button>
          </div>
        )}
      </div>

      {/* Touch Screen Virtual D-Pad Overlay (Highly satisfying 2012 retro-mobile styled console) */}
      <div className="w-full max-w-[800px] bg-zinc-900 border-4 border-t-0 border-zinc-700 p-4 rounded-b-lg grid grid-cols-2 gap-4 select-none">
        {/* Left cluster */}
        <div className="flex items-center gap-3">
          <button
            onMouseDown={() => { virtualControlsRef.current.left = true; }}
            onMouseUp={() => { virtualControlsRef.current.left = false; }}
            onTouchStart={(e) => { e.preventDefault(); virtualControlsRef.current.left = true; }}
            onTouchEnd={(e) => { e.preventDefault(); virtualControlsRef.current.left = false; }}
            className="w-14 h-14 bg-zinc-800 active:bg-zinc-700 border-2 border-zinc-600 rounded-lg flex items-center justify-center font-bold text-lg select-none text-zinc-300"
          >
            ◀
          </button>
          <button
            onMouseDown={() => { virtualControlsRef.current.right = true; }}
            onMouseUp={() => { virtualControlsRef.current.right = false; }}
            onTouchStart={(e) => { e.preventDefault(); virtualControlsRef.current.right = true; }}
            onTouchEnd={(e) => { e.preventDefault(); virtualControlsRef.current.right = false; }}
            className="w-14 h-14 bg-zinc-800 active:bg-zinc-700 border-2 border-zinc-600 rounded-lg flex items-center justify-center font-bold text-lg select-none text-zinc-300"
          >
            ▶
          </button>
          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline uppercase">D-PAD DOCK</span>
        </div>

        {/* Right cluster */}
        <div className="flex items-center justify-end gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono text-zinc-500 uppercase">SPACE: Jump</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">SHIFT: Dash</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">F / ENTER: Shoot Gun</p>
          </div>

          <button
            onMouseDown={() => { virtualControlsRef.current.shoot = true; }}
            onMouseUp={() => { virtualControlsRef.current.shoot = false; }}
            onTouchStart={(e) => { e.preventDefault(); virtualControlsRef.current.shoot = true; }}
            onTouchEnd={(e) => { e.preventDefault(); virtualControlsRef.current.shoot = false; }}
            className="w-14 h-14 bg-amber-600 active:bg-amber-500 border-2 border-amber-400 rounded-full flex items-center justify-center font-mono font-bold text-xs text-yellow-100 shadow-lg select-none"
          >
            SHOOT
          </button>

          <button
            onMouseDown={() => { virtualControlsRef.current.dash = true; }}
            onMouseUp={() => { virtualControlsRef.current.dash = false; }}
            onTouchStart={(e) => { e.preventDefault(); virtualControlsRef.current.dash = true; }}
            onTouchEnd={(e) => { e.preventDefault(); virtualControlsRef.current.dash = false; }}
            className="w-14 h-14 bg-purple-900 active:bg-purple-800 border-2 border-purple-500 rounded-full flex items-center justify-center font-mono font-bold text-sm text-purple-300 shadow-lg select-none"
          >
            DASH
          </button>

          <button
            onMouseDown={() => { virtualControlsRef.current.jump = true; }}
            onMouseUp={() => { virtualControlsRef.current.jump = false; }}
            onTouchStart={(e) => { e.preventDefault(); virtualControlsRef.current.jump = true; }}
            onTouchEnd={(e) => { e.preventDefault(); virtualControlsRef.current.jump = false; }}
            className="w-14 h-14 bg-emerald-700 active:bg-emerald-600 border-2 border-emerald-400 rounded-full flex items-center justify-center font-mono font-bold text-sm text-emerald-200 shadow-lg select-none"
          >
            JUMP
          </button>
        </div>
      </div>
    </div>
  );
}
