import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store';
import { getTranslation } from '../i18n';

export function MissionSystem() {
  const gameState = useGameStore(state => state.gameState);
  const enemies = useGameStore(state => state.enemies);
  const mission = useGameStore(state => state.mission);
  const setMission = useGameStore(state => state.setMission);
  const setGameState = useGameStore(state => state.setGameState);
  const language = useGameStore(state => state.language);
  const [hasSpawned, setHasSpawned] = useState(false);

  const t = (key: any) => getTranslation(language, key);

  useEffect(() => {
    if (gameState !== 'playing') {
        setHasSpawned(false);
        return;
    }
    
    if (enemies.length > 0) {
        setHasSpawned(true);
    }
    
    if (hasSpawned && enemies.length === 0 && !mission.completed) {
      setMission({ objective: t('missionComplete'), completed: true });
      const timeout = setTimeout(() => {
        // Only go to menu if the mission is still marked as completed
        // (i.e., we haven't restarted the game)
        const currentState = useGameStore.getState();
        if (currentState.mission.completed && currentState.gameState === 'playing') {
          setGameState('menu');
          // Reset mission state for next time
          setMission({ objective: t('browserSimulator'), completed: false });
          setHasSpawned(false);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [gameState, enemies, mission, setMission, setGameState, hasSpawned, language]);

  if (gameState !== 'playing') return null;

  if (mission.completed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-6xl font-bold text-green-500 animate-pulse">{t('missionComplete')}</div>
      </div>
    );
  }

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/50 p-4 rounded-lg border border-green-500/30 text-green-500 font-mono text-xl">
      {mission.objective}
    </div>
  );
}
