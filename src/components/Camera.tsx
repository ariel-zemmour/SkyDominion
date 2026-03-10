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

    // ─── Ejected pilot camera ───
    if (isEjected) {
      const store = useGameStore.getState();
      
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, store.isOnGround ? 70 : 60, delta * 3);
        camera.updateProjectionMatrix();
      }

      if (store.isOnGround) {
        // First-person ground view
        const yaw = store.pilotYaw;
        const pitch = store.pilotPitch;

        // Camera at eye level
        const eyePos = pilotPos.clone().add(new THREE.Vector3(0, 0.2, 0));
        camera.position.lerp(eyePos, delta * 15);

        // Look direction from yaw and pitch
        const lookDir = new THREE.Vector3(
          -Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          -Math.cos(yaw) * Math.cos(pitch)
        );
        const lookTarget = camera.position.clone().add(lookDir.multiplyScalar(10));
        camera.lookAt(lookTarget);
      } else {
        // Parachute descent — 3rd person behind pilot
        const offset = new THREE.Vector3(0, 5, 15);
        const targetCamPos = pilotPos.clone().add(offset);
        camera.position.lerp(targetCamPos, delta * 3);
        camera.lookAt(pilotPos.clone().add(new THREE.Vector3(0, 2, 0)));
      }
      return;
    }

    // ─── Jet camera modes ───
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
  });

  return null;
}
