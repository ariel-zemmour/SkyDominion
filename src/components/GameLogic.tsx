import React, { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { audioSynth } from '../audio';
import { useKeyboardControls } from '@react-three/drei';

export function GameLogic() {
  const gameState = useGameStore(state => state.gameState);
  const setGameState = useGameStore(state => state.setGameState);
  const playerPos = useGameStore(state => state.playerPos);
  const enemies = useGameStore(state => state.enemies);
  const spawnEnemy = useGameStore(state => state.spawnEnemy);
  const removeEnemy = useGameStore(state => state.removeEnemy);
  const projectiles = useGameStore(state => state.projectiles);
  const removeProjectile = useGameStore(state => state.removeProjectile);
  const spawnParticle = useGameStore(state => state.spawnParticle);
  const setPlayerStats = useGameStore(state => state.setPlayerStats);
  const health = useGameStore(state => state.health);
  const score = useGameStore(state => state.score);
  const trophies = useGameStore(state => state.trophies);
  const saveProgress = useGameStore(state => state.saveProgress);

  const setLockedTargetId = useGameStore(state => state.setLockedTargetId);
  const lockedTargetId = useGameStore(state => state.lockedTargetId);
  const buildings = useGameStore(state => state.buildings);
  const playerRot = useGameStore(state => state.playerRot);
  const fireProjectile = useGameStore(state => state.fireProjectile);
  const isEjected = useGameStore(state => state.isEjected);
  const pilotPos = useGameStore(state => state.pilotPos);

  const [, getKeys] = useKeyboardControls();
  const lastWeatherChange = React.useRef(0);
  const lastSurvivalReward = React.useRef(0);
  const lastLockSound = React.useRef(0);
  const lastWarningSound = React.useRef(0);
  const lockKeyWasDown = React.useRef(false);

  // Survival rewards logic
  useEffect(() => {
    if (gameState === 'playing') {
      lastSurvivalReward.current = Date.now();
    }
  }, [gameState]);

  useFrame(() => {
    if (gameState !== 'playing') return;

    const now = Date.now();
    if (now - lastSurvivalReward.current >= 10000) {
      lastSurvivalReward.current = now;
      const currentTrophies = useGameStore.getState().trophies;
      setPlayerStats({ trophies: currentTrophies + 50 });
      saveProgress();
    }

    // Weather change
    if (now - lastWeatherChange.current >= 30000) {
      lastWeatherChange.current = now;
      const weatherTypes = ['clear', 'rain', 'storm', 'fog'] as const;
      const type = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      useGameStore.getState().setWeather({ type, intensity: 0.5 });
    }
  });

  // Landing detection on carrier
  useFrame((state, delta) => {
    if (gameState !== 'playing' || isEjected) return;
    
    const carrierPos = new THREE.Vector3(5000, 16, 5000);
    const dist = playerPos.distanceTo(carrierPos);
    
    if (dist < 400) { // Near carrier
        const speed = useGameStore.getState().speed;
        const altitude = useGameStore.getState().altitude;
        
        // Relative position on deck
        const relPos = playerPos.clone().sub(carrierPos);
        
        // Check if on runway (very approximate)
        if (relPos.y > -2 && relPos.y < 5 && Math.abs(relPos.x) < 40 && Math.abs(relPos.z) < 350) {
            if (speed < 200 && Math.abs(useGameStore.getState().playerVelocity.y) < 10) {
                // SUCCESSFUL LANDING!
                const currentTrophies = useGameStore.getState().trophies;
                setPlayerStats({ 
                  trophies: currentTrophies + 5000,
                  score: score + 10000 
                });
                useGameStore.getState().setMission({ completed: true, objective: 'CARRIER LANDING SUCCESSFUL!' });
            }
        }
    }
  });

  // Pilot physics after ejection
  useFrame((state, delta) => {
    if (!isEjected) return;

    const newPilotPos = pilotPos.clone();
    newPilotPos.y -= 10 * delta; // Fall speed
    
    // Slow drift
    const winds = new THREE.Vector3(2 * Math.sin(state.clock.elapsedTime * 0.5), 0, 2 * Math.cos(state.clock.elapsedTime * 0.5));
    newPilotPos.addScaledVector(winds, delta);
    
    useGameStore.setState({ pilotPos: newPilotPos });
    
    if (newPilotPos.y < 2) {
        // Mission ends when pilot lands
        useGameStore.getState().setMission({ completed: true, objective: 'MISSION ENDED: PILOT EJECTED' });
    }
  });

  // Spawning logic
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    // Initialize buildings
    if (buildings.length === 0) {
      const newBuildings = [];
      for (let i = 0; i < 50; i++) {
        newBuildings.push({
          id: Math.random().toString(36).substring(7),
          position: new THREE.Vector3((Math.random() - 0.5) * 5000, 50, (Math.random() - 0.5) * 5000),
          health: 100
        });
      }
      useGameStore.setState({ buildings: newBuildings });
    }

    const interval = setInterval(() => {
      if (enemies.length < 5) {
        // Spawn enemy around player
        const angle = Math.random() * Math.PI * 2;
        const distance = 2000 + Math.random() * 2000;
        const x = playerPos.x + Math.cos(angle) * distance;
        const z = playerPos.z + Math.sin(angle) * distance;
        const y = playerPos.y + (Math.random() - 0.5) * 1000;

        spawnEnemy({
          position: new THREE.Vector3(x, y, z),
          rotation: new THREE.Quaternion(),
          velocity: new THREE.Vector3(),
          health: 100,
          type: 'fighter',
          lastFired: 0
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [gameState, enemies.length, playerPos, spawnEnemy]);

  // Collision logic
  useFrame((state) => {
    if (gameState !== 'playing') return;

    // Target locking logic (triggered by key)
    const keys = getKeys();
    const isLockKeyDown = keys.lock;
    
    let bestPotentialTarget = null;
    let bestAngle = Math.PI / 8; // Max lock angle (22.5 degrees)

    const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerRot);

    enemies.forEach(enemy => {
      const directionToEnemy = new THREE.Vector3().subVectors(enemy.position, playerPos).normalize();
      const angle = playerForward.angleTo(directionToEnemy);
      const dist = playerPos.distanceTo(enemy.position);

      if (angle < bestAngle && dist < 10000) {
        bestAngle = angle;
        bestPotentialTarget = enemy.id;
      }
    });

    // Handle manual locking
    if (isLockKeyDown && !lockKeyWasDown.current) {
        if (bestPotentialTarget) {
            setLockedTargetId(bestPotentialTarget);
            audioSynth.playLocked();
        } else {
            setLockedTargetId(null);
        }
    }
    
    // Play lock-on tone if aiming at a potential target but not locked yet
    if (bestPotentialTarget && bestPotentialTarget !== lockedTargetId) {
        if (state.clock.elapsedTime - lastLockSound.current > 0.4) {
            audioSynth.playLockOn();
            lastLockSound.current = state.clock.elapsedTime;
        }
    }

    lockKeyWasDown.current = isLockKeyDown;

    // Enemy AI: Look for targets and fire missiles
    enemies.forEach(enemy => {
        const dist = enemy.position.distanceTo(playerPos);
        if (dist < 3000 && state.clock.elapsedTime - (enemy as any).lastFired > 8) {
             const directionToPlayer = new THREE.Vector3().subVectors(playerPos, enemy.position).normalize();
             const enemyForward = new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.rotation);
             const angle = enemyForward.angleTo(directionToPlayer);
             
             if (angle < Math.PI / 4) { // Enemy can fire if player is in a 45 degree cone
                 (enemy as any).lastFired = state.clock.elapsedTime;
                 fireProjectile({
                     position: enemy.position.clone().add(directionToPlayer.clone().multiplyScalar(10)),
                     velocity: directionToPlayer.clone().multiplyScalar(1000),
                     type: 'missile',
                     owner: 'enemy',
                     createdAt: state.clock.elapsedTime
                 });
             }
        }
    });

    // Missile Warning System
    const incomingMissile = projectiles.find(p => p.owner === 'enemy' && p.type === 'missile' && p.position.distanceTo(playerPos) < 2000);
    if (incomingMissile) {
        if (state.clock.elapsedTime - lastWarningSound.current > 0.6) {
            audioSynth.playWarning();
            lastWarningSound.current = state.clock.elapsedTime;
        }
    }

    // Check projectiles vs enemies
    projectiles.forEach(proj => {
      if (proj.owner === 'player') {
        enemies.forEach(enemy => {
          const dist = proj.position.distanceTo(enemy.position);
          if (dist < 20) { // Hit radius
            // Hit!
            removeProjectile(proj.id);
            audioSynth.playExplosion();
            spawnParticle({
              position: enemy.position.clone(),
              type: 'explosion',
              createdAt: state.clock.elapsedTime,
              duration: 2
            });
            spawnParticle({
              position: enemy.position.clone(),
              type: 'fire',
              createdAt: state.clock.elapsedTime,
              duration: 3
            });
            spawnParticle({
              position: enemy.position.clone(),
              type: 'smoke',
              createdAt: state.clock.elapsedTime,
              duration: 4
            });
            removeEnemy(enemy.id);
            const currentTrophies = useGameStore.getState().trophies;
            const currentHits = useGameStore.getState().shotsHit;
            const currentEnemies = useGameStore.getState().enemiesDestroyed;
            useGameStore.getState().addXP(100);
            setPlayerStats({ 
              score: score + 100,
              trophies: currentTrophies + 100,
              shotsHit: currentHits + 1,
              enemiesDestroyed: currentEnemies + 1
            });
            
            // Check for mission completion (simple version: destroy 5 enemies)
            if (currentEnemies + 1 >= 5 && !useGameStore.getState().mission.completed) {
                useGameStore.getState().setMission({ completed: true });
                useGameStore.getState().advanceCareer();
            }
            saveProgress();
          }
        });
        
        // Check building collision
        if (proj.type === 'ground-missile' || proj.type === 'missile' || proj.type === 'bullet') {
          buildings.forEach(building => {
            const dist = proj.position.distanceTo(building.position);
            if (dist < 50) {
              removeProjectile(proj.id);
              audioSynth.playExplosion();
              spawnParticle({
                position: building.position.clone(),
                type: 'explosion',
                createdAt: state.clock.elapsedTime,
                duration: 2
              });
              useGameStore.getState().destroyBuilding(building.id);
              const currentHits = useGameStore.getState().shotsHit;
              const currentBuildings = useGameStore.getState().buildingsDestroyed;
              useGameStore.getState().addXP(50);
              setPlayerStats({ 
                score: score + 50, 
                trophies: useGameStore.getState().trophies + 1,
                shotsHit: currentHits + 1,
                buildingsDestroyed: currentBuildings + 1
              });
            }
          });
        }
      } else if (proj.owner === 'enemy') {
        const dist = proj.position.distanceTo(playerPos);
        if (dist < 40) {
          removeProjectile(proj.id);
          audioSynth.playExplosion();
          const newHealth = health - 20;
          setPlayerStats({ health: newHealth });
          if (newHealth <= 0) {
            setGameState('gameover');
            audioSynth.stopEngine();
          }
        }
      }
    });

    // Check player vs ground
    if (playerPos.y < 0) {
      setGameState('gameover');
      audioSynth.stopEngine();
      audioSynth.playExplosion();
      spawnParticle({
        position: playerPos.clone(),
        type: 'explosion',
        createdAt: state.clock.elapsedTime,
        duration: 3
      });
      spawnParticle({
        position: playerPos.clone(),
        type: 'fire',
        createdAt: state.clock.elapsedTime,
        duration: 4
      });
      spawnParticle({
        position: playerPos.clone(),
        type: 'smoke',
        createdAt: state.clock.elapsedTime,
        duration: 5
      });
    }
  });

  return null;
}
