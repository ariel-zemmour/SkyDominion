import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

interface F16ModelProps {
  afterburnerGlowRef: React.RefObject<THREE.Mesh | null>;
  isAfterburner: boolean;
}

export function F16Model({ afterburnerGlowRef, isAfterburner }: F16ModelProps) {
  const modelUrl = `${import.meta.env.BASE_URL}models/f-16.glb`;
  const { scene } = useGLTF(modelUrl);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.envMapIntensity = 1.0;
        }
      }
    });
    return clone;
  }, [scene]);

  return (
    <group>
      {/* ── Official High-Fidelity F-16 Fighting Falcon 3D Asset ── */}
      {/* 
        In f-16.glb:
        - Model is scaled 10x real-world (length ~150.92 units, wingspan ~93.94 units)
        - Forward is +X, Up is +Y, Wings along Z
        To align with SkyDominion coordinate system (Forward is -Z, Up is +Y, Wings along X)
        and fit 4x group scale (Length ~3.76 units = 15.04 meters):
        - Rotate by +Math.PI/2 around Y
        - Scale by 0.025 (150.92 * 0.025 = 3.77 units)
        - Center along X by -20, and Y by -5
      */}
      <group rotation={[0, Math.PI / 2, 0]} scale={0.025}>
        <primitive object={clonedScene} position={[-20, -5, 0]} />
      </group>

      {/* ── Engine Afterburner Exhaust Effects ── */}
      <group position={[0, -0.05, 1.70]}>
        {/* Inner Ceramic Flame Ring */}
        <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.16, 24]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#ea580c"
            emissiveIntensity={isAfterburner ? 1.0 : 0.3}
          />
        </mesh>

        {/* Dynamic Core Flame with Shock Diamonds */}
        <mesh ref={afterburnerGlowRef} position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.16, 0.60, 16]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={isAfterburner ? 0.9 : 0.35}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {isAfterburner && (
          <mesh position={[0, 0, 0.65]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.12, 0.95, 16]} />
            <meshBasicMaterial
              color="#fb923c"
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

// Preload the GLB model
useGLTF.preload(`${import.meta.env.BASE_URL}models/f-16.glb`);
