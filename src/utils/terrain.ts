import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);
  const islandMask = Math.max(0, 1 - distFromCenter / 10000); // 10km map
  
  let y = noise2D(x * 0.0002, z * 0.0002) * 2000; // Big mountain peaks
  y += noise2D(x * 0.0008, z * 0.0008) * 400;   // Medium hills
  y += noise2D(x * 0.003, z * 0.003) * 50;      // Detailed bumps
  y += noise2D(z * 0.012, x * 0.012) * 5;       // Micro terrain
  
  y *= islandMask;
  if (y < 0) y = -10;
  
  return y;
}
