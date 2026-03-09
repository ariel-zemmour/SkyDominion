import { create } from 'zustand';
import * as THREE from 'three';
import { Language } from './i18n';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export interface Enemy {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  velocity: THREE.Vector3;
  health: number;
  type: 'fighter' | 'tank' | 'radar';
  lastFired: number;
  targetId?: string;
}

export interface Building {
  id: string;
  position: THREE.Vector3;
  health: number;
}

export interface Jet {
  id: string;
  name: string;
  speed: number;
  weapons: number;
  armor: number;
  cost: number;
  color: string;
  wingSpan: number;
  length: number;
}

export interface Projectile {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  type: 'bullet' | 'missile' | 'ground-missile';
  owner: 'player' | 'enemy';
  targetId?: string; // For missiles
  createdAt: number;
}

export interface ParticleSystem {
  id: string;
  position: THREE.Vector3;
  type: 'explosion' | 'smoke' | 'fire';
  createdAt: number;
  duration: number;
}

export interface KeyMapping {
  forward: string;
  backward: string;
  yawLeft: string;
  yawRight: string;
  pitchUp: string;
  pitchDown: string;
  rollLeft: string;
  rollRight: string;
  shift: string;
  fireBullets: string;
  fireHoming: string;
  fireGround: string;
  camera: string;
}

const DEFAULT_KEY_MAP: KeyMapping = {
  forward: 'KeyW',
  backward: 'KeyS',
  yawLeft: 'KeyA',
  yawRight: 'KeyD',
  pitchUp: 'ArrowUp',
  pitchDown: 'ArrowDown',
  rollLeft: 'ArrowLeft',
  rollRight: 'ArrowRight',
  shift: 'ShiftLeft',
  fireBullets: 'MouseLeft',
  fireHoming: 'Space',
  fireGround: 'KeyG',
  camera: 'KeyC',
};

interface GameStore {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  
  // Mission
  mission: {
    objective: string;
    completed: boolean;
    completionPercentage: number;
  };
  setMission: (mission: Partial<{ objective: string; completed: boolean; completionPercentage: number }>) => void;
  
  // Player stats (for UI)
  health: number;
  speed: number;
  altitude: number;
  bullets: number;
  homingMissiles: number;
  groundMissiles: number;
  score: number;
  shotsFired: number;
  shotsHit: number;
  enemiesDestroyed: number;
  buildingsDestroyed: number;
  completionPercentage: number;
  
  setPlayerStats: (stats: Partial<GameStore>) => void;
  
  // High-frequency data (accessed via getState() in loop)
  playerPos: THREE.Vector3;
  playerRot: THREE.Quaternion;
  playerVelocity: THREE.Vector3;
  
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: ParticleSystem[];
  
  // Actions
  spawnEnemy: (enemy: Omit<Enemy, 'id'>) => void;
  removeEnemy: (id: string) => void;
  fireProjectile: (proj: Omit<Projectile, 'id'>) => void;
  removeProjectile: (id: string) => void;
  spawnParticle: (particle: Omit<ParticleSystem, 'id'>) => void;
  removeParticle: (id: string) => void;
  
  // Target lock
  lockedTargetId: string | null;
  setLockedTargetId: (id: string | null) => void;
  
  // Camera mode
  cameraMode: 'third-person' | 'cockpit';
  toggleCameraMode: () => void;
  
  // Language
  language: Language;
  setLanguage: (lang: Language) => void;
  
  // Settings
  settings: {
    volume: number;
  };
  setVolume: (volume: number) => void;
  
  // Buildings
  buildings: Building[];
  destroyBuilding: (id: string) => void;
  
  // Rewards & Upgrades
  trophies: number;
  purchasedJets: string[];
  activeJet: string;
  buyJet: (jetId: string) => void;
  setActiveJet: (jetId: string) => void;
  
  // Key Mapping
  keyMap: KeyMapping;
  setKeyMap: (keyMap: KeyMapping) => void;
  
  // Save/Load
  saveProgress: () => void;
  loadProgress: () => void;

  resetGame: () => void;
  togglePause: () => void;
  calculateCompletion: () => number;
}

