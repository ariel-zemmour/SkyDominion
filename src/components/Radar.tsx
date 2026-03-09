import React from 'react';
import { useGameStore } from '../store';

export function Radar() {
  const playerPos = useGameStore(state => state.playerPos);
  const enemies = useGameStore(state => state.enemies);
  const projectiles = useGameStore(state => state.projectiles);

  return (
    <div className="absolute top-4 left-4 w-48 h-48 border border-green-500/50 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      {/* Radar grid */}
      <div className="absolute w-full h-[1px] bg-green-500/30"></div>
      <div className="absolute h-full w-[1px] bg-green-500/30"></div>
      
      {/* Player (center) */}
      <div className="absolute w-2 h-2 bg-white rounded-full"></div>
      
      {/* Enemies */}
      {enemies.map(enemy => {
        const dx = (enemy.position.x - playerPos.x) / 50;
        const dz = (enemy.position.z - playerPos.z) / 50;
        if (Math.abs(dx) < 96 && Math.abs(dz) < 96) {
          return <div key={enemy.id} className="absolute w-2 h-2 bg-red-500 rounded-full" style={{ left: `${50 + dx}%`, top: `${50 + dz}%` }}></div>;
        }
        return null;
      })}
      
      {/* Missiles */}
      {projectiles.filter(p => p.type === 'missile').map(proj => {
        const dx = (proj.position.x - playerPos.x) / 50;
        const dz = (proj.position.z - playerPos.z) / 50;
        if (Math.abs(dx) < 96 && Math.abs(dz) < 96) {
          return <div key={proj.id} className="absolute w-1 h-1 bg-yellow-500 rounded-full" style={{ left: `${50 + dx}%`, top: `${50 + dz}%` }}></div>;
        }
        return null;
      })}
    </div>
  );
}
