import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);
  const islandMask = Math.max(0, 1 - distFromCenter / 4000);
  
  let y = noise2D(x * 0.0005, z * 0.0005) * 600;
  y += noise2D(x * 0.002, z * 0.002) * 150;
  y += noise2D(x * 0.01, z * 0.01) * 20;
  
  y *= islandMask;
  if (y < 0) y = -10;
  
  return y;
}
