// ============================================
// generation.js — Procedural Generation, Biomes, Dungeons
// ============================================
import { createNoise2D, createNoise3D, fbm2D, fbm3D, ridgeFbm2D, seededRandom, hashSeed } from './noise.js';
import { BLOCKS } from './textures.js';

import { CHUNK_SIZE, CHUNK_HEIGHT } from './engine.js';

// Planet configurations
const BIOMES = {
    FOREST: { name: 'Forest', surface: BLOCKS.GRASS, dirt: BLOCKS.DIRT, freq: 1.0, hasTrees: true },
    PLAINS: { name: 'Plains', surface: BLOCKS.GRASS, dirt: BLOCKS.DIRT, freq: 1.0, hasTrees: false },
    DESERT: { name: 'Desert', surface: BLOCKS.SAND, dirt: BLOCKS.SAND, freq: 0.5, hasTrees: false, hasDeadBush: true, hasCactus: true },
    BADLANDS: { name: 'Badlands', surface: BLOCKS.RED_SAND, dirt: BLOCKS.TERRACOTTA, freq: 0.5, hasTrees: false, hasDeadBush: true },
    TUNDRA: { name: 'Tundra', surface: BLOCKS.SNOW, dirt: BLOCKS.DIRT, freq: 0.8, hasTrees: true },
    ICE_SPIKES: { name: 'Ice Spikes', surface: BLOCKS.SNOW, dirt: BLOCKS.ICE, freq: 0.3, hasTrees: false, hasIceSpikes: true },
    MUSHROOM: { name: 'Mushroom', surface: BLOCKS.DIRT, dirt: BLOCKS.DIRT, freq: 0.2, hasTrees: false, hasMushrooms: true },
    CRYSTAL: { name: 'Crystal', surface: BLOCKS.ALIEN_STONE, dirt: BLOCKS.STONE, freq: 0.1, hasTrees: false, hasCrystals: true },
    ALIEN: { name: 'Alien', surface: BLOCKS.ALIEN_STONE, dirt: BLOCKS.ALIEN_STONE, freq: 1.0, hasTrees: true, alienFlora: true },
    VOLCANIC: { name: 'Volcanic', surface: BLOCKS.OBSIDIAN, dirt: BLOCKS.STONE, freq: 0.5, hasTrees: false },
    SWAMP: { name: 'Swamp', surface: BLOCKS.SWAMP_GRASS, dirt: BLOCKS.MUD, freq: 0.6, hasTrees: true, swampFlora: true },
    JUNGLE: { name: 'Jungle', surface: BLOCKS.GRASS, dirt: BLOCKS.DIRT, freq: 0.7, hasTrees: true, jungleFlora: true },
    SAVANNA: { name: 'Savanna', surface: BLOCKS.SAVANNA_GRASS, dirt: BLOCKS.DIRT, freq: 0.8, hasTrees: true, savannaFlora: true },
    MOUNTAINS: { name: 'Mountains', surface: BLOCKS.SNOW, dirt: BLOCKS.STONE, freq: 0.4, hasTrees: true },
    DEEP_OCEAN: { name: 'Deep Ocean', surface: BLOCKS.SAND, dirt: BLOCKS.STONE, freq: 0.3, hasTrees: false },
    CHERRY_GROVE: { name: 'Cherry Grove', surface: BLOCKS.GRASS, dirt: BLOCKS.DIRT, freq: 0.7, hasTrees: true, isCherry: true },
    AUTUMN_FOREST: { name: 'Autumn Forest', surface: BLOCKS.GRASS, dirt: BLOCKS.DIRT, freq: 0.7, hasTrees: true, isAutumn: true },
    GLOW_FOREST: { name: 'Glow Forest', surface: BLOCKS.ALIEN_GRASS, dirt: BLOCKS.ALIEN_STONE, freq: 0.5, hasTrees: true, isGlow: true },
    OASIS: { name: 'Oasis', surface: BLOCKS.SAND, dirt: BLOCKS.SAND, freq: 0.2, hasTrees: true, isOasis: true }
};

