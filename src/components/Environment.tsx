import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { useGameStore } from '../store';
import { Water } from 'three-stdlib';

import { getTerrainHeight } from '../utils/terrain';

function Ocean() {
  const playerPos = useGameStore(state => state.playerPos);
  const ref = useRef<any>(null);
  const gl = useThree((state) => state.gl);
  
  const waterGeometry = useMemo(() => new THREE.PlaneGeometry(20000, 20000), []);
  
  const water = useMemo(() => {
    const waterNormals = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    });
    
    return new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(1000, 200, 1000).normalize(),
      sunColor: 0xffffff,
      waterColor: 0x004466,
      distortionScale: 3.7,
      fog: true
    });
  }, [gl, waterGeometry]);

  useFrame((state, delta) => {
    if (water.material) {
      water.material.uniforms['time'].value += delta;
    }
    if (ref.current) {
      ref.current.position.x = playerPos.x;
      ref.current.position.z = playerPos.z;
    }
  });

  return (
    <primitive ref={ref} object={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow />
  );
}

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(10000, 10000, 256, 256);
    geo.rotateX(-Math.PI / 2);
    
    const pos = geo.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial 
        color="#3d5c2e" 
        roughness={0.9} 
        metalness={0.05} 
      />
    </mesh>
  );
}

export function GameEnvironment() {
  const { scene } = useThree();
  const buildings = useGameStore(state => state.buildings);
  
  useEffect(() => {
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0002);
    return () => { scene.fog = null; };
  }, [scene]);

  return (
    <>
      <Sky sunPosition={[100, 20, 100]} inclination={0.3} azimuth={0.25} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 100]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
      
      <Clouds material={THREE.MeshStandardMaterial}>
        <Cloud seed={1} position={[-500, 1000, -500]} opacity={0.5} />
        <Cloud seed={2} position={[500, 1200, 500]} opacity={0.5} />
        <Cloud seed={3} position={[0, 1500, 0]} opacity={0.5} />
      </Clouds>
      
      <Ocean />
      <Terrain />
      
      {buildings.map(building => (
        <mesh key={building.id} position={building.position} castShadow receiveShadow>
          <boxGeometry args={[50, 100, 50]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
      ))}
    </>
  );
}
