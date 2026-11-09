import React from 'react';
import { useGameStore } from '../store';
import { Crosshair, Target, AlertTriangle, Pause } from 'lucide-react';
import { getTranslation } from '../i18n';
import { Radar } from './Radar';

export function HUD() {
  const gameState = useGameStore(state => state.gameState);
  const togglePause = useGameStore(state => state.togglePause);
  const health = useGameStore(state => state.health);
  const speed = useGameStore(state => state.speed);
  const altitude = useGameStore(state => state.altitude);
  const bullets = useGameStore(state => state.bullets);
  const homingMissiles = useGameStore(state => state.homingMissiles);
  const groundMissiles = useGameStore(state => state.groundMissiles);
  const score = useGameStore(state => state.score);
  const trophies = useGameStore(state => state.trophies);
  const lockedTargetId = useGameStore(state => state.lockedTargetId);
  const language = useGameStore(state => state.language);
  const projectiles = useGameStore(state => state.projectiles);
  const playerPos = useGameStore(state => state.playerPos);

  const isMissileIncoming = projectiles.some(p => p.type === 'missile' && p.owner === 'enemy' && p.position.distanceTo(playerPos) < 2000);

  if (gameState !== 'playing' && gameState !== 'paused') return null;

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);
  const isRTL = language === 'he';

  return (
    <div className={`absolute inset-0 pointer-events-none select-none overflow-hidden font-mono text-green-500 ${isRTL ? 'dir-rtl' : 'dir-ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Missile Warning */}
      {isMissileIncoming && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 text-red-500 text-4xl font-bold animate-pulse">
          MISSILE INCOMING!
        </div>
      )}

      {/* Dynamic Tactical Radar */}
      <Radar isRTL={isRTL} />

      {/* Pause Button */}
      <button 
        onClick={togglePause}
        className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} pointer-events-auto bg-black/50 p-2 rounded-full border border-green-500/50 hover:bg-green-500/20`}
      >
        <Pause size={24} />
      </button>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-70">
        <Crosshair size={48} strokeWidth={1} />
        {lockedTargetId && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-500 animate-pulse">
            <Target size={64} strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Top Right: Score & Status */}
      <div className={`absolute top-4 ${isRTL ? 'left-4 text-left' : 'right-4 text-right'} bg-black/30 p-4 rounded-lg backdrop-blur-sm border border-green-500/30`}>
        <div className="text-2xl font-bold mb-1">{t('hudScore')}: {score.toString().padStart(6, '0')}</div>
        <div className="text-xl font-bold mb-2 text-yellow-500">{t('trophies')}: {trophies}</div>
        <div className={`flex items-center ${isRTL ? 'justify-start' : 'justify-end'} gap-2 text-red-500 animate-pulse`}>
          {health < 30 && <><AlertTriangle size={20} /> {t('warningLowHull')}</>}
        </div>
      </div>

      {/* Bottom Left: Speed & Altitude */}
      <div className={`absolute bottom-4 ${isRTL ? 'right-4' : 'left-4'} bg-black/30 p-4 rounded-lg backdrop-blur-sm border border-green-500/30`}>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center w-48">
            <span className="text-sm opacity-70">{t('hudSpd')}</span>
            <span className="text-2xl font-bold">{Math.round(speed)} <span className="text-sm">{t('kts')}</span></span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${(speed / 800) * 100}%` }}></div>
          </div>
          
          <div className="flex justify-between items-center w-48 mt-2">
            <span className="text-sm opacity-70">{t('hudAlt')}</span>
            <span className="text-2xl font-bold">{Math.round(altitude)} <span className="text-sm">{t('ft')}</span></span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${Math.min((altitude / 5000) * 100, 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Bottom Right: Weapons */}
      <div className={`absolute bottom-4 ${isRTL ? 'left-4 text-left' : 'right-4 text-right'} bg-black/30 p-4 rounded-lg backdrop-blur-sm border border-green-500/30`}>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center w-48">
            <span className="text-sm opacity-70">{t('bullets')}</span>
            <span className="text-2xl font-bold">{bullets}</span>
          </div>
          <div className="flex justify-between items-center w-48">
            <span className="text-sm opacity-70">{t('homing')}</span>
            <span className="text-2xl font-bold text-red-400">{homingMissiles}</span>
          </div>
          <div className="flex justify-between items-center w-48">
            <span className="text-sm opacity-70">{t('ground')}</span>
            <span className="text-2xl font-bold text-yellow-400">{groundMissiles}</span>
          </div>
        </div>
      </div>

      {/* Center Bottom: Health */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-64">
        <div className="text-center mb-1 text-sm opacity-70">{t('hudHull')}</div>
        <div className="w-full h-3 bg-gray-800 rounded overflow-hidden border border-green-500/30">
          <div 
            className={`h-full transition-all duration-300 ${health > 50 ? 'bg-green-500' : health > 25 ? 'bg-yellow-500' : 'bg-red-500'}`} 
            style={{ width: `${health}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