export class PlanetParams {
    constructor(seed) {
        this.seed = typeof seed === 'string' ? hashSeed(seed) : seed;
        const rng = seededRandom(this.seed);
        
        // Generate name
        const prefix = ['Zor', 'Gla', 'Xen', 'Kry', 'Nova', 'Sol', 'Vyr', 'Thal', 'Kor'];
        const suffix = ['ia', 'on', 'us', 'prime', 'ax', 'eth', 'os'];
        this.name = prefix[Math.floor(rng() * prefix.length)] + suffix[Math.floor(rng() * suffix.length)];

        // Aesthetics
        // Pick a realistic, vibrant daytime sky blue color
        const skyBlues = ['#78A7FF', '#87CEEB', '#88CCEE', '#66B2FF', '#99CCFF'];
        this.skyColor = skyBlues[Math.floor(rng() * skyBlues.length)];
        // Use a much lower fog density so the world looks clearer and less eerie
        this.fogDensity = 0.003 + (rng() * 0.003);

        // Terrain
        // Terrain parameters tweaked for Minecraft-like ruggedness
        this.terrainScale = 120 + rng() * 100; // Large macro shapes
        this.terrainHeight = 40 + rng() * 20; // Taller hills and mountains (40-60 range)
        this.baseHeight = 45 + rng() * 10; // Ensure enough depth for oceans and height for peaks
        this.seaLevel = this.baseHeight - 8;
        
        // Caves
        this.caveScale = 15 + rng() * 15; // Tighter noise to make them more distinct
        this.caveThreshold = 0.25 + rng() * 0.1; // Lowered significantly to create massive sprawling caves

        this.dungeonFrequency = 0.02 + rng() * 0.03; // ~2-5% per chunk chance

        this.noise2D = createNoise2D(this.seed);
        this.noise3D = createNoise3D(this.seed);
        this.caveNoise = createNoise3D(this.seed + 123);
        this.tempNoise = createNoise2D(this.seed + 456);
        this.moistNoise = createNoise2D(this.seed + 789);
    }
}

export function generatePlanetParams(seed) {
    return new PlanetParams(seed);
}

export function getBiomeParams(wx, wz, params) {
    const noise2D = params.noise2D;
    const tempNoise = params.tempNoise;
    const moistNoise = params.moistNoise;

    // Domain warp the coordinates slightly to make biome borders wavy/organic
    const warpX = noise2D(wx * 0.01, wz * 0.01) * 30;
    const warpZ = noise2D(wz * 0.01, wx * 0.01) * 30;
    
    // Scaled down frequencies to make biomes larger and more expansive
    const temp = (tempNoise((wx + warpX) * 0.0005, (wz + warpZ) * 0.0005) + 1) / 2;
    const moist = (moistNoise((wx + warpX) * 0.0005, (wz + warpZ) * 0.0005) + 1) / 2;
    const subNoise = (noise2D((wx + warpX) * 0.002, (wz + warpZ) * 0.002) + 1) / 2;

    const isHot = temp > 0.6;
    const isCold = temp < 0.4;
    const isWet = moist > 0.6;
    const isDry = moist < 0.4;

    let biome = BIOMES.PLAINS;
    let heightMult = 1.0;
    let baseOffset = 0;
    let ridgeWeight = 0;
    let isTerraced = false;

    if (isHot) {
        if (isDry) {
            biome = subNoise > 0.6 ? BIOMES.BADLANDS : BIOMES.DESERT;
            if (biome === BIOMES.DESERT && temp < 0.65 && moist > 0.35) biome = BIOMES.OASIS; // Rare oasis
            heightMult = subNoise > 0.6 ? 2.0 : 0.2;
            isTerraced = biome === BIOMES.BADLANDS;
        } else if (isWet) {
            biome = subNoise > 0.5 ? BIOMES.JUNGLE : BIOMES.SWAMP;
            heightMult = biome === BIOMES.SWAMP ? 0.1 : 1.2;
            if (biome === BIOMES.SWAMP) baseOffset = -2;
        } else {
            biome = BIOMES.SAVANNA;
            heightMult = 0.8;
        }
    } else if (isCold) {
        if (isDry) {
            biome = subNoise > 0.8 ? BIOMES.VOLCANIC : BIOMES.TUNDRA;
            heightMult = subNoise > 0.8 ? 1.4 : 1.0;
        } else if (isWet) {
            biome = subNoise > 0.7 ? BIOMES.ICE_SPIKES : BIOMES.MOUNTAINS;
            heightMult = subNoise > 0.7 ? 1.5 : 3.5;
        } else {
            biome = subNoise > 0.6 ? BIOMES.AUTUMN_FOREST : BIOMES.TUNDRA;
            heightMult = 1.0;
        }
    } else {
        if (isDry) {
            biome = subNoise > 0.7 ? BIOMES.MUSHROOM : BIOMES.PLAINS;
            heightMult = subNoise > 0.7 ? 0.8 : 0.6;
        } else if (isWet) {
            if (subNoise > 0.8) { biome = BIOMES.DEEP_OCEAN; heightMult = 0.4; baseOffset = -20; }
            else if (subNoise > 0.6) { biome = BIOMES.ALIEN; heightMult = 1.2; }
            else if (subNoise > 0.4) { biome = BIOMES.GLOW_FOREST; heightMult = 1.0; }
            else { biome = BIOMES.CRYSTAL; heightMult = 1.2; }
        } else {
            biome = subNoise > 0.8 ? BIOMES.CHERRY_GROVE : BIOMES.FOREST;
            heightMult = 1.1;
        }
    }
    
    if (biome === BIOMES.VOLCANIC || biome === BIOMES.CRYSTAL) {
        ridgeWeight = 1.0;
    }

    return { biome, heightMult, baseOffset, ridgeWeight, isTerraced };
}

