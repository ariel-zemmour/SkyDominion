import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Clouds, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { Water } from 'three-stdlib';
import { Float, Sparkles, PerspectiveCamera } from '@react-three/drei';

import { getTerrainHeight } from '../utils/terrain';

function Carrier() {
  return (
    <group position={[5000, -2, 5000]} rotation={[0, -Math.PI / 4, 0]}>
      {/* Hull */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[200, 30, 800]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Flight Deck */}
      <mesh position={[0, 16, 0]} receiveShadow>
        <boxGeometry args={[180, 2, 750]} />
        <meshStandardMaterial color="#222" />
        {/* Runway Paint */}
        <mesh position={[0, 1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 700]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh position={[40, 1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 700]} />
          <meshBasicMaterial color="yellow" opacity={0.5} transparent />
        </mesh>
        <mesh position={[-40, 1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 700]} />
          <meshBasicMaterial color="yellow" opacity={0.5} transparent />
        </mesh>
      </mesh>
      {/* Island / Tower */}
      <mesh position={[70, 40, 50]} castShadow>
        <boxGeometry args={[40, 50, 100]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* Landing Lights */}
      {[...Array(10)].map((_, i) => (
        <React.Fragment key={i}>
          <pointLight position={[85, 18, -350 + i * 80]} intensity={100} color="red" />
          <pointLight position={[-85, 18, -350 + i * 80]} intensity={100} color="green" />
        </React.Fragment>
      ))}
    </group>
  );
}

function Tanker() {
  return (
    <group position={[0, 5000, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[10, 10, 50, 8]} />
            <meshStandardMaterial color="gray" />
        </mesh>
        <mesh position={[0, 0, 20]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[5, 15, 8]} />
            <meshStandardMaterial color="red" />
        </mesh>
        <pointLight intensity={1000} color="white" />
    </group>
  );
}

function WeatherEffects() {
  const weather = useGameStore(state => state.weather);
  const playerPos = useGameStore(state => state.playerPos);
  const rainRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (rainRef.current) {
        rainRef.current.position.set(playerPos.x, playerPos.y + 100, playerPos.z);
    }
  });

  if (weather.type === 'clear') return null;

  return (
    <group>
      {(weather.type === 'rain' || weather.type === 'storm') && (
        <group position={[playerPos.x, playerPos.y + 100, playerPos.z]}>
           <Sparkles 
             count={2000} 
             scale={[200, 100, 200]} 
             size={2} 
             speed={5} 
             opacity={weather.type === 'storm' ? 0.8 : 0.4} 
             color="#88ccff" 
           />
        </group>
      )}
      {weather.type === 'storm' && (
        <StormLightning />
      )}
    </group>
  );
}

function StormLightning() {
  const [active, setActive] = React.useState(false);
  
  useFrame((state) => {
    if (Math.random() > 0.995 && !active) {
      setActive(true);
      setTimeout(() => setActive(false), 100 + Math.random() * 200);
    }
  });

  return active ? <directionalLight intensity={10} color="#fff" /> : null;
}

function EjectedPilot() {
  const isEjected = useGameStore(state => state.isEjected);
  const pilotPos = useGameStore(state => state.pilotPos);
  
  if (!isEjected) return null;

  return (
    <group position={pilotPos as any}>
      {/* Ejection Seat */}
      <mesh position={[0, -0.4, 0]} castShadow>
        <boxGeometry args={[0.8, 1.0, 0.7]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Pilot Model */}
      <mesh castShadow position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      {/* Parachute strings */}
      {[...Array(4)].map((_, i) => (
          <mesh key={i} position={[0, 2.5, 0]} rotation={[0.5, (i * Math.PI) / 2, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 3]} />
              <meshBasicMaterial color="gray" />
          </mesh>
      ))}
      {/* Parachute */}
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="white" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Ocean() {
  const playerPos = useGameStore(state => state.playerPos);
  const ref = useRef<any>(null);
  const gl = useThree((state) => state.gl);
  
  const waterGeometry = useMemo(() => new THREE.PlaneGeometry(40000, 40000), []);
  
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
    const geo = new THREE.PlaneGeometry(20000, 20000, 256, 256); // 20km terrain
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
  
  const weather = useGameStore(state => state.weather);
  
  useEffect(() => {
    let fogColor = 0x87ceeb; // Basic sky blue
    let fogDensity = 0.0002;

    if (weather.type === 'rain') {
        fogColor = 0x4a5a6a;
        fogDensity = 0.0008;
    } else if (weather.type === 'storm') {
        fogColor = 0x1a2a3a;
        fogDensity = 0.0015;
    } else if (weather.type === 'fog') {
        fogColor = 0xcccccc;
        fogDensity = 0.0025;
    }

    scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    return () => { scene.fog = null; };
  }, [scene, weather.type]);

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
      <Carrier />
      <Tanker />
      <WeatherEffects />
      <EjectedPilot />
      
      {/* City 1 Cluster */}
      {buildings.map(building => (
        <mesh key={building.id} position={building.position} castShadow receiveShadow>
          <boxGeometry args={[50, 100, 50]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
      ))}

      {/* Additional City Clusters */}
      {[...Array(3)].map((_, cityIdx) => {
          const cityPos = new THREE.Vector3((cityIdx + 1) * 3000, 0, (cityIdx + 1) * -2000);
          cityPos.y = getTerrainHeight(cityPos.x, cityPos.z);
          return (
              <group key={cityIdx} position={cityPos as any}>
                  {[...Array(10)].map((__, buildingIdx) => {
                      const bPos = new THREE.Vector3((Math.random() - 0.5) * 500, 50, (Math.random() - 0.5) * 500);
                      return (
                          <mesh key={buildingIdx} position={bPos} castShadow receiveShadow>
                              <boxGeometry args={[40 + Math.random() * 20, 80 + Math.random() * 60, 40 + Math.random() * 20]} />
                              <meshStandardMaterial color="#444455" />
                          </mesh>
                      );
                  })}
              </group>
          )
      })}
    </>
  );
}
