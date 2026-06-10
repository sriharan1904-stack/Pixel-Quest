import React from 'react';
import { Shield, Zap, Sparkles, Heart, Activity, Coins, User, ArrowUpRight } from 'lucide-react';
import { PlayerStats } from '../types';
import { sound } from '../sound';

interface ProgressionShopProps {
  stats: PlayerStats;
  onUpgrade: (stat: keyof PlayerStats | 'speed' | 'jump' | 'dash' | 'health' | 'magnet') => void;
  onSelectSkin: (skinName: 'retro' | 'robot' | 'ninja' | 'space') => void;
  onUnlockSkin: (skinName: 'robot' | 'ninja' | 'space', price: number) => void;
}

export default function ProgressionShop({ stats, onUpgrade, onSelectSkin, onUnlockSkin }: ProgressionShopProps) {
  // Upgrade prices and stats info
  const upgradePrices = {
    speed: (stats.speedLevel + 1) * 100,
    jump: (stats.jumpLevel + 1) * 100,
    dash: (stats.dashLevel + 1) * 120,
    health: (stats.healthLevel + 1) * 150,
    magnet: (stats.magnetLevel + 1) * 80,
  };

  const maxLevel = 5;

  const skinsInfo = [
    { id: 'retro', name: 'Retro Hero', desc: 'Classic 2012 red-capped pixel mascot', price: 0, color: 'bg-red-500' },
    { id: 'robot', name: 'Robot Hero', desc: 'Sleek titanium core & laser-blue booster trails', price: 400, color: 'bg-cyan-500 border-2 border-cyan-300' },
    { id: 'ninja', name: 'Ninja Hero', desc: 'Shadow shinobi with smoke dash effects', price: 800, color: 'bg-zinc-900 border-2 border-purple-500' },
    { id: 'space', name: 'Space Hero', desc: 'Cosmic astro suit & anti-gravity sparkles', price: 1200, color: 'bg-indigo-600 border-2 border-violet-300 animate-pulse' },
  ];

  const handleStatUpgrade = (stat: 'speed' | 'jump' | 'dash' | 'health' | 'magnet', price: number) => {
    const currentLvl = 
      stat === 'speed' ? stats.speedLevel :
      stat === 'jump' ? stats.jumpLevel :
      stat === 'dash' ? stats.dashLevel :
      stat === 'health' ? stats.healthLevel : stats.magnetLevel;

    if (currentLvl >= maxLevel) return;
    if (stats.coins < price) {
      sound.playDamage(); // Error sound
      return;
    }
    sound.playPowerUp();
    onUpgrade(stat);
  };

  const handleSkinAction = (skin: typeof skinsInfo[0]) => {
    const isUnlocked = stats.unlockedSkins.includes(skin.id);
    if (isUnlocked) {
      sound.playCoin();
      onSelectSkin(skin.id as any);
    } else {
      if (stats.coins < skin.price) {
        sound.playDamage();
        return;
      }
      sound.playPowerUp();
      onUnlockSkin(skin.id as any, skin.price);
    }
  };

  return (
    <div className="bg-zinc-950 border-4 border-zinc-700 p-6 rounded-lg text-white font-sans max-w-4xl mx-auto shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b-4 border-zinc-800 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-mono text-yellow-400 font-extrabold tracking-tight uppercase">Pixel HQ Shop</h2>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-mono">Upgrade your traits and equip custom hero suits</p>
        </div>
        <div className="bg-zinc-900 border-2 border-yellow-500/50 px-4 py-2 rounded-lg flex items-center gap-2 self-start">
          <Coins className="w-5 h-5 text-yellow-400 animate-spin" />
          <span className="text-xl font-mono font-bold text-yellow-400">{stats.coins}</span>
          <span className="text-xs text-zinc-500 font-mono">COINS</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Traits upgrades */}
        <div>
          <h3 className="text-lg font-mono font-bold text-zinc-300 border-b-2 border-zinc-800 pb-2 mb-4 uppercase">Traits Upgrades</h3>
          <div className="space-y-4">
            {/* Speed Upgrade */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-sm font-bold text-zinc-200 uppercase">Movement Speed</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">LVL {stats.speedLevel}/{maxLevel}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(maxLevel)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm border border-zinc-950 ${
                      i < stats.speedLevel ? 'bg-cyan-400' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
              {stats.speedLevel < maxLevel ? (
                <button
                  onClick={() => handleStatUpgrade('speed', upgradePrices.speed)}
                  className={`w-full py-1.5 px-3 border border-zinc-700 rounded font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    stats.coins >= upgradePrices.speed
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-300 cursor-pointer'
                      : 'bg-zinc-950 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  UPGRADE <ArrowUpRight className="w-3.5 h-3.5" /> (-{upgradePrices.speed} coins)
                </button>
              ) : (
                <div className="text-center py-1 text-xs text-green-400 font-mono uppercase bg-green-500/10 border border-green-500/20 rounded">
                  Max Power
                </div>
              )}
            </div>

            {/* Jump Height Upgrade */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-sm font-bold text-zinc-200 uppercase">Jump Gravity</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">LVL {stats.jumpLevel}/{maxLevel}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(maxLevel)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm border border-zinc-950 ${
                      i < stats.jumpLevel ? 'bg-emerald-400' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
              {stats.jumpLevel < maxLevel ? (
                <button
                  onClick={() => handleStatUpgrade('jump', upgradePrices.jump)}
                  className={`w-full py-1.5 px-3 border border-zinc-700 rounded font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    stats.coins >= upgradePrices.jump
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-300 cursor-pointer'
                      : 'bg-zinc-950 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  UPGRADE <ArrowUpRight className="w-3.5 h-3.5" /> (-{upgradePrices.jump} coins)
                </button>
              ) : (
                <div className="text-center py-1 text-xs text-green-400 font-mono uppercase bg-green-500/10 border border-green-500/20 rounded">
                  Max Power
                </div>
              )}
            </div>

            {/* Dash Cooldown Upgrade */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="font-mono text-sm font-bold text-zinc-200 uppercase">Dash Coolness</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">LVL {stats.dashLevel}/{maxLevel}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(maxLevel)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm border border-zinc-950 ${
                      i < stats.dashLevel ? 'bg-purple-400' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
              {stats.dashLevel < maxLevel ? (
                <button
                  onClick={() => handleStatUpgrade('dash', upgradePrices.dash)}
                  className={`w-full py-1.5 px-3 border border-zinc-700 rounded font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    stats.coins >= upgradePrices.dash
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-300 cursor-pointer'
                      : 'bg-zinc-950 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  UPGRADE <ArrowUpRight className="w-3.5 h-3.5" /> (-{upgradePrices.dash} coins)
                </button>
              ) : (
                <div className="text-center py-1 text-xs text-green-400 font-mono uppercase bg-green-500/10 border border-green-500/20 rounded">
                  Max Power
                </div>
              )}
            </div>

            {/* Max Hearts Upgrade */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500 animate-pulse" />
                  <span className="font-mono text-sm font-bold text-zinc-200 uppercase">Max HP Count</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">LVL {stats.healthLevel}/{maxLevel}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(maxLevel)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm border border-zinc-950 ${
                      i < stats.healthLevel ? 'bg-red-500' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
              {stats.healthLevel < maxLevel ? (
                <button
                  onClick={() => handleStatUpgrade('health', upgradePrices.health)}
                  className={`w-full py-1.5 px-3 border border-zinc-700 rounded font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    stats.coins >= upgradePrices.health
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-300 cursor-pointer'
                      : 'bg-zinc-950 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  UPGRADE <ArrowUpRight className="w-3.5 h-3.5" /> (-{upgradePrices.health} coins)
                </button>
              ) : (
                <div className="text-center py-1 text-xs text-green-400 font-mono uppercase bg-green-500/10 border border-green-500/20 rounded">
                  Max Power
                </div>
              )}
            </div>

            {/* Coin Magnet Upgrade */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-pink-400" />
                  <span className="font-mono text-sm font-bold text-zinc-200 uppercase">Coin Magnet Range</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">LVL {stats.magnetLevel}/{maxLevel}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(maxLevel)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-sm border border-zinc-950 ${
                      i < stats.magnetLevel ? 'bg-pink-400' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
              {stats.magnetLevel < maxLevel ? (
                <button
                  onClick={() => handleStatUpgrade('magnet', upgradePrices.magnet)}
                  className={`w-full py-1.5 px-3 border border-zinc-700 rounded font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2 ${
                    stats.coins >= upgradePrices.magnet
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-yellow-300 cursor-pointer'
                      : 'bg-zinc-950 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  UPGRADE <ArrowUpRight className="w-3.5 h-3.5" /> (-{upgradePrices.magnet} coins)
                </button>
              ) : (
                <div className="text-center py-1 text-xs text-green-400 font-mono uppercase bg-green-500/10 border border-green-500/20 rounded">
                  Max Power
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Skins shop */}
        <div>
          <h3 className="text-lg font-mono font-bold text-zinc-300 border-b-2 border-zinc-800 pb-2 mb-4 uppercase">Hero Skins (Unlocks)</h3>
          <div className="grid grid-cols-1 gap-4">
            {skinsInfo.map((skin) => {
              const isUnlocked = stats.unlockedSkins.includes(skin.id);
              const isActive = stats.activeSkin === skin.id;

              return (
                <div
                  key={skin.id}
                  className={`p-4 rounded-lg border-2 flex items-center justify-between gap-4 transition-all ${
                    isActive
                      ? 'bg-zinc-900 border-yellow-500 shadow-lg shadow-yellow-500/5'
                      : 'bg-zinc-900/50 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${skin.color}`}>
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-bold text-zinc-200">{skin.name}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{skin.desc}</p>
                    </div>
                  </div>

                  <div>
                    {isActive ? (
                      <span className="text-xs font-mono font-bold text-yellow-300 bg-yellow-500/10 px-3 py-1 border border-yellow-500/30 rounded uppercase">
                        Equipped
                      </span>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => handleSkinAction(skin)}
                        className="py-1 px-3 border-2 border-zinc-600 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold uppercase cursor-pointer"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSkinAction(skin)}
                        className={`py-1 px-3 border-2 rounded text-xs font-mono font-bold uppercase transition flex items-center gap-1 ${
                          stats.coins >= skin.price
                            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300 cursor-pointer hover:bg-yellow-500/30'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        Buy <Coins className="w-3.5 h-3.5 text-yellow-400" /> {skin.price}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