function getInterpolatedBiomeData(wx, wz, params) {
    const CELL_SIZE = 16;
    const x0 = Math.floor(wx / CELL_SIZE) * CELL_SIZE;
    const z0 = Math.floor(wz / CELL_SIZE) * CELL_SIZE;
    const x1 = x0 + CELL_SIZE;
    const z1 = z0 + CELL_SIZE;
    
    const tx = (wx - x0) / CELL_SIZE;
    const tz = (wz - z0) / CELL_SIZE;
    
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);

    const b00 = getBiomeParams(x0, z0, params);
    const b10 = getBiomeParams(x1, z0, params);
    const b01 = getBiomeParams(x0, z1, params);
    const b11 = getBiomeParams(x1, z1, params);

    const heightMult = b00.heightMult * (1 - sx) * (1 - sz) +
                       b10.heightMult * sx * (1 - sz) +
                       b01.heightMult * (1 - sx) * sz +
                       b11.heightMult * sx * sz;
                       
    const baseOffset = b00.baseOffset * (1 - sx) * (1 - sz) +
                       b10.baseOffset * sx * (1 - sz) +
                       b01.baseOffset * (1 - sx) * sz +
                       b11.baseOffset * sx * sz;
                       
    const ridgeWeight = b00.ridgeWeight * (1 - sx) * (1 - sz) +
                        b10.ridgeWeight * sx * (1 - sz) +
                        b01.ridgeWeight * (1 - sx) * sz +
                        b11.ridgeWeight * sx * sz;

    const terracedWeight = (b00.isTerraced ? 1 : 0) * (1 - sx) * (1 - sz) +
                           (b10.isTerraced ? 1 : 0) * sx * (1 - sz) +
                           (b01.isTerraced ? 1 : 0) * (1 - sx) * sz +
                           (b11.isTerraced ? 1 : 0) * sx * sz;

    return { heightMult, baseOffset, ridgeWeight, terracedWeight };
}

function getColumnInfo(wx, wz, params) {
    const colRng = seededRandom(params.seed + wx * 3141 + wz);
    
    const bData = getInterpolatedBiomeData(wx, wz, params);
    const center = getBiomeParams(wx, wz, params);
    
    // Compose multiple octaves of noise for Minecraft-like ruggedness
    let hNoise = fbm2D(params.noise2D, wx / params.terrainScale, wz / params.terrainScale, 3);
    
    // Roughness scalar based on biome height multiplier
    // Plains (~0.6) -> low roughness. Mountains (~3.5) -> high roughness.
    let roughness = Math.max(0, Math.min(1, (bData.heightMult - 0.5) / 1.5));
    
    // Add a medium-frequency layer to break up smooth rolling hills
    let detailNoise = fbm2D(params.noise2D, wx / (params.terrainScale * 0.3), wz / (params.terrainScale * 0.3), 2);
    hNoise += detailNoise * (0.1 + 0.3 * roughness);
    
    // Add high-frequency jaggedness (very subtle, gives surface bumpiness)
    let microNoise = params.noise2D(wx / 15, wz / 15);
    hNoise += microNoise * (0.01 + 0.04 * roughness);

    // Apply ridge modifiers
    if (bData.ridgeWeight > 0) {
        hNoise += ridgeFbm2D(params.noise2D, wx / (params.terrainScale * 0.5), wz / (params.terrainScale * 0.5), 4) * 0.5 * bData.ridgeWeight;
    }

    // Pseudo-erosion: pull valleys down deeper
    if (hNoise < 0) {
        hNoise = -(Math.pow(Math.abs(hNoise), 0.8));
    } else {
        hNoise = Math.pow(hNoise, 1.1); // push peaks slightly higher
    }

    let elevation = (params.baseHeight + bData.baseOffset) + (hNoise * params.terrainHeight * bData.heightMult);
    
    // Apply terracing (e.g. for Badlands)
    if (bData.terracedWeight > 0) {
        const terraceStep = 6; // Height of each terrace
        const terracedElevation = Math.floor(elevation / terraceStep) * terraceStep;
        elevation = elevation * (1 - bData.terracedWeight) + terracedElevation * bData.terracedWeight;
    }

    let surfaceY = Math.floor(elevation);
    if (surfaceY < 1) surfaceY = 1;
    if (surfaceY >= CHUNK_HEIGHT - 1) surfaceY = CHUNK_HEIGHT - 2;

    return { biome: center.biome, surfaceY, colRng, bData };
}