const savedLanguage = (localStorage.getItem('language') as Language) || 'en';
const savedSettings = JSON.parse(localStorage.getItem('settings') || '{"volume": 0.5}');

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'menu',
  setGameState: (state) => set({ gameState: state }),
  
  mission: { objective: 'Destroy all enemy fighters', completed: false, completionPercentage: 0 },
  setMission: (mission) => set({ mission: { ...get().mission, ...mission } }),
  
  language: savedLanguage,
  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },
  
  settings: savedSettings,
  setVolume: (volume) => {
    const newSettings = { ...get().settings, volume };
    localStorage.setItem('settings', JSON.stringify(newSettings));
    set({ settings: newSettings });
  },
  
  buildings: [],
  destroyBuilding: (id) => set((state) => ({
    buildings: state.buildings.filter(b => b.id !== id)
  })),
  
  trophies: 0,
  purchasedJets: ['zero'],
  activeJet: 'zero',
  buyJet: (jetId) => {
    const jet = JETS.find(j => j.id === jetId);
    if (jet && get().trophies >= jet.cost) {
      set((state) => ({
        trophies: state.trophies - jet.cost,
        purchasedJets: [...state.purchasedJets, jetId]
      }));
      get().saveProgress();
    }
  },
  setActiveJet: (jetId) => {
    set({ activeJet: jetId });
    get().saveProgress();
  },
  
  keyMap: JSON.parse(localStorage.getItem('keyMap') || JSON.stringify(DEFAULT_KEY_MAP)),
  setKeyMap: (keyMap) => {
    localStorage.setItem('keyMap', JSON.stringify(keyMap));
    set({ keyMap });
  },
  
  saveProgress: () => {
    const state = get();
    localStorage.setItem('progress', JSON.stringify({
      score: state.score,
      mission: state.mission,
      trophies: state.trophies,
      purchasedJets: state.purchasedJets,
      activeJet: state.activeJet,
      keyMap: state.keyMap,
      bullets: state.bullets,
      homingMissiles: state.homingMissiles,
      groundMissiles: state.groundMissiles,
      lastCompletion: state.completionPercentage,
    }));
  },
  
  loadProgress: () => {
    const progress = JSON.parse(localStorage.getItem('progress') || '{}');
    if (progress.score !== undefined) {
      set({ 
        score: progress.score, 
        mission: progress.mission,
        trophies: progress.trophies || 0,
        purchasedJets: progress.purchasedJets || ['zero'],
        activeJet: progress.activeJet || 'zero',
        keyMap: progress.keyMap || DEFAULT_KEY_MAP,
        bullets: progress.bullets ?? 2000,
        homingMissiles: progress.homingMissiles ?? 20,
        groundMissiles: progress.groundMissiles ?? 10,
        completionPercentage: progress.lastCompletion ?? 0,
      });
    }
  },
  
  health: 100,
  speed: 0,
  altitude: 0,
  bullets: 2000,
  homingMissiles: 20,
  groundMissiles: 10,
  score: 0,
  shotsFired: 0,
  shotsHit: 0,
  enemiesDestroyed: 0,
  buildingsDestroyed: 0,
  completionPercentage: 0,
  
  setPlayerStats: (stats) => set((state) => ({ ...state, ...stats })),
  
  playerPos: new THREE.Vector3(0, 1000, 0),
  playerRot: new THREE.Quaternion(),
  playerVelocity: new THREE.Vector3(),
  
  enemies: [],
  projectiles: [],
  particles: [],
  
  spawnEnemy: (enemy) => set((state) => ({
    enemies: [...state.enemies, { ...enemy, id: Math.random().toString(36).substring(7) }]
  })),
  removeEnemy: (id) => set((state) => ({
    enemies: state.enemies.filter(e => e.id !== id)
  })),
  
  fireProjectile: (proj) => set((state) => ({
    projectiles: [...state.projectiles, { ...proj, id: Math.random().toString(36).substring(7) }]
  })),
  removeProjectile: (id) => set((state) => ({
    projectiles: state.projectiles.filter(p => p.id !== id)
  })),
  
  spawnParticle: (particle) => set((state) => ({
    particles: [...state.particles, { ...particle, id: Math.random().toString(36).substring(7) }]
  })),
  removeParticle: (id) => set((state) => ({
    particles: state.particles.filter(p => p.id !== id)
  })),
  
  lockedTargetId: null,
  setLockedTargetId: (id) => set({ lockedTargetId: id }),
  
  cameraMode: 'third-person',
  toggleCameraMode: () => set((state) => ({ cameraMode: state.cameraMode === 'third-person' ? 'cockpit' : 'third-person' })),
  
  resetGame: () => {
    const activeJetId = get().activeJet;
    const jet = JETS.find(j => j.id === activeJetId) || JETS[0];
    set({
      gameState: 'playing',
      health: jet.armor,
      speed: 300,
      altitude: 1000,
      bullets: 2000,
      homingMissiles: 20,
      groundMissiles: 10,
      score: 0,
      playerPos: new THREE.Vector3(0, 1000, 0),
      playerRot: new THREE.Quaternion(),
      playerVelocity: new THREE.Vector3(),
      enemies: [],
      projectiles: [],
      particles: [],
      buildings: [],
      lockedTargetId: null,
      mission: { objective: 'Destroy all enemy fighters', completed: false, completionPercentage: 0 },
      shotsFired: 0,
      shotsHit: 0,
      enemiesDestroyed: 0,
      buildingsDestroyed: 0,
    });
  },
  
  calculateCompletion: () => {
    const state = get();
    // Requirements: Objectives completed, Accuracy, Survival/Efficiency
    
    // Objectives: 5 enemies initially (hardcoded in GameLogic for now)
    const enemyScore = Math.min(state.enemiesDestroyed / 5, 1) * 60; // 60% weight
    
    // Accuracy:
    const accuracy = state.shotsFired > 0 ? (state.shotsHit / state.shotsFired) : 0;
    const accuracyScore = Math.min(accuracy * 2, 1) * 20; // 20% weight (assuming 50% accuracy is perfect)
    
    // Efficiency/Survival: Health remaining
    const healthScore = (state.health / 100) * 20; // 20% weight
    
    const percentage = Math.round(enemyScore + accuracyScore + healthScore);
    const finalPercentage = Math.max(1, Math.min(100, percentage));
    
    set(state => ({ 
      completionPercentage: finalPercentage,
      mission: { ...state.mission, completionPercentage: finalPercentage }
    }));
    
    return finalPercentage;
  },
  
  togglePause: () => set((state) => ({
    gameState: state.gameState === 'playing' ? 'paused' : (state.gameState === 'paused' ? 'playing' : state.gameState)
  }))
}));

