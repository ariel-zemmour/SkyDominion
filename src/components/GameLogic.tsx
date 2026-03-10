import React, { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { audioSynth } from '../audio';
import { useKeyboardControls } from '@react-three/drei';
import { getTerrainHeight } from '../utils/terrain';

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

  // Pilot physics after ejection - parachute descent only (ground movement is in GroundCombat)
  // This is handled by GroundCombat.tsx now, but we keep soldier spawning here
  const soldierSpawnDone = React.useRef(false);

  useEffect(() => {
    if (!isEjected) {
      soldierSpawnDone.current = false;
    }
  }, [isEjected]);

  useFrame((state) => {
    if (!isEjected) return;

    const store = useGameStore.getState();

    // Spawn soldiers when pilot lands
    if (store.isOnGround && !soldierSpawnDone.current) {
      soldierSpawnDone.current = true;
      const pilotLandPos = store.pilotPos;

      // Spawn 8-12 soldiers around landing position
      const soldierCount = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < soldierCount; i++) {
        const angle = (i / soldierCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const dist = 30 + Math.random() * 70;
        const sx = pilotLandPos.x + Math.cos(angle) * dist;
        const sz = pilotLandPos.z + Math.sin(angle) * dist;
        const sy = getTerrainHeight(sx, sz);

        store.spawnSoldier({
          position: new THREE.Vector3(sx, sy, sz),
          health: 100,
          state: 'idle',
          velocity: new THREE.Vector3(),
          targetPos: new THREE.Vector3(sx, sy, sz),
          lastFired: 0,
          lastStateChange: state.clock.elapsedTime + Math.random() * 2,
          deathTime: 0,
        });
      }
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

    // Check projectiles vs enemies (air combat)
    projectiles.forEach(proj => {
      if (proj.owner === 'player') {
        // Check vs air enemies
        enemies.forEach(enemy => {
          const dist = proj.position.distanceTo(enemy.position);
          if (dist < 20) { // Hit radius
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
            
            if (currentEnemies + 1 >= 5 && !useGameStore.getState().mission.completed) {
                useGameStore.getState().setMission({ completed: true });
                useGameStore.getState().advanceCareer();
            }
            saveProgress();
          }
        });

        // Check vs ground soldiers
        const storeNow = useGameStore.getState();
        storeNow.soldiers.forEach(soldier => {
          if (soldier.state === 'dead') return;
          const dist = proj.position.distanceTo(soldier.position.clone().add(new THREE.Vector3(0, 1, 0)));
          if (dist < 3) { // Smaller hit radius for soldiers
            removeProjectile(proj.id);
            const newHealth = soldier.health - 50;
            if (newHealth <= 0) {
              // Soldier killed
              audioSynth.playSoldierHit();
              spawnParticle({
                position: soldier.position.clone().add(new THREE.Vector3(0, 1, 0)),
                type: 'explosion',
                createdAt: state.clock.elapsedTime,
                duration: 0.5
              });
              storeNow.updateSoldier(soldier.id, { state: 'dead', health: 0, deathTime: state.clock.elapsedTime });
              const curTrophies = storeNow.trophies;
              const curHits = storeNow.shotsHit;
              const curSoldiers = storeNow.soldiersDestroyed;
              storeNow.addXP(50);
              setPlayerStats({
                score: score + 150,
                trophies: curTrophies + 150,
                shotsHit: curHits + 1,
                soldiersDestroyed: curSoldiers + 1,
              });
              saveProgress();
            } else {
              // Soldier wounded
              audioSynth.playSoldierHit();
              storeNow.updateSoldier(soldier.id, { health: newHealth, state: 'combat', lastStateChange: state.clock.elapsedTime });
            }
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
        // Check vs player jet (only if not ejected)
        if (!isEjected) {
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
        // Check vs ejected pilot
        if (isEjected) {
          const pilotP = useGameStore.getState().pilotPos;
          const dist = proj.position.distanceTo(pilotP);
          if (dist < 3) {
            removeProjectile(proj.id);
            const newHealth = health - 15;
            setPlayerStats({ health: newHealth });
            if (newHealth <= 0) {
              setGameState('gameover');
            }
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