// Generate the chunk terrain
export function generateChunkTerrain(cx, cz, params) {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

    const wxBase = cx * CHUNK_SIZE;
    const wzBase = cz * CHUNK_SIZE;

    const blockIndex = (x, y, z) => (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;

    // 1. Generate base terrain for chunk exactly
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = wxBase + x;
            const wz = wzBase + z;
            
            const { biome, surfaceY, colRng } = getColumnInfo(wx, wz, params);

            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                let type = BLOCKS.AIR;

                if (y === 0) {
                    type = BLOCKS.BEDROCK;
                } else if (y < surfaceY - 3) {
                    type = BLOCKS.STONE;
                    
                    if (y > 5 && y < surfaceY - 5) {
                        const c = fbm3D(params.caveNoise, wx / params.caveScale, y / (params.caveScale * 0.8), wz / params.caveScale, 3);
                        if (c > params.caveThreshold) type = BLOCKS.AIR;
                    }
                    
                    if (type === BLOCKS.STONE && colRng() < 0.02) {
                        if (y < 20 && colRng() < 0.2) type = BLOCKS.CRYSTAL_ORE;
                        else if (y < 30 && colRng() < 0.3) type = BLOCKS.MANA_ORE;
                        else if (colRng() < 0.1) type = BLOCKS.GOLD_ORE;
                        else type = BLOCKS.IRON_ORE;
                    }
                } else if (y <= surfaceY) {
                    type = (y === surfaceY) ? biome.surface : biome.dirt;
                    // Grass shouldn't survive underwater
                    const isAnyGrass = type === BLOCKS.GRASS || type === BLOCKS.SWAMP_GRASS || type === BLOCKS.SAVANNA_GRASS || type === BLOCKS.ALIEN_GRASS;
                    if (y < params.seaLevel && isAnyGrass) {
                        type = (biome === BIOMES.PLAINS || biome === BIOMES.DESERT || biome === BIOMES.SWAMP) ? BLOCKS.SAND : BLOCKS.DIRT;
                    }
                } else if (y <= params.seaLevel) {
                    type = biome === BIOMES.VOLCANIC ? BLOCKS.LAVA : (biome === BIOMES.SWAMP ? BLOCKS.SWAMP_WATER : BLOCKS.WATER);
                }

                blocks[blockIndex(x, y, z)] = type;
            }
        }
    }

    // 2. Flora Projection: Iterate over neighborhood to draw trees that overlap this chunk
    for (let tx = -3; tx <= CHUNK_SIZE + 2; tx++) {
        for (let tz = -3; tz <= CHUNK_SIZE + 2; tz++) {
            const wx = wxBase + tx;
            const wz = wzBase + tz;
            const { biome, surfaceY, colRng } = getColumnInfo(wx, wz, params);
            
            // Re-roll colRng to match the exact state right after terrain gen if we want strictly same, 
            // but since we do it procedurally per col it's fine. We need to skip the exact number of colRng calls made in terrain loop, 
            // but it's easier to just use a new seeded random for flora.
            const floraRng = seededRandom(params.seed + wx * 7777 + wz);

            if (surfaceY > params.seaLevel && surfaceY < CHUNK_HEIGHT - 10) {
                // If it's outside chunk, we don't know if the base is air/water natively without checking blocks[]
                // We'll trust getColumnInfo for height, assume valid if not water.
                const r = floraRng();
                
                if (biome.hasTrees && r < 0.02) {
                    generateTree(blocks, tx, surfaceY + 1, tz, biome, floraRng);
                } else if (biome.hasMushrooms && r < 0.05) {
                    generateMushroom(blocks, tx, surfaceY + 1, tz, floraRng);
                } else if (biome.hasCrystals && r < 0.03) {
                    generateCrystal(blocks, tx, surfaceY + 1, tz, floraRng);
                } else if (biome.hasIceSpikes && r < 0.02) {
                    generateIceSpike(blocks, tx, surfaceY + 1, tz, floraRng);
                } else if (biome.hasCactus && r < 0.01) {
                    generateCactus(blocks, tx, surfaceY + 1, tz, floraRng);
                } else if (biome.hasDeadBush && r < 0.04) {
                    safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.DEAD_BUSH);
                } else if (biome.jungleFlora && r < 0.08) {
                    if (floraRng() < 0.5) generateTree(blocks, tx, surfaceY + 1, tz, biome, floraRng);
                    else safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.LEAVES); // Bush
                } else if (biome.alienFlora && r < 0.15) {
                    safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.ALIEN_TALL_GRASS);
                } else if (r < 0.001) {
                    generatePortalStructure(blocks, tx, surfaceY + 1, tz, floraRng);
                } else if (r < 0.0002 && (biome === BIOMES.FOREST || biome === BIOMES.PLAINS || biome === BIOMES.TUNDRA)) {
                    generateCabin(blocks, tx, surfaceY + 1, tz, floraRng);
                } else if (biome.name !== 'Desert' && biome.name !== 'Badlands' && biome.name !== 'Volcanic' && biome.name !== 'Ice Spikes' && biome.name !== 'Deep Ocean') {
                    // Normal grass logic
                    let r = floraRng();
                    if (biome === BIOMES.CHERRY_GROVE && r < 0.4) {
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.PINK_PETALS);
                    } else if (biome === BIOMES.AUTUMN_FOREST && r < 0.4) {
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.FALLEN_LEAVES);
                    } else if (biome === BIOMES.GLOW_FOREST && r < 0.1) {
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.GLOW_SHROOM);
                    } else if (biome === BIOMES.OASIS && r < 0.2) {
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, BLOCKS.OASIS_FERN);
                    } else if (r < 0.2) {
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, floraRng() > 0.3 ? BLOCKS.TALL_GRASS : BLOCKS.FERN);
                    } else if (r >= 0.2 && r < 0.25) {
                        const fRng = floraRng();
                        const flowerType = fRng < 0.25 ? BLOCKS.RED_FLOWER : (fRng < 0.5 ? BLOCKS.YELLOW_FLOWER : (fRng < 0.75 ? BLOCKS.BLUE_FLOWER : BLOCKS.WHITE_FLOWER));
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, flowerType);
                    }
                }
            }
        }
    }

    // Carve Global Dungeons
    carveGlobalDungeons(blocks, cx, cz, params);

    return blocks;
}

