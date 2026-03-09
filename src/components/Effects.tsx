import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from '@react-three/postprocessing';
import { useGameStore, ParticleSystem } from '../store';

function Particle({ particle }: { particle: ParticleSystem }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const removeParticle = useGameStore(state => state.removeParticle);
  
  const count = particle.type === 'explosion' ? 100 : (particle.type === 'smoke' ? 30 : (particle.type === 'fire' ? 50 : 20));
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particlesData = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const isExplosion = particle.type === 'explosion';
      const isFire = particle.type === 'fire';
      const speed = isExplosion ? 100 : (isFire ? 40 : 20);
      return {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          (Math.random() - 0.5) * speed + (isExplosion ? 20 : (isFire ? 30 : 10)),
          (Math.random() - 0.5) * speed
        ),
        position: new THREE.Vector3(),
        scale: Math.random() * (isExplosion ? 4 : (isFire ? 3 : 2)) + 1,
        life: 1.0,
        rotationSpeed: (Math.random() - 0.5) * 10
      };
    });
  }, [count, particle.type]);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    
    const age = state.clock.elapsedTime - particle.createdAt;
    if (age > particle.duration) {
      removeParticle(particle.id);
      return;
    }

    particlesData.forEach((data, i) => {
      data.life -= delta / particle.duration;
      if (data.life > 0) {
        data.position.addScaledVector(data.velocity, delta);
        data.velocity.multiplyScalar(0.95);
        
        dummy.position.copy(data.position).add(particle.position);
        dummy.scale.setScalar(data.scale * data.life);
        dummy.rotation.z += data.rotationSpeed * delta;
        dummy.rotation.x += data.rotationSpeed * delta;
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
      }
    });
    
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  const color = particle.type === 'explosion' ? '#ff4400' : (particle.type === 'fire' ? '#ff8800' : (particle.type === 'smoke' ? '#444444' : '#aaaaaa'));

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={0.8} 
        emissive={color}
        emissiveIntensity={particle.type === 'explosion' ? 2 : 0}
      />
    </instancedMesh>
  );
}

export function Effects() {
  const particles = useGameStore(state => state.particles);
  const speed = useGameStore(state => state.speed);
  
  const speedFactor = Math.max(0, (speed - 400) / 600);
  const offset = new THREE.Vector2(0.002 * speedFactor, 0.002 * speedFactor);

  return (
    <>
      {particles.map(p => (
        <Particle key={p.id} particle={p} />
      ))}
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
        <Noise opacity={0.02} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <ChromaticAberration offset={offset} />
      </EffectComposer>
    </>
  );
}
