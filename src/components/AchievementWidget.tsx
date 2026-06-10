import React from 'react';
import { Trophy, Star, Shield, Zap, Sparkles, Target, Coins, ShieldAlert } from 'lucide-react';
import { Achievement } from '../types';

interface AchievementWidgetProps {
  achievements: Achievement[];
}

export default function AchievementWidget({ achievements }: AchievementWidgetProps) {
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const getBadgeIcon = (iconName: string, unlocked: boolean) => {
    const colorClass = unlocked ? "text-yellow-400" : "text-zinc-500 opacity-40";
    switch (iconName) {
      case 'jump':
        return <Zap className={`w-8 h-8 ${colorClass}`} />;
      case 'coin_100':
        return <Coins className={`w-8 h-8 ${colorClass}`} />;
      case 'boss':
        return <Target className={`w-8 h-8 ${colorClass}`} />;
      case 'secret':
        return <Sparkles className={`w-8 h-8 ${colorClass}`} />;
      case 'all':
        return <Trophy className={`w-8 h-8 ${colorClass}`} />;
      default:
        return <Star className={`w-8 h-8 ${colorClass}`} />;
    }
  };

  return (
    <div className="bg-zinc-900 border-4 border-zinc-700 p-6 rounded-lg text-white font-sans max-w-2xl mx-auto shadow-2xl">
      <div className="flex justify-between items-center border-b-4 border-zinc-700 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
          <h2 className="text-2xl font-mono tracking-tight text-yellow-400 font-bold uppercase">Achievements</h2>
        </div>
        <div className="bg-zinc-800 px-3 py-1 border-2 border-zinc-600 rounded font-mono text-sm text-yellow-300">
          UNLOCKED: {unlockedCount} / {achievements.length}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-4 rounded-md border-2 flex items-center gap-4 transition-all duration-300 ${
              achievement.unlocked
                ? 'bg-zinc-800/80 border-yellow-500/60 shadow-lg shadow-yellow-500/10'
                : 'bg-zinc-900 border-zinc-800 opacity-60'
            }`}
          >
            <div className="bg-zinc-950 p-2 border-2 border-zinc-700 rounded-md">
              {getBadgeIcon(achievement.icon, achievement.unlocked)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className={`font-mono text-base font-bold ${achievement.unlocked ? 'text-yellow-300' : 'text-zinc-400'}`}>
                  {achievement.title}
                </h3>
                {achievement.unlocked && (
                  <span className="text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded uppercase">
                    Unlocked
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {achievement.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