// getDungeonInfo removed — dungeon data is embedded in chunk generation

// ============================================
// Flora Generation
// ============================================

function generateTree(blocks, x, y, z, biome, rng) {
    const isAlien = biome.alienFlora;
    const isSavanna = biome.savannaFlora;
    const isSwamp = biome.swampFlora;
    
    let trunkType = BLOCKS.WOOD;
    let leafType = BLOCKS.LEAVES;
    
    if (isAlien) { trunkType = BLOCKS.ALIEN_SPORE_STEM; leafType = BLOCKS.ALIEN_SPORE_BLOCK; }
    else if (isSavanna) { trunkType = BLOCKS.ACACIA_WOOD; leafType = BLOCKS.ACACIA_LEAVES; }
    else if (biome.isCherry) { trunkType = BLOCKS.CHERRY_LOG; leafType = BLOCKS.CHERRY_LEAVES; }
    else if (biome.isAutumn) { trunkType = BLOCKS.AUTUMN_WOOD; leafType = BLOCKS.AUTUMN_LEAVES; }
    else if (biome.isGlow) { trunkType = BLOCKS.GLOW_STEM; leafType = BLOCKS.GLOW_LEAVES; }
    else if (biome.isOasis) { trunkType = BLOCKS.PALM_WOOD; leafType = BLOCKS.PALM_LEAVES; }
    
    const isJungle = biome.jungleFlora;
    const isPine = biome.name === 'Tundra' || biome.name === 'Ice Spikes' || biome.name === 'Mountains';
    const isCherry = biome.isCherry;
    
    // Height generation
    let height = 4 + Math.floor(rng() * 3);
    if (isJungle) height = 7 + Math.floor(rng() * 4); // Scaled down jungle tree height
    else if (isPine) height = 6 + Math.floor(rng() * 3);
    else if (isSavanna) height = 5 + Math.floor(rng() * 2);
    else if (isCherry) height = 5 + Math.floor(rng() * 2);

    // Trunk generation
    if (isJungle) {
        // Massive 2x2 trunk for jungle
        for (let i = 0; i < height; i++) {
            safeSetBlock(blocks, x, y + i, z, trunkType);
            safeSetBlock(blocks, x+1, y + i, z, trunkType);
            safeSetBlock(blocks, x, y + i, z+1, trunkType);
            safeSetBlock(blocks, x+1, y + i, z+1, trunkType);
        }
    } else {
        // Normal 1x1 trunk
        for (let i = 0; i < height; i++) {
            safeSetBlock(blocks, x, y + i, z, trunkType);
        }
    }
    
    // Canopy Generation based on tree type
    if (biome.isOasis) {
        // Simple Palm Tree top
        safeSetBlock(blocks, x, y + height, z, leafType, true);
        for(let d=1; d<=2; d++) {
            safeSetBlock(blocks, x+d, y + height, z, leafType, true);
            safeSetBlock(blocks, x-d, y + height, z, leafType, true);
            safeSetBlock(blocks, x, y + height, z+d, leafType, true);
            safeSetBlock(blocks, x, y + height, z-d, leafType, true);
        }
        safeSetBlock(blocks, x+2, y + height - 1, z, leafType, true);
        safeSetBlock(blocks, x-2, y + height - 1, z, leafType, true);
        safeSetBlock(blocks, x, y + height - 1, z+2, leafType, true);
        safeSetBlock(blocks, x, y + height - 1, z-2, leafType, true);
    } 
    else if (isPine) {
        // Cone shaped pine tree
        const topY = y + height + 2;
        for (let ly = y + 3; ly <= topY; ly++) {
            const radius = Math.max(1, Math.floor((topY - ly) / 2) + 1);
            if (ly === topY) {
                safeSetBlock(blocks, x, ly, z, leafType, true);
                continue;
            }
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && rng() < 0.5) continue;
                    safeSetBlock(blocks, lx, ly, lz, leafType, true);
                }
            }
        }
    }
    else if (isJungle) {
        // Jungle canopy
        for (let ly = y + height - 3; ly <= y + height + 1; ly++) {
            const radius = ly > y + height - 1 ? 2 : 3; // Reduced from 5
            for (let lx = x - radius; lx <= x + radius + 1; lx++) {
                for (let lz = z - radius; lz <= z + radius + 1; lz++) {
                    if (Math.abs(lx - x - 0.5) + Math.abs(lz - z - 0.5) > radius + 1) continue;
                    if (rng() < 0.2) continue;
                    safeSetBlock(blocks, lx, ly, lz, leafType, true);
                }
            }
        }
    }
    else if (isSavanna) {
        // Flat top acacia
        const branchDirX = rng() > 0.5 ? 1 : -1;
        const branchDirZ = rng() > 0.5 ? 1 : -1;
        const bx = x + branchDirX * 2;
        const bz = z + branchDirZ * 2;
        const by = y + height;
        // Diagonal branch
        safeSetBlock(blocks, x + branchDirX, y + height - 2, z + branchDirZ, trunkType);
        safeSetBlock(blocks, bx, y + height - 1, bz, trunkType);
        safeSetBlock(blocks, bx, by, bz, trunkType);
        
        // Flat canopy
        for (let ly = by; ly <= by + 1; ly++) {
            const radius = ly === by ? 3 : 2;
            for (let lx = bx - radius; lx <= bx + radius; lx++) {
                for (let lz = bz - radius; lz <= bz + radius; lz++) {
                    if (Math.abs(lx - bx) === radius && Math.abs(lz - bz) === radius) continue;
                    safeSetBlock(blocks, lx, ly, lz, leafType, true);
                }
            }
        }
    }
    else if (isCherry) {
        // Spherical canopy
        for (let ly = y + height - 2; ly <= y + height + 2; ly++) {
            const radius = ly === y + height ? 3 : (ly === y + height + 2 || ly === y + height - 2 ? 1 : 2); // Reduced from 4
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && rng() < 0.7) continue;
                    safeSetBlock(blocks, lx, ly, lz, leafType, true);
                }
            }
        }
    }
    else {
        // Default Minecraft-style Oak Tree Canopy
        for (let ly = y + height - 2; ly <= y + height - 1; ly++) {
            for (let lx = x - 2; lx <= x + 2; lx++) {
                for (let lz = z - 2; lz <= z + 2; lz++) {
                    if (Math.abs(lx - x) === 2 && Math.abs(lz - z) === 2) continue;
                    if (rng() < 0.15) continue; // jitter leaves
                    safeSetBlock(blocks, lx, ly, lz, leafType, true);
                }
            }
        }
        for (let ly = y + height; ly <= y + height + 1; ly++) {
            for (let lx = x - 1; lx <= x + 1; lx++) {
                for (let lz = z - 1; lz <= z + 1; lz++) {
                    if (ly === y + height + 1 && Math.abs(lx - x) === 1 && Math.abs(lz - z) === 1) continue;
                    if (ly === y + height + 1 && rng() < 0.3) continue; // thinner top layer
                    safeSetBlock(blocks, lx, ly, lz, leafType, true);
                }
            }
        }
    }
    
    if (isSwamp) {
        // Add vines/moss hanging from leaves
        for (let ly = y + height - 2; ly <= y + height; ly++) {
            for (let lx = x - 2; lx <= x + 2; lx++) {
                for (let lz = z - 2; lz <= z + 2; lz++) {
                    if (rng() < 0.2 && Math.abs(lx - x) + Math.abs(lz - z) > 1) {
                        for(let drop=1; drop <= 2 + Math.floor(rng()*3); drop++) {
                            safeSetBlock(blocks, lx, ly - drop, lz, BLOCKS.VINES, true); // pseudo-vine
                        }
                    }
                }
            }
        }
    }
}

