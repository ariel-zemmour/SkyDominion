import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';

export function CameraController() {
  const { camera } = useThree();
  const playerPos = useGameStore(state => state.playerPos);
  const playerRot = useGameStore(state => state.playerRot);
  const cameraMode = useGameStore(state => state.cameraMode);
  const gameState = useGameStore(state => state.gameState);
  const isEjected = useGameStore(state => state.isEjected);
  const pilotPos = useGameStore(state => state.pilotPos);
  
  const idealOffset = useRef(new THREE.Vector3());
  const idealLookAt = useRef(new THREE.Vector3());
  
  const speed = useGameStore(state => state.speed);
  
  useFrame((state, delta) => {
    if (gameState !== 'playing') return;

    // Dynamic FOV based on speed
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = 60 + (speed / 800) * 20;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 2);
      camera.updateProjectionMatrix();
    }

    if (cameraMode === 'third-person') {
      // Third person camera offset
      idealOffset.current.set(0, 5, 20);
      idealOffset.current.applyQuaternion(playerRot);
      idealOffset.current.add(playerPos);
      
      idealLookAt.current.set(0, 0, -20);
      idealLookAt.current.applyQuaternion(playerRot);
      idealLookAt.current.add(playerPos);
      
      const t = 1.0 - Math.pow(0.01, delta);
      camera.position.lerp(idealOffset.current, t);
      
      const currentLookAt = new THREE.Vector3();
      camera.getWorldDirection(currentLookAt);
      currentLookAt.add(camera.position);
      currentLookAt.lerp(idealLookAt.current, t);
      
      camera.lookAt(currentLookAt);
    } else {
      // Cockpit camera - align with pilot eye level
      idealOffset.current.set(0, 1.6, -1.8);
      idealOffset.current.applyQuaternion(playerRot);
      idealOffset.current.add(playerPos);
      
      camera.position.copy(idealOffset.current);
      
      idealLookAt.current.set(0, 0, -20);
      idealLookAt.current.applyQuaternion(playerRot);
      idealLookAt.current.add(playerPos);
      
      camera.lookAt(idealLookAt.current);
    }

    if (isEjected) {
       // Override camera to look at pilot
       const offset = new THREE.Vector3(0, 5, 20);
       camera.position.lerp(pilotPos.clone().add(offset), 0.1);
       camera.lookAt(pilotPos);
    }
  });

  return null;
}
