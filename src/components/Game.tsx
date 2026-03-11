import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Player } from './Player';
import { GameEnvironment } from './Environment';
import { CameraController } from './Camera';
import { Enemies } from './Enemies';
import { Weapons } from './Weapons';
import { Effects } from './Effects';
import { HUD } from './HUD';
import { Menu } from './Menu';
import { PauseMenu } from './PauseMenu';
import { MissionSystem } from './MissionSystem';
import { useGameStore } from '../store';

import { GameLogic } from './GameLogic';
import { RescueHelicopter } from './RescueHelicopter';

export function Game() {
  const gameState = useGameStore(state => state.gameState);
  const loadProgress = useGameStore(state => state.loadProgress);
  const volume = useGameStore(state => state.settings.volume);
  const keyMap = useGameStore(state => state.keyMap);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const keyboardMap = [
    { name: 'forward', keys: [keyMap.forward] },
    { name: 'backward', keys: [keyMap.backward] },
    { name: 'yawLeft', keys: [keyMap.yawLeft] },
    { name: 'yawRight', keys: [keyMap.yawRight] },
    { name: 'pitchUp', keys: [keyMap.pitchUp] },
    { name: 'pitchDown', keys: [keyMap.pitchDown] },
    { name: 'rollLeft', keys: [keyMap.rollLeft] },
    { name: 'rollRight', keys: [keyMap.rollRight] },
    { name: 'shift', keys: [keyMap.shift] },
    { name: 'fireBullets', keys: [keyMap.fireBullets] },
    { name: 'fireHoming', keys: [keyMap.fireHoming] },
    { name: 'fireGround', keys: [keyMap.fireGround] },
    { name: 'camera', keys: [keyMap.camera] },
    { name: 'eject', keys: [keyMap.eject] },
    { name: 'callRescue', keys: [keyMap.callRescue] },
  ];

  useEffect(() => {
    loadProgress();
    audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = volume;
    audioRef.current.play().catch(e => console.log("Audio play failed", e));
    return () => {
      audioRef.current?.pause();
    };
  }, [loadProgress]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <KeyboardControls map={keyboardMap}>
        <Canvas shadows camera={{ position: [0, 1005, 20], fov: 60, near: 1, far: 20000 }}>
          <Suspense fallback={null}>
            <GameEnvironment />
            <Player />
            <CameraController />
            <Enemies />
            <Weapons />
            <Effects />
            <GameLogic />
            <RescueHelicopter />
          </Suspense>
        </Canvas>
        <HUD />
        <Menu />
        <PauseMenu />
        <MissionSystem />
      </KeyboardControls>
    </div>
  );
}