function generateMushroom(blocks, x, y, z, rng) {
    const height = 3 + Math.floor((rng ? rng() : Math.random()) * 3);
    for (let i = 0; i < height; i++) safeSetBlock(blocks, x, y + i, z, BLOCKS.MUSHROOM_STEM);
    
    for (let lx = x - 1; lx <= x + 1; lx++) {
        for (let lz = z - 1; lz <= z + 1; lz++) {
            safeSetBlock(blocks, lx, y + height, lz, BLOCKS.MUSHROOM_CAP);
        }
    }
}

function generateCrystal(blocks, x, y, z, rng) {
    const height = 2 + Math.floor((rng ? rng() : Math.random()) * 4);
    for (let i = 0; i < height; i++) safeSetBlock(blocks, x, y + i, z, BLOCKS.ALIEN_CRYSTAL);
}

function generateIceSpike(blocks, x, y, z, rng) {
    const height = 5 + Math.floor((rng ? rng() : Math.random()) * 8);
    for (let i = 0; i < height; i++) {
        safeSetBlock(blocks, x, y + i, z, BLOCKS.ICE);
        if (i < height - 2) {
            safeSetBlock(blocks, x+1, y + i, z, BLOCKS.ICE);
            safeSetBlock(blocks, x-1, y + i, z, BLOCKS.ICE);
            safeSetBlock(blocks, x, y + i, z+1, BLOCKS.ICE);
            safeSetBlock(blocks, x, y + i, z-1, BLOCKS.ICE);
        }
    }
}

