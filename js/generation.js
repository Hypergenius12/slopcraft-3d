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
    SAVANNA: { name: 'Savanna', surface: BLOCKS.SAVANNA_GRASS, dirt: BLOCKS.DIRT, freq: 0.8, hasTrees: true, savannaFlora: true }
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
        const skyBlues = ['#87ceeb', '#4682b4', '#00bfff', '#add8e6', '#88ccee'];
        this.skyColor = skyBlues[Math.floor(rng() * skyBlues.length)];
        // Use a much lower fog density so the world looks clearer and less eerie
        this.fogDensity = 0.003 + (rng() * 0.003);

        // Terrain
        this.terrainScale = 50 + rng() * 150;
        this.terrainHeight = 10 + rng() * 40;
        this.baseHeight = 30 + rng() * 20;
        this.seaLevel = this.baseHeight + (rng() * 10 - 5);
        
        // Caves
        this.caveScale = 20 + rng() * 30;
        this.caveThreshold = 0.5 + rng() * 0.2; // Higher = fewer caves

        this.dungeonFrequency = 0.02 + rng() * 0.03; // ~2-5% per chunk chance
    }
}

export function generatePlanetParams(seed) {
    return new PlanetParams(seed);
}

function getColumnInfo(wx, wz, params, noise2D, tempNoise, moistNoise) {
    const colRng = seededRandom(params.seed + wx * 3141 + wz);
    const temp = (tempNoise(wx * 0.003, wz * 0.003) + 1) / 2;
    const moist = (moistNoise(wx * 0.003, wz * 0.003) + 1) / 2;
    
    const ditherT = (colRng() - 0.5) * 0.1;
    const ditherM = (colRng() - 0.5) * 0.1;
    
    const isHot = (temp + ditherT) > 0.6;
    const isCold = (temp + ditherT) < 0.4;
    const isWet = (moist + ditherM) > 0.6;
    const isDry = (moist + ditherM) < 0.4;

    let biome = BIOMES.PLAINS; // Default moderate
    
    // Dynamically map all biomes across the temperature and moisture grid
    if (isHot) {
        if (isDry) biome = (colRng() > 0.5) ? BIOMES.DESERT : BIOMES.BADLANDS;
        else if (isWet) biome = (colRng() > 0.5) ? BIOMES.JUNGLE : BIOMES.SWAMP;
        else biome = BIOMES.SAVANNA;
    } else if (isCold) {
        if (isDry) biome = (colRng() > 0.8) ? BIOMES.VOLCANIC : BIOMES.TUNDRA;
        else if (isWet) biome = BIOMES.ICE_SPIKES;
        else biome = BIOMES.TUNDRA;
    } else { // Moderate temp
        if (isDry) biome = (colRng() > 0.8) ? BIOMES.MUSHROOM : BIOMES.PLAINS;
        else if (isWet) biome = (colRng() > 0.6) ? BIOMES.ALIEN : BIOMES.CRYSTAL;
        else biome = BIOMES.FOREST;
    }

    let hNoise = fbm2D(noise2D, wx / params.terrainScale, wz / params.terrainScale, 4);
    let heightMultiplier = 1.0;
    let baseOffset = 0;

    if (biome === BIOMES.VOLCANIC || biome === BIOMES.CRYSTAL) {
        hNoise += ridgeFbm2D(noise2D, wx / (params.terrainScale * 0.5), wz / (params.terrainScale * 0.5), 4) * 0.5;
    }

    if (biome === BIOMES.DESERT || biome === BIOMES.PLAINS || biome === BIOMES.SWAMP) {
        heightMultiplier = 0.3; // Flatter terrain
    } else if (biome === BIOMES.TUNDRA || biome === BIOMES.FOREST) {
        heightMultiplier = 0.8;
    } else if (biome === BIOMES.ICE_SPIKES || biome === BIOMES.BADLANDS) {
        heightMultiplier = 1.5; // Jagged terrain
    }

    if (biome === BIOMES.SWAMP) {
        baseOffset = -5; // Sink swamp closer to sea level
    }

    const surfaceY = Math.floor(params.baseHeight + baseOffset + (hNoise * params.terrainHeight * heightMultiplier));
    return { biome, surfaceY, colRng };
}

