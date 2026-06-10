import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Trophy, ShoppingBag, Joystick, RotateCw, HelpCircle, Flame, Star, Coins, ArrowRight, Skull } from 'lucide-react';
import GameCanvas from './components/GameCanvas';
import ProgressionShop from './components/ProgressionShop';
import AIGeneratorDsh from './components/AIGeneratorDsh';
import AchievementWidget from './components/AchievementWidget';
import { sound } from './sound';
import { PlayerStats, Achievement, AIQuest, LevelScore, ThemeType } from './types';

// Default level structures to build World Stages procedurally
function getStoredWorldLevel(world: number, stage: number): any {
  // Let's create themes matching worlds
  const themes: ThemeType[] = ['forest', 'desert', 'ice', 'volcano', 'sky'];
  const theme = world === 6 ? 'creepy' : themes[world - 1];
  const difficulty = world === 6 ? 'hard' : (stage === 1 ? 'easy' : stage === 2 ? 'medium' : 'hard');
  const lengthTiles = world === 6 ? 38 : (stage === 1 ? 100 : stage === stage === 2 ? 160 : 220);

  // Render a lovely visual set of platforms
  const platforms = [];
  const enemies = [];
  const collectibles = [];
  const powerups = [];

  if (world === 6) {
    // 👹 DEDICATED CREEPY BOSS ARENA-ONLY LEVEL! NO LENGTHY TRAVERSAL.
    // Flat ground platform
    platforms.push({ id: `boss_floor`, x: 0, y: 440, width: 1200, height: 160, behavior: 'static' });
    
    // Floating Mario Question Blocks for tactility & Jetpack fuel/powerups
    platforms.push({ id: `boss_qb_1`, x: 300, y: 300, width: 44, height: 44, isQuestionBlock: true, questionState: 'active', questionContent: 'shield', bounceY: 0 });
    platforms.push({ id: `boss_qb_2`, x: 550, y: 200, width: 44, height: 44, isQuestionBlock: true, questionState: 'active', questionContent: 'invincibility', bounceY: 0 });
    platforms.push({ id: `boss_qb_3`, x: 800, y: 300, width: 44, height: 44, isQuestionBlock: true, questionState: 'active', questionContent: 'speed', bounceY: 0 });

    // Floating static platforms to gain vertical high ground
    platforms.push({ id: `boss_plat_left`, x: 150, y: 260, width: 100, height: 24, behavior: 'static' });
    platforms.push({ id: `boss_plat_right`, x: 950, y: 260, width: 100, height: 24, behavior: 'static' });

    // Scattered quick coins to collect while flying
    for (let i = 0; i < 8; i++) {
      collectibles.push({
        id: `boss_coin_${i}`,
        x: 200 + i * 110,
        y: 120 + Math.sin(i) * 40,
        width: 20,
        height: 20,
        type: 'coin',
        collected: false,
        value: 1
      });
    }

    // Elite Dread Boss details matching the stage
    const bossType = stage === 1 ? 'slime_emperor' : stage === 2 ? 'mecha_cyborg' : 'skull_eye';
    const bossName = stage === 1 ? 'Lord Voldeslime' : stage === 2 ? 'Mecha Bowser 9000' : 'Beholder of Dread';
    const hp = stage === 1 ? 35 : stage === 2 ? 55 : 80;

    enemies.push({
      id: `w_boss_final_s${stage}`,
      x: 850,
      y: 280,
      width: stage === 3 ? 96 : 80, // Beholder of Dread is colossal!
      height: stage === 3 ? 96 : 80,
      type: 'boss',
      bossSubType: bossType,
      bossName: bossName,
      health: hp,
      maxHealth: hp,
      speed: stage === 1 ? 1.5 : stage === 2 ? 2.5 : 3.5,
      patrolRange: 320,
      startX: 850,
      startY: 230,
      direction: -1
    });

    return {
      theme,
      difficulty,
      length: 38, // Single screen width arena
      platforms,
      enemies,
      collectibles,
      powerups,
      checkpoint: { x: 100, y: 380, activated: false },
      goal: { x: 99999, y: 99999, width: 40, height: 80 }, // goal is out of bounds; only killing boss wins this level!
      isBossOnlyLevel: true,
      bossSubType: bossType
    };
  }

  // Spawn Platform
  platforms.push({ id: `w_start`, x: 0, y: 440, width: 450, height: 160, behavior: 'static' });

  let currentX = 450;
  let pId = 1;
  let eId = 1;
  let cId = 1;
  let pwId = 1;

  // Add random level elements
  while (currentX < lengthTiles * 32 - 400) {
    const gap = stage === 3 ? 120 : stage === 2 ? 80 : 60;
    currentX += gap + Math.floor(Math.random() * 40);

    const platWidth = 140 + Math.floor(Math.random() * 120);
    const platY = 320 + Math.floor(Math.random() * 120);

    platforms.push({
      id: `plat_${pId++}`,
      x: currentX,
      y: platY,
      width: platWidth,
      height: 40,
      behavior: Math.random() < 0.2 ? 'moving' : Math.random() < 0.1 ? 'falling' : 'static'
    });

    // Populate coins on platform
    for (let c = 30; c < platWidth - 30; c += 50) {
      collectibles.push({
        id: `coin_${cId++}`,
        x: currentX + c,
        y: platY - 30,
        width: 20,
        height: 20,
        type: Math.random() < 0.1 ? 'gem' : 'coin',
        collected: false,
        value: 1
      });
    }

    // Populate flying or walking enemies
    if (Math.random() < 0.45) {
      enemies.push({
        id: `enemy_${eId++}`,
        x: currentX + platWidth / 2,
        y: platY - 36,
        width: 32,
        height: 32,
        type: Math.random() < 0.6 ? 'walker' : 'jumper',
        health: 1,
        maxHealth: 1,
        speed: 1.2,
        patrolRange: Math.min(100, platWidth / 2 - 10),
        startX: currentX + platWidth / 2,
        startY: platY - 36,
        direction: 1
      });
    }

    // Spawn standard power ups crates
    if (Math.random() < 0.12) {
      powerups.push({
        id: `pwup_${pwId++}`,
        x: currentX + platWidth / 2,
        y: platY - 80,
        width: 30,
        height: 30,
        type: Math.random() < 0.25 ? 'shield' : Math.random() < 0.50 ? 'speed' : Math.random() < 0.75 ? 'magnet' : 'invincibility',
        collected: false
      });
    }

    currentX += platWidth;
  }

  // End boss or chest platform
  const endX = lengthTiles * 32 - 400;
  platforms.push({ id: `w_end`, x: endX, y: 440, width: 400, height: 160, behavior: 'static' });

  // Chest and Stars at the end
  collectibles.push({
    id: `chest_end`,
    x: endX + 100,
    y: 400,
    width: 40,
    height: 40,
    type: 'chest',
    collected: false,
    value: 30
  });

  collectibles.push({
    id: `star_end`,
    x: endX + 220,
    y: 350,
    width: 32,
    height: 32,
    type: 'star',
    collected: false,
    value: 100
  });

  // Boss inside 3rd Stage of each world!
  let boss: any = undefined;
  if (stage === 3) {
    boss = {
      id: `w_boss_${world}`,
      x: endX + 160,
      y: 360,
      width: 64,
      height: 64,
      type: 'boss',
      health: world * 2 + 2,
      maxHealth: world * 2 + 2,
      speed: 1.5,
      patrolRange: 150,
      startX: endX + 160,
      startY: 360,
      direction: -1
    };
    enemies.push(boss);
  }

  return {
    theme,
    difficulty,
    length: lengthTiles,
    platforms,
    enemies,
    collectibles,
    powerups,
    checkpoint: { x: Math.floor(endX / 2), y: 380 },
    goal: { x: endX + 320, y: 360, width: 40, height: 80 }
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'menu' | 'world_map' | 'shop' | 'ai_generator' | 'achievements' | 'active_game'>('menu');

  // Player state loaded from local storage
  const [stats, setStats] = useState<PlayerStats>({
    speedLevel: 1,
    jumpLevel: 1,
    dashLevel: 1,
    healthLevel: 1,
    magnetLevel: 1,
    coins: 150, // Starting bonus
    starsUnlocked: 0,
    unlockedSkins: ['retro'],
    activeSkin: 'retro',
  });

  // World star ratings tracked: 5 worlds, 3 stages each
  const [levelScores, setLevelScores] = useState<{ [key: string]: LevelScore }>({});

  // Active Quest (AI backed)
  const [activeQuest, setActiveQuest] = useState<AIQuest | null>(null);

  // App notification state (achievements unlocked popups)
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Active layout for the canvas game
  const [activeLayout, setActiveLayout] = useState<any>(null);

  // Master Achievements
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: 'first_jump', title: 'First Steps', description: 'Begin your journey and finish any level stage layout.', unlocked: false, icon: 'jump' },
    { id: 'coin_collector', title: 'Gold Rush Hero', description: 'Saved more than 500 gold coins inside your purse.', unlocked: false, icon: 'coin_100' },
    { id: 'boss_slayer', title: 'World Liberator', description: 'Defeat any boss monster on Stage 3 levels.', unlocked: false, icon: 'boss' },
    { id: 'secret_hunter', title: 'Space Pioneer', description: 'Buy and equip the cosmic elite Space Hero skin.', unlocked: false, icon: 'secret' },
    { id: 'completionist', title: 'Master Completionist', description: 'Ascend all custom upgrades to Maximum Level 5.', unlocked: false, icon: 'all' }
  ]);

  // Load state on mount
  useEffect(() => {
    sound.playBGM('menu');

    const storedStats = localStorage.getItem('pq_player_stats_v2');
    if (storedStats) {
      try {
        setStats(JSON.parse(storedStats));
      } catch (e) {}
    }

    const storedScores = localStorage.getItem('pq_level_scores_v2');
    if (storedScores) {
      try {
        setLevelScores(JSON.parse(storedScores));
      } catch (e) {}
    }

    const storedQuest = localStorage.getItem('pq_active_quest');
    if (storedQuest) {
      try {
        setActiveQuest(JSON.parse(storedQuest));
      } catch (e) {}
    } else {
      generateFreshQuest();
    }

    const storedAchievements = localStorage.getItem('pq_achievements');
    if (storedAchievements) {
      try {
        setAchievements(JSON.parse(storedAchievements));
      } catch (e) {}
    }
  }, []);

  // Save state on alterations
  const saveStats = (newStats: PlayerStats) => {
    setStats(newStats);
    localStorage.setItem('pq_player_stats_v2', JSON.stringify(newStats));
    checkAchievements(newStats, achievements);
  };

  const saveScores = (newScores: { [key: string]: LevelScore }) => {
    setLevelScores(newScores);
    localStorage.setItem('pq_level_scores_v2', JSON.stringify(newScores));
  };

  // Triggers nice notifications
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Generates AI or procedurally fallback quest
  const generateFreshQuest = async () => {
    try {
      const response = await fetch('/api/generate-quest', { method: 'POST' });
      const data = await response.json();
      setActiveQuest(data);
      localStorage.setItem('pq_active_quest', JSON.stringify(data));
    } catch (e) {
      // Local fallback
      const fallback = {
        id: "q_local_1",
        title: "Arcade Novice",
        description: "Amass 30 coins over multiple runs inside Grassland.",
        rewardCoins: 100,
        targetCount: 30,
        currentCount: 0,
        type: 'collect_coins' as any,
        completed: false
      };
      setActiveQuest(fallback);
      localStorage.setItem('pq_active_quest', JSON.stringify(fallback));
    }
  };

  // Achievements rules checker
  const checkAchievements = (currentStats: PlayerStats, list: Achievement[]) => {
    let changed = false;
    const updated = list.map(item => {
      if (item.unlocked) return item;

      let shouldUnlock = false;
      if (item.id === 'coin_collector' && currentStats.coins >= 500) {
        shouldUnlock = true;
      }
      if (item.id === 'secret_hunter' && currentStats.activeSkin === 'space') {
        shouldUnlock = true;
      }
      if (item.id === 'completionist') {
        const upgradesSum = currentStats.speedLevel + currentStats.jumpLevel + currentStats.dashLevel + currentStats.healthLevel + currentStats.magnetLevel;
        if (upgradesSum >= 25) { // 5 stat categories * level 5 each
          shouldUnlock = true;
        }
      }

      if (shouldUnlock) {
        triggeredAchievementNotification(item.title);
        changed = true;
        return { ...item, unlocked: true, unlockedAt: new Date().toLocaleDateString() };
      }
      return item;
    });

    if (changed) {
      setAchievements(updated);
      localStorage.setItem('pq_achievements', JSON.stringify(updated));
    }
  };

  const triggeredAchievementNotification = (title: string) => {
    sound.playPowerUp();
    triggerToast(`🏆 ACHIEVEMENT UNLOCKED: "${title}"!`);
  };

  const handleStartProceduralLevel = (world: number, stage: number) => {
    sound.playCoin();
    const layout = getStoredWorldLevel(world, stage);
    // Annotate identity identifier
    layout.worldId = world;
    layout.stageId = stage;
    setActiveLayout(layout);
    setActiveTab('active_game');
  };

  const handleStartCustomSandboxLevel = (layout: any) => {
    layout.worldId = 99; // 99 for custom sandboxes
    layout.stageId = 99;
    setActiveLayout(layout);
    setActiveTab('active_game');
  };

  const handleLevelFinished = (coinsWon: number, seconds: number, starsEarned: number) => {
    sound.playPowerUp();
    
    // Add gold to stats
    const updatedCoins = stats.coins + coinsWon;
    let updatedStars = stats.starsUnlocked;

    // Check progress of World Levels to unlock successive worlds
    const currentWorld = activeLayout.worldId;
    const currentStage = activeLayout.stageId;
    const key = `w_${currentWorld}_s_${currentStage}`;

    const scoreMap = { ...levelScores };
    const prevScore = scoreMap[key];
    const prevStars = prevScore ? prevScore.stars : 0;

    // Record star gains if higher than previous attempt
    let starsGained = 0;
    if (starsEarned > prevStars) {
      starsGained = starsEarned - prevStars;
      updatedStars += starsGained;
    }

    scoreMap[key] = {
      stars: Math.max(prevStars, starsEarned),
      coinsCollected: coinsWon,
      timeTaken: seconds,
      enemiesDefeated: 0,
      completed: true,
      unlocked: true,
    };

    // Unlock successive level
    if (currentStage < 3) {
      const nextKey = `w_${currentWorld}_s_${currentStage + 1}`;
      if (!scoreMap[nextKey]) {
        scoreMap[nextKey] = { stars: 0, coinsCollected: 0, timeTaken: 0, enemiesDefeated: 0, completed: false, unlocked: true };
      }
    } else if (currentWorld < 5) {
      // Unlock next world stages
      const nextWorldKey = `w_${currentWorld + 1}_s_1`;
      if (!scoreMap[nextWorldKey]) {
        scoreMap[nextWorldKey] = { stars: 0, coinsCollected: 0, timeTaken: 0, enemiesDefeated: 0, completed: false, unlocked: true };
      }
    }

    saveScores(scoreMap);

    // Apply active Quest updates
    let questCoinsBonus = 0;
    if (activeQuest && !activeQuest.completed) {
      const updatedQuest = { ...activeQuest };
      if (updatedQuest.type === 'collect_coins') {
        updatedQuest.currentCount += coinsWon;
      } else {
        // general clearing increment
        updatedQuest.currentCount += 1;
      }

      if (updatedQuest.currentCount >= updatedQuest.targetCount) {
        updatedQuest.completed = true;
        questCoinsBonus = updatedQuest.rewardCoins;
        triggerToast(`🎉 QUEST FINISHED! Earnt +${questCoinsBonus} coins bonus!`);
      }
      setActiveQuest(updatedQuest);
      localStorage.setItem('pq_active_quest', JSON.stringify(updatedQuest));
    }

    // Trigger First Jump achievement
    let listAchievements = [...achievements];
    if (!listAchievements[0].unlocked) {
      listAchievements[0].unlocked = true;
      listAchievements[0].unlockedAt = new Date().toLocaleDateString();
      triggeredAchievementNotification(listAchievements[0].title);
      setAchievements(listAchievements);
      localStorage.setItem('pq_achievements', JSON.stringify(listAchievements));
    }

    // Trigger Boss Slayer on Stage 3 boss clearing
    if (currentStage === 3 && !listAchievements[2].unlocked) {
      listAchievements[2].unlocked = true;
      listAchievements[2].unlockedAt = new Date().toLocaleDateString();
      triggeredAchievementNotification(listAchievements[2].title);
      setAchievements(listAchievements);
      localStorage.setItem('pq_achievements', JSON.stringify(listAchievements));
    }

    saveStats({
      ...stats,
      coins: updatedCoins + questCoinsBonus,
      starsUnlocked: updatedStars
    });

    // Bounce back to menu/map
    setActiveTab('world_map');
    sound.playBGM('menu');
  };

  const handleUpdateCoinsGlobal = (gained: number) => {
    // Increment stats coins directly inside stages on collection
    saveStats({
      ...stats,
      coins: stats.coins + gained
    });
  };

  // Upgrade traits action
  const handleUpgradeStat = (stat: any) => {
    const prices = {
      speed: (stats.speedLevel + 1) * 100,
      jump: (stats.jumpLevel + 1) * 100,
      dash: (stats.dashLevel + 1) * 120,
      health: (stats.healthLevel + 1) * 150,
      magnet: (stats.magnetLevel + 1) * 80,
    };

    const cost = prices[stat as keyof typeof prices];
    if (stats.coins >= cost) {
      const nextStats = { ...stats };
      nextStats.coins -= cost;
      if (stat === 'speed') nextStats.speedLevel++;
      if (stat === 'jump') nextStats.jumpLevel++;
      if (stat === 'dash') nextStats.dashLevel++;
      if (stat === 'health') nextStats.healthLevel++;
      if (stat === 'magnet') nextStats.magnetLevel++;

      saveStats(nextStats);
      triggerToast(`⚡ Upgraded ${stat.toUpperCase()} traits to level ${nextStats[stat as keyof PlayerStats] as number}!`);
    }
  };

  // Equips dynamic custom skins
  const handleSelectSkin = (skin: 'retro' | 'robot' | 'ninja' | 'space') => {
    saveStats({
      ...stats,
      activeSkin: skin
    });
    triggerToast(`🎭 Equipped custom outfit: "${skin.toUpperCase()} HERO"!`);
  };

  // Buy skins
  const handleUnlockSkin = (skin: 'robot' | 'ninja' | 'space', price: number) => {
    if (stats.coins >= price) {
      const nextStats = { ...stats };
      nextStats.coins -= price;
      nextStats.unlockedSkins.push(skin);
      nextStats.activeSkin = skin;
      saveStats(nextStats);
      triggerToast(`✨ Successfully unlocked epic ${skin.toUpperCase()} suit!`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-yellow-400 selection:text-zinc-900 pb-12">
      
      {/* Dynamic Toast Indicator */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/90 border-4 border-yellow-500 p-4 rounded-lg shadow-2xl animate-bounce font-mono text-xs text-yellow-300">
          {toastMsg}
        </div>
      )}

      {/* Main retro logo header */}
      <header className="bg-zinc-900 border-b-4 border-zinc-700 py-5 shadow-lg select-none px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { sound.playCoin(); setActiveTab('menu'); }}>
            <Joystick className="w-10 h-10 text-yellow-400 animate-spin" />
            <div>
              <h1 className="text-3xl font-mono text-yellow-400 font-extrabold tracking-widest leading-none">PIXEL QUEST</h1>
              <p className="text-[10px] font-mono tracking-wider font-semibold text-zinc-500 uppercase mt-0.5">EST. 2012 ARCADE MOBILE PLATFORMER</p>
            </div>
          </div>

          {/* Quick HUD values */}
          <div className="flex flex-wrap items-center gap-6 font-mono text-xs text-zinc-300">
            <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span>COINS: <span className="text-yellow-400 font-bold">{stats.coins}</span></span>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded flex items-center gap-2">
              <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              <span>STARS: <span className="text-emerald-400 font-bold">{stats.starsUnlocked}</span></span>
            </div>
          </div>
        </div>
      </header>

      {/* Sub menu navigation */}
      {activeTab !== 'active_game' && (
        <nav className="max-w-4xl mx-auto mt-6 px-4">
          <div className="bg-zinc-900/50 border-4 border-zinc-800 p-2 rounded-lg flex flex-wrap gap-2 justify-center">
            {[
              { id: 'menu', label: 'Home Desk', icon: Joystick },
              { id: 'world_map', label: 'World Levels', icon: Play },
              { id: 'shop', label: 'Upgrades Shop', icon: ShoppingBag },
              { id: 'ai_generator', label: 'AI Sandbox', icon: Sparkles },
              { id: 'achievements', label: 'Achievements', icon: Trophy },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    sound.playCoin();
                    setActiveTab(tab.id as any);
                  }}
                  className={`py-2 px-4 rounded font-mono text-xs font-bold uppercase transition flex items-center gap-2 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-yellow-500 text-zinc-950'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Active Tab Panel Switcher */}
      <main className="max-w-6xl mx-auto mt-8 px-4">
        {activeTab === 'menu' && (
          <div className="max-w-3xl mx-auto space-y-8 bg-zinc-900/40 border-4 border-zinc-800 p-8 rounded-lg relative overflow-hidden">
            
            {/* Visual background details */}
            <div className="text-center space-y-4">
              <div className="inline-block p-4 bg-zinc-950 border-2 border-yellow-500 rounded-full animate-pulse">
                <Joystick className="w-16 h-16 text-yellow-400" />
              </div>
              <h2 className="text-4xl font-mono text-yellow-400 font-black uppercase tracking-wider">PIXEL QUEST 2012</h2>
              <p className="text-sm font-light text-zinc-400 leading-relaxed max-w-xl mx-auto font-sans">
                A vintage 2D platformer crafted as an aesthetic homage to early touch-friendly mobile games. Build crazy layouts using the **Twin-API Gemini Cloud model**, meet quirky NPCs, and unlock awesome suits!
              </p>
            </div>

            {/* Menu launchers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-4">
              <button
                onClick={() => { sound.playPowerUp(); setActiveTab('world_map'); }}
                className="py-4 px-6 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-mono text-base font-bold uppercase rounded-md shadow-xl flex items-center justify-center gap-2 border-b-4 border-yellow-700 active:border-b-0 cursor-pointer active:translate-y-0.5"
              >
                <Play className="w-5 h-5 fill-zinc-950" /> Start World Map
              </button>
              <button
                onClick={() => { sound.playPowerUp(); setActiveTab('ai_generator'); }}
                className="py-4 px-6 bg-zinc-800 hover:bg-zinc-700 text-yellow-400 font-mono text-base font-bold uppercase rounded-md shadow-xl border-4 border-zinc-700 flex items-center justify-center gap-2 cursor-pointer transition active:translate-y-0.5"
              >
                <Sparkles className="w-5 h-5" /> AI Sandbox
              </button>
            </div>

            {/* Retro instructional panel */}
            <div className="bg-zinc-950 p-6 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-400 max-w-xl mx-auto space-y-3">
              <h3 className="font-bold text-yellow-400 uppercase tracking-widest border-b border-zinc-850 pb-1.5 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-yellow-500" /> Retro Arcade Controls
              </h3>
              <div className="grid grid-cols-2 gap-4 pb-1 font-sans">
                <div className="space-y-1 text-zinc-400">
                  <p className="font-bold text-zinc-300">KEYBOARD:</p>
                  <p>• Left & Right: <span className="text-yellow-400">A / D</span> or <span className="text-yellow-400">◀ / ▶</span></p>
                  <p>• Jump/Dbl-Jump: <span className="text-yellow-400">Space</span> or <span className="text-yellow-400">W</span></p>
                  <p>• Speed Dash: <span className="text-yellow-400">Shift</span> or <span className="text-yellow-400">X</span></p>
                </div>
                <div className="space-y-1 text-zinc-400">
                  <p className="font-bold text-zinc-300">MOBILE / TOUCH:</p>
                  <p>• Multi-touch virtual d-pad overlay is docked securely at the bottom of the stage screen.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* World Map Section */}
        {activeTab === 'world_map' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="border-b-4 border-zinc-800 pb-3 mb-6">
              <h2 className="text-2xl font-mono text-yellow-400 font-extrabold uppercase flex items-center gap-2">
                <Play className="w-6 h-6 text-yellow-400 fill-yellow-400" /> Journey World Map
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-1 uppercase">Select world gates and gather shiny stage levels star medals</p>
            </div>

            {/* List 6 beautiful thematic worlds including the Creepy Dread Arena! */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { world: 1, name: 'Glasslands', theme: 'forest', color: 'from-emerald-900 to-teal-950 border-emerald-500 bg-emerald-950/20' },
                { world: 2, name: 'Desert Sandscape', theme: 'desert', color: 'from-amber-900 to-orange-950 border-amber-500 bg-amber-950/20' },
                { world: 3, name: 'Glacial Icepeaks', theme: 'ice', color: 'from-sky-900 to-cyan-950 border-sky-400 bg-cyan-950/20' },
                { world: 4, name: 'Volcano Magma-core', theme: 'volcano', color: 'from-red-950 to-stone-950 border-red-500 bg-red-950/20' },
                { world: 5, name: 'Azure Sky Castle', theme: 'sky', color: 'from-indigo-950 to-purple-950 border-indigo-400 bg-indigo-950/20' },
                { world: 6, name: 'Creepy Dread Arena', theme: 'creepy', color: 'from-purple-950 via-red-950 to-black border-red-600 bg-red-950/35 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.35)]' }
              ].map((worldObj) => {
                // Is this world unlocked? World 1 is always open, others need stars or previous completed
                const isWorldUnlocked = worldObj.world === 1 || stats.starsUnlocked >= (worldObj.world - 1) * 2;

                return (
                  <div
                    key={worldObj.world}
                    className={`border-4 rounded-lg p-5 bg-gradient-to-br flex flex-col justify-between h-72 transition ${worldObj.color} ${
                      !isWorldUnlocked ? 'opacity-35 grayscale' : 'shadow-xl hover:scale-[1.02]'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-baseline font-mono mb-2">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">WORLD 0{worldObj.world}</span>
                        {isWorldUnlocked ? (
                          <span className="text-emerald-400 text-[10px] uppercase font-bold bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                            Unlocked
                          </span>
                        ) : (
                          <span className="text-red-400 text-[10px] uppercase font-bold bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Skull className="w-3 h-3" /> Lock
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-mono text-yellow-300 font-extrabold uppercase">{worldObj.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 capitalize">Theme vibe: {worldObj.theme} terrain environments</p>
                    </div>

                    {isWorldUnlocked ? (
                      /* Render stages 1-3 buttons inside the world card with star ratings */
                      <div className="space-y-2 mt-4 font-mono">
                        {[1, 2, 3].map((stage) => {
                          const scoreKey = `w_${worldObj.world}_s_${stage}`;
                          const state = levelScores[scoreKey] || { stars: 0, completed: false, unlocked: stage === 1 };
                          const rating = state.stars;

                          return (
                            <button
                              key={stage}
                              onClick={() => handleUpdateWorldSelection(worldObj.world, stage, state)}
                              className={`w-full py-1.5 px-3 border-2 rounded text-xs text-left font-bold uppercase transition flex items-center justify-between ${
                                state.unlocked || state.completed
                                  ? 'border-zinc-700 bg-zinc-950 hover:bg-zinc-900 cursor-pointer text-zinc-200 hover:border-yellow-500/50'
                                  : 'border-zinc-900 bg-zinc-950/20 text-zinc-600 cursor-not-allowed'
                              }`}
                            >
                              <span>Stage {worldObj.world}-{stage} {stage === 3 && '👹'}</span>
                              <div className="flex items-center gap-2">
                                {/* Stars ratings */}
                                <span className="text-yellow-400 text-sm">
                                  {rating > 0 ? "★".repeat(rating) : "☆☆☆"}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-6 p-3 bg-zinc-950/60 rounded border border-dashed border-zinc-800 text-center font-mono text-xs text-zinc-500">
                        Amass {(worldObj.world - 1) * 2} Stars to unlock gate
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upgrades shop tab */}
        {activeTab === 'shop' && (
          <ProgressionShop
            stats={stats}
            onUpgrade={handleUpgradeStat}
            onSelectSkin={handleSelectSkin}
            onUnlockSkin={handleUnlockSkin}
          />
        )}

        {/* AI Generator Dashboard tab */}
        {activeTab === 'ai_generator' && (
          <AIGeneratorDsh
            quest={activeQuest}
            onRefreshQuest={generateFreshQuest}
            onPlayGeneratedLevel={handleStartCustomSandboxLevel}
          />
        )}

        {/* Achievements tab */}
        {activeTab === 'achievements' && (
          <AchievementWidget achievements={achievements} />
        )}

        {/* Active game overlay canvas */}
        {activeTab === 'active_game' && activeLayout && (
          <GameCanvas
            layout={activeLayout}
            stats={stats}
            onUpdateCoins={handleUpdateCoinsGlobal}
            onLevelComplete={handleLevelFinished}
            onExit={() => {
              sound.playCoin();
              setActiveTab('world_map');
              sound.playBGM('menu');
            }}
          />
        )}

      </main>
    </div>
  );

  function handleUpdateWorldSelection(world: number, stage: number, state: any) {
    if (state.unlocked || state.completed) {
      handleStartProceduralLevel(world, stage);
    }
  }
}