function generateCactus(blocks, x, y, z, rng) {
    const height = 2 + Math.floor((rng ? rng() : Math.random()) * 3);
    for (let i = 0; i < height; i++) {
        safeSetBlock(blocks, x, y + i, z, BLOCKS.CACTUS);
    }
}

// ============================================
// Dungeon Generation
// ============================================

function carveGlobalDungeons(blocks, cx, cz, params) {
    const searchRadius = 3; // Reduced from 6 to eliminate huge lag spikes
    for (let sx = cx - searchRadius; sx <= cx + searchRadius; sx++) {
        for (let sz = cz - searchRadius; sz <= cz + searchRadius; sz++) {
            // Determine if a dungeon starts at chunk (sx, sz)
            const seedStr = params.seed + "_" + sx + "_" + sz;
            const startRng = seededRandom(hashSeed(seedStr));
            
            if (startRng() < params.dungeonFrequency * 0.1) { // reduced frequency since they are huge
                const rooms = generateDungeonStructure(startRng, sx * CHUNK_SIZE + 8, 15, sz * CHUNK_SIZE + 8);
                
                // Carve any room that intersects the current chunk (cx, cz)
                for (const room of rooms) {
                    carveRoomInChunk(blocks, cx, cz, room);
                }
            }
        }
    }
}

function generateDungeonStructure(rng, startX, startY, startZ) {
    const rooms = [];
    
    // Add a huge entrance shaft piercing the surface to make it discoverable
    rooms.push({ x: startX, y: startY, z: startZ, w: 7, h: 180, d: 7, type: 'entrance' });
    
    // Start normal dungeon generation
    const queue = [{ x: startX, y: startY, z: startZ, w: 11, h: 6, d: 11, depth: 0, bossChance: 0.01 }];
    const maxRooms = 25;
    
    while (queue.length > 0 && rooms.length < maxRooms) {
        const current = queue.shift();
        let isBoss = false;
        
        if (rooms.length >= 5) {
            if (rng() < current.bossChance) {
                isBoss = true;
            }
            current.bossChance += 0.02; // Increase boss chance
        }
        
        if (isBoss) {
            current.w = 15;
            current.h = 8;
            current.d = 15;
            current.type = 'boss';
        } else {
            current.type = 'normal';
        }
        
        rooms.push(current);
        if (isBoss) continue; // Boss room is a dead end
        
        // Branch out
        const numBranches = 1 + Math.floor(rng() * 3); // 1 to 3 branches
        for (let i = 0; i < numBranches; i++) {
            const dir = Math.floor(rng() * 4);
            let nx = current.x, nz = current.z;
            const branchLen = 10 + Math.floor(rng() * 10);
            
            if (dir === 0) nx += branchLen;
            else if (dir === 1) nx -= branchLen;
            else if (dir === 2) nz += branchLen;
            else if (dir === 3) nz -= branchLen;
            
            // Check overlap
            let overlap = false;
            for (const r of rooms) {
                if (Math.abs(r.x - nx) < 12 && Math.abs(r.z - nz) < 12) { overlap = true; break; }
            }
            if (!overlap) {
                queue.push({ x: nx, y: current.y + (Math.floor(rng()*3)-1)*2, z: nz, w: 7 + Math.floor(rng()*4), h: 5, d: 7 + Math.floor(rng()*4), depth: current.depth + 1, bossChance: current.bossChance });
                
                // Add corridor room connecting them
                const mx = (current.x + nx) / 2;
                const mz = (current.z + nz) / 2;
                rooms.push({ x: mx, y: current.y, z: mz, w: dir <= 1 ? branchLen : 3, h: 4, d: dir > 1 ? branchLen : 3, type: 'corridor' });
            }
        }
    }
    return rooms;
}

