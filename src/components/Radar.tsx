import React from 'react';
import { useGameStore } from '../store';
import * as THREE from 'three';

export function Radar() {
  const playerPos = useGameStore(state => state.playerPos);
  const playerRot = useGameStore(state => state.playerRot);
  const enemies = useGameStore(state => state.enemies);
  const projectiles = useGameStore(state => state.projectiles);

  // Get player rotation around Y axis (yaw)
  const euler = new THREE.Euler().setFromQuaternion(playerRot, 'YXZ');
  const yaw = euler.y;

  return (
    <div className="absolute top-4 left-4 w-48 h-48 border border-green-500/50 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Radar grid and sweep */}
      <div className="absolute w-full h-[1px] bg-green-500/30"></div>
      <div className="absolute h-full w-[1px] bg-green-500/30"></div>
      <div className="absolute w-full h-full rounded-full border border-green-500/10"></div>
      <div className="absolute w-2/3 h-2/3 rounded-full border border-green-500/10"></div>
      <div className="absolute w-1/3 h-1/3 rounded-full border border-green-500/10"></div>
      
      {/* Search Sweep */}
      <div 
        className="absolute w-full h-full rounded-full border-t border-green-400/50 animate-spin" 
        style={{ animationDuration: '3s', background: 'conic-gradient(from 0deg, transparent, rgba(34, 197, 94, 0.1) 90deg, transparent)' }}
      ></div>
      
      {/* Player (center) */}
      <div className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white] z-10"></div>
      
      {/* Relative scale: 5000 units max range mapped to radar radius */}
      <div className="absolute w-full h-full" style={{ transform: `rotate(${yaw}rad)` }}>
        {/* Enemies */}
        {enemies.map(enemy => {
          const dx = (enemy.position.x - playerPos.x) / 50;
          const dz = (enemy.position.z - playerPos.z) / 50;
          const distSq = dx * dx + dz * dz;
          
          if (distSq < 92 * 92) {
            return (
              <div 
                key={enemy.id} 
                className="absolute w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)]" 
                style={{ left: `${50 + dx}%`, top: `${50 + dz}%`, transform: 'translate(-50%, -50%)' }}
              ></div>
            );
          }
          return null;
        })}
        
        {/* Projectiles (Focus on incoming missiles) */}
        {projectiles.map(proj => {
          const dx = (proj.position.x - playerPos.x) / 50;
          const dz = (proj.position.z - playerPos.z) / 50;
          const distSq = dx * dx + dz * dz;
          
          if (distSq < 96 * 96) {
            const isEnemyMissile = proj.owner === 'enemy' && (proj.type === 'missile' || proj.type === 'ground-missile');
            return (
              <div 
                key={proj.id} 
                className={`absolute rounded-full ${isEnemyMissile ? 'w-2 h-2 bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,1)]' : 'w-1 h-1 bg-yellow-600/50'}`} 
                style={{ left: `${50 + dx}%`, top: `${50 + dz}%`, transform: 'translate(-50%, -50%)' }}
              ></div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