// Generate the chunk terrain
export function generateChunkTerrain(cx, cz, params) {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    
    const noise2D = createNoise2D(params.seed);
    const noise3D = createNoise3D(params.seed);
    const caveNoise = createNoise3D(params.seed + 123);
    const tempNoise = createNoise2D(params.seed + 456);
    const moistNoise = createNoise2D(params.seed + 789);

    const wxBase = cx * CHUNK_SIZE;
    const wzBase = cz * CHUNK_SIZE;

    const blockIndex = (x, y, z) => (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;

    // 1. Generate base terrain for chunk exactly
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = wxBase + x;
            const wz = wzBase + z;
            
            const { biome, surfaceY, colRng } = getColumnInfo(wx, wz, params, noise2D, tempNoise, moistNoise);

            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                let type = BLOCKS.AIR;

                if (y === 0) {
                    type = BLOCKS.BEDROCK;
                } else if (y < surfaceY - 3) {
                    type = BLOCKS.STONE;
                    
                    if (y > 5 && y < surfaceY - 5) {
                        const c = fbm3D(caveNoise, wx / params.caveScale, y / (params.caveScale * 0.8), wz / params.caveScale, 3);
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
                    if (y < params.seaLevel && type === BLOCKS.GRASS) {
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
            const { biome, surfaceY, colRng } = getColumnInfo(wx, wz, params, noise2D, tempNoise, moistNoise);
            
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
                    generatePortalStructure(blocks, tx, surfaceY + 1, tz);
                } else if (biome.name !== 'Desert' && biome.name !== 'Badlands' && biome.name !== 'Volcanic' && biome.name !== 'Ice Spikes') {
                    // Add standard ground flora (Reverted to normal density)
                    if (r > 0.05 && r < 0.2) {
                        safeSetBlock(blocks, tx, surfaceY + 1, tz, floraRng() > 0.3 ? BLOCKS.TALL_GRASS : BLOCKS.FERN);
                    } else if (r >= 0.2 && r < 0.25) {
                        const fRng = floraRng();
                        const flowerType = fRng < 0.33 ? BLOCKS.RED_FLOWER : (fRng < 0.66 ? BLOCKS.YELLOW_FLOWER : BLOCKS.BLUE_FLOWER);
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
    
    let trunkType = isAlien ? BLOCKS.ALIEN_SPORE_STEM : (isSavanna ? BLOCKS.ACACIA_WOOD : BLOCKS.WOOD);
    let leafType = isAlien ? BLOCKS.ALIEN_SPORE_BLOCK : (isSavanna ? BLOCKS.ACACIA_LEAVES : BLOCKS.LEAVES);
    
    const isJungle = biome.jungleFlora;
    const height = (isJungle ? 8 : (isSavanna ? 5 : 4)) + Math.floor(rng() * (isJungle ? 6 : 3));
    
    for (let i = 0; i < height; i++) {
        safeSetBlock(blocks, x, y + i, z, trunkType);
    }
    
    // Minecraft-style Oak Tree Canopy
    for (let ly = y + height - 2; ly <= y + height - 1; ly++) {
        for (let lx = x - 2; lx <= x + 2; lx++) {
            for (let lz = z - 2; lz <= z + 2; lz++) {
                if (Math.abs(lx - x) === 2 && Math.abs(lz - z) === 2) continue;
                safeSetBlock(blocks, lx, ly, lz, leafType, true);
            }
        }
    }
    for (let ly = y + height; ly <= y + height + 1; ly++) {
        for (let lx = x - 1; lx <= x + 1; lx++) {
            for (let lz = z - 1; lz <= z + 1; lz++) {
                if (ly === y + height + 1 && Math.abs(lx - x) === 1 && Math.abs(lz - z) === 1) continue;
                safeSetBlock(blocks, lx, ly, lz, leafType, true);
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

    const searchRadius = 6; // Check chunks within 6 chunks distance for dungeon starts
    
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
    const queue = [{ x: startX, y: startY, z: startZ, w: 9, h: 5, d: 9, depth: 0, bossChance: 0.01 }];
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
                    safeSetBlock(blocks, lx, wy, lz, BLOCKS.AIR);
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

export function generatePortalStructure(blocks, x, y, z) {
    // 4x5 portal
    for (let px = x; px < x + 4; px++) {
        for (let py = y; py < y + 5; py++) {
            if (px === x || px === x + 3 || py === y || py === y + 4) {
                safeSetBlock(blocks, px, py, z, BLOCKS.PORTAL_FRAME);
            } else {
                safeSetBlock(blocks, px, py, z, BLOCKS.PORTAL);
            }
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