function carveRoomInChunk(blocks, cx, cz, room) {

    const minX = Math.floor(room.x - room.w / 2);
    const maxX = Math.floor(room.x + room.w / 2);
    const minZ = Math.floor(room.z - room.d / 2);
    const maxZ = Math.floor(room.z + room.d / 2);
    const minY = room.y;
    const maxY = room.y + room.h;

    // Check intersection with chunk
    const cMinX = cx * CHUNK_SIZE;
    const cMaxX = cMinX + CHUNK_SIZE - 1;
    const cMinZ = cz * CHUNK_SIZE;
    const cMaxZ = cMinZ + CHUNK_SIZE - 1;

    if (maxX < cMinX || minX > cMaxX || maxZ < cMinZ || minZ > cMaxZ) return;

    // Carve locally
    for (let wy = minY; wy <= maxY; wy++) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) continue;
        for (let wx = minX; wx <= Math.min(maxX, cMaxX); wx++) {
            if (wx < cMinX) continue;
            for (let wz = minZ; wz <= Math.min(maxZ, cMaxZ); wz++) {
                if (wz < cMinZ) continue;
                
                const lx = wx - cMinX;
                const lz = wz - cMinZ;
                
                const isWall = (wx === minX || wx === maxX || wz === minZ || wz === maxZ || wy === minY || wy === Math.min(maxY, CHUNK_HEIGHT - 1));
                
                if (isWall) {
                    if (room.type === 'boss') safeSetBlock(blocks, lx, wy, lz, BLOCKS.PORTAL_FRAME);
                    else {
                        // Degraded dungeon walls
                        const wallRng = Math.random();
                        if (wallRng < 0.15) safeSetBlock(blocks, lx, wy, lz, BLOCKS.COBBLESTONE);
                        else safeSetBlock(blocks, lx, wy, lz, BLOCKS.DUNGEON_BRICK);
                    }
                } else {
                    if (room.type === 'entrance' && wy <= minY + 2) {
                        // Put water at the bottom of the entrance shaft to prevent fatal falls
                        safeSetBlock(blocks, lx, wy, lz, BLOCKS.WATER);
                    } else {
                        safeSetBlock(blocks, lx, wy, lz, BLOCKS.AIR);
                    }
                    // Add glowstone lighting occasionally
                    if (room.type === 'boss' && wy === maxY - 1 && (wx === minX+2 || wx === maxX-2) && (wz === minZ+2 || wz === maxZ-2)) {
                        safeSetBlock(blocks, lx, wy, lz, ((lx + wy + lz) % 2 === 0) ? BLOCKS.GLOWSTONE : BLOCKS.PORTAL_FRAME);
                    } else if (room.type === 'normal' && wy === Math.min(maxY, CHUNK_HEIGHT - 1) && wx === Math.floor((minX+maxX)/2) && wz === Math.floor((minZ+maxZ)/2)) {
                        safeSetBlock(blocks, lx, wy, lz, BLOCKS.GLOWSTONE);
                    }
                }
            }
        }
    }
}

export function generatePortalStructure(blocks, x, y, z, rng) {
    // 4x5 ruined portal
    for (let px = x; px < x + 4; px++) {
        for (let py = y; py < y + 5; py++) {
            // More degraded frame
            if (rng() < 0.3) continue; // missing blocks
            
            if (px === x || px === x + 3 || py === y || py === y + 4) {
                safeSetBlock(blocks, px, py, z, rng() < 0.2 ? BLOCKS.OBSIDIAN : BLOCKS.PORTAL_FRAME);
            } else {
                if (rng() < 0.4) safeSetBlock(blocks, px, py, z, BLOCKS.PORTAL);
            }
        }
    }
    // Netherrack base
    for (let px = x - 1; px < x + 5; px++) {
        for (let pz = z - 2; pz < z + 3; pz++) {
            if (rng() < 0.6) safeSetBlock(blocks, px, y - 1, pz, BLOCKS.ALIEN_STONE); // Use alien stone as netherrack proxy
        }
    }
}

export function generateCabin(blocks, x, y, z, rng) {
    // 5x5 cabin
    for (let py = y; py < y + 4; py++) {
        for (let px = x - 2; px <= x + 2; px++) {
            for (let pz = z - 2; pz <= z + 2; pz++) {
                const isWall = px === x - 2 || px === x + 2 || pz === z - 2 || pz === z + 2;
                if (isWall) {
                    if (py === y + 1 && (px === x || pz === z) && rng() < 0.5) {
                        safeSetBlock(blocks, px, py, pz, BLOCKS.GLASS); // Window
                    } else if (py === y && px === x && pz === z - 2) {
                        safeSetBlock(blocks, px, py, pz, BLOCKS.AIR); // Door
                    } else if (py === y + 1 && px === x && pz === z - 2) {
                        safeSetBlock(blocks, px, py, pz, BLOCKS.AIR); // Door top
                    } else {
                        safeSetBlock(blocks, px, py, pz, BLOCKS.WOOD); // Wall
                    }
                } else if (py === y + 3) {
                    safeSetBlock(blocks, px, py, pz, BLOCKS.PLANKS); // Roof
                } else {
                    safeSetBlock(blocks, px, py, pz, BLOCKS.AIR); // Inside
                }
            }
        }
    }
    
    // Add interior
    safeSetBlock(blocks, x - 1, y, z + 1, BLOCKS.COBBLESTONE); // Furnace proxy
    safeSetBlock(blocks, x + 1, y, z + 1, BLOCKS.PLANKS); // Table
    safeSetBlock(blocks, x, y + 2, z + 1, BLOCKS.TORCH); // Wall torch
    // Floor
    for (let px = x - 1; px <= x + 1; px++) {
        for (let pz = z - 1; pz <= z + 1; pz++) {
            safeSetBlock(blocks, px, y - 1, pz, BLOCKS.PLANKS);
        }
    }
}

function safeSetBlock(blocks, x, y, z, type, onlyReplaceAir = false) {
    if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE) {
        const idx = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
        if (!onlyReplaceAir || blocks[idx] === BLOCKS.AIR) {
            blocks[idx] = type;
        }
    }
}