export const JETS: Jet[] = [
  { id: 'zero', name: 'A6M Zero', speed: 680, weapons: 1.0, armor: 80, cost: 0, color: '#F5F5DC', wingSpan: 6.8, length: 5.3 },
  { id: 'spitfire', name: 'Supermarine Spitfire', speed: 720, weapons: 1.2, armor: 100, cost: 200, color: '#556B2F', wingSpan: 6.2, length: 5.1 },
  { id: 'mustang', name: 'P-51 Mustang', speed: 750, weapons: 1.4, armor: 110, cost: 500, color: '#BDB76B', wingSpan: 6.5, length: 5.2 },
  { id: 'thunderbolt', name: 'P-47 Thunderbolt', speed: 700, weapons: 2.5, armor: 250, cost: 1000, color: '#2F4F4F', wingSpan: 7.8, length: 5.5 },
  { id: 'phantom', name: 'F-4 Phantom', speed: 900, weapons: 1.8, armor: 140, cost: 1800, color: '#808080', wingSpan: 6, length: 6.5 },
  { id: 'basic', name: 'F-16 Falcon', speed: 950, weapons: 1.5, armor: 120, cost: 2500, color: '#A0A0A0', wingSpan: 6, length: 5 },
  { id: 'hornet', name: 'F-18 Hornet', speed: 1050, weapons: 2.1, armor: 130, cost: 3500, color: '#888888', wingSpan: 6.2, length: 6.2 },
  { id: 'gripen', name: 'Saab Gripen', speed: 1150, weapons: 2.2, armor: 115, cost: 4500, color: '#778899', wingSpan: 5.8, length: 5.8 },
  { id: 'stealth', name: 'F-35 Lightning', speed: 1100, weapons: 2.8, armor: 160, cost: 6000, color: '#303030', wingSpan: 6.5, length: 5.5 },
  { id: 'rafale', name: 'Dassault Rafale', speed: 1280, weapons: 2.6, armor: 145, cost: 7500, color: '#C0C0C0', wingSpan: 6.2, length: 6.2 },
  { id: 'tomcat', name: 'F-14 Tomcat', speed: 1100, weapons: 3.0, armor: 150, cost: 9000, color: '#909090', wingSpan: 7.5, length: 7 },
  { id: 'eagle', name: 'F-15 Eagle', speed: 1300, weapons: 3.2, armor: 155, cost: 11000, color: '#A5A5A5', wingSpan: 6.8, length: 6.8 },
  { id: 'viper', name: 'Su-27 Flanker', speed: 1250, weapons: 3.4, armor: 160, cost: 13000, color: '#4682B4', wingSpan: 7.2, length: 7.5 },
  { id: 'typhoon', name: 'Eurofighter', speed: 1350, weapons: 3.6, armor: 165, cost: 16000, color: '#D3D3D3', wingSpan: 6.4, length: 6.4 },
  { id: 'interceptor', name: 'MiG-31 Foxhound', speed: 1800, weapons: 2.5, armor: 180, cost: 20000, color: '#B0B0B0', wingSpan: 5.5, length: 7 },
  { id: 'bomber', name: 'A-10 Warthog', speed: 650, weapons: 5.0, armor: 400, cost: 25000, color: '#556B2F', wingSpan: 8, length: 6 },
  { id: 'advanced', name: 'F-22 Raptor', speed: 1500, weapons: 4.5, armor: 200, cost: 35000, color: '#707070', wingSpan: 7, length: 6 },
  { id: 'blackbird', name: 'SR-71 Blackbird', speed: 2200, weapons: 1.0, armor: 180, cost: 50000, color: '#1A1A1A', wingSpan: 5, length: 10 },
  { id: 'valkyrie', name: 'XB-70 Valkyrie', speed: 2000, weapons: 2.5, armor: 300, cost: 75000, color: '#FFFFFF', wingSpan: 9, length: 12 },
  { id: 'prototype', name: 'X-02 Wyvern', speed: 1800, weapons: 6.0, armor: 250, cost: 100000, color: '#FF4500', wingSpan: 7.5, length: 8 },
];
