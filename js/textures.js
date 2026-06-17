// ============================================
// textures.js — Procedural Texture Atlas + Block Definitions
// ============================================
import * as THREE from 'three';
import { seededRandom } from './noise.js';

// Block type IDs
export const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    SAND: 4,
    WATER: 5,
    WOOD: 6,
    LEAVES: 7,
    PLANKS: 8,
    COBBLESTONE: 9,
    IRON_ORE: 10,
    GOLD_ORE: 11,
    CRYSTAL_ORE: 12,
    MANA_ORE: 13,
    OBSIDIAN: 14,
    GLOWSTONE: 15,
    DUNGEON_BRICK: 16,
    DUNGEON_FLOOR: 17,
    MUSHROOM_STEM: 18,
    MUSHROOM_CAP: 19,
    ALIEN_STONE: 20,
    ALIEN_GRASS: 21,
    ALIEN_CRYSTAL: 22,
    SNOW: 23,
    ICE: 24,
    LAVA: 25,
    PORTAL_FRAME: 26,
    PORTAL: 27,
    BEDROCK: 28,
    GRAVEL: 29,
    CLAY: 30,
    GLASS: 31,
    TORCH: 32,
    SANDSTONE: 33,
    RED_SAND: 34,
    TERRACOTTA: 35,
    DEAD_BUSH: 36,
    ALIEN_TALL_GRASS: 37,
    SAVANNA_GRASS: 38,
    ACACIA_WOOD: 39,
    ACACIA_LEAVES: 40,
    MUD: 41,
    SWAMP_GRASS: 42,
    SWAMP_WATER: 43,
    ALIEN_SPORE_STEM: 44,
    ALIEN_SPORE_BLOCK: 45,
    VINES: 46,
    TALL_GRASS: 47,
    RED_FLOWER: 48,
    CACTUS: 49,
    BLUE_FLOWER: 50,
    YELLOW_FLOWER: 51,
    FERN: 52
};

// Block properties
const BLOCK_PROPS = {
    [BLOCKS.AIR]:           { name: 'Air',           health: 0, transparent: true,  emissive: 0, solid: false, drops: null },
    [BLOCKS.GRASS]:         { name: 'Grass',         health: 3, transparent: false, emissive: 0, solid: true, drops: BLOCKS.DIRT },
    [BLOCKS.DIRT]:          { name: 'Dirt',           health: 3, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.STONE]:         { name: 'Stone',          health: 6, transparent: false, emissive: 0, solid: true, drops: BLOCKS.COBBLESTONE },
    [BLOCKS.SAND]:          { name: 'Sand',           health: 2, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.WATER]:         { name: 'Water',          health: 0, transparent: true,  emissive: 0, solid: false, isLiquid: true, drops: null },
    [BLOCKS.WOOD]:          { name: 'Wood',           health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.LEAVES]:        { name: 'Leaves',         health: 1, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.PLANKS]:        { name: 'Planks',         health: 4, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.COBBLESTONE]:   { name: 'Cobblestone',    health: 6, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.IRON_ORE]:      { name: 'Iron Ore',       health: 8, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.GOLD_ORE]:      { name: 'Gold Ore',       health: 8, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.CRYSTAL_ORE]:   { name: 'Crystal Ore',    health: 10, transparent: false, emissive: 0.3, solid: true, drops: null },
    [BLOCKS.MANA_ORE]:      { name: 'Mana Ore',       health: 10, transparent: false, emissive: 0.5, solid: true, drops: null },
    [BLOCKS.OBSIDIAN]:      { name: 'Obsidian',       health: 15, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.GLOWSTONE]:     { name: 'Glowstone',      health: 4, transparent: false, emissive: 1.0, solid: true, drops: null },
    [BLOCKS.DUNGEON_BRICK]: { name: 'Dungeon Brick',  health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_FLOOR]: { name: 'Dungeon Floor',  health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.MUSHROOM_STEM]: { name: 'Mushroom Stem',  health: 3, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.MUSHROOM_CAP]:  { name: 'Mushroom Cap',   health: 2, transparent: false, emissive: 0.2, solid: true, drops: null },
    [BLOCKS.ALIEN_STONE]:   { name: 'Alien Stone',    health: 8, transparent: false, emissive: 0.1, solid: true, drops: null },
    [BLOCKS.ALIEN_GRASS]:   { name: 'Alien Grass',    health: 3, transparent: false, emissive: 0.15, solid: true, drops: null },
    [BLOCKS.ALIEN_CRYSTAL]: { name: 'Alien Crystal',  health: 10, transparent: true, emissive: 0.8, solid: true, drops: null },
    [BLOCKS.SNOW]:          { name: 'Snow',           health: 2, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.ICE]:           { name: 'Ice',            health: 3, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.LAVA]:          { name: 'Lava',           health: 0, transparent: true,  emissive: 1.0, solid: false, isLiquid: true, drops: null },
    [BLOCKS.PORTAL_FRAME]:  { name: 'Portal Frame',   health: 20, transparent: false, emissive: 0.4, solid: true, drops: null },
    [BLOCKS.PORTAL]:        { name: 'Portal',         health: 0, transparent: true,  emissive: 1.0, solid: false, drops: null },
    [BLOCKS.BEDROCK]:       { name: 'Bedrock',        health: Infinity, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.GRAVEL]:        { name: 'Gravel',         health: 3, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.CLAY]:          { name: 'Clay',           health: 3, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.GLASS]:         { name: 'Glass',          health: 1, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.TORCH]:         { name: 'Torch',          health: 1, transparent: true,  emissive: 1.0, solid: false, isCross: true, drops: null },
    [BLOCKS.SANDSTONE]:     { name: 'Sandstone',      health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.RED_SAND]:      { name: 'Red Sand',       health: 2, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.TERRACOTTA]:    { name: 'Terracotta',     health: 8, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DEAD_BUSH]:     { name: 'Dead Bush',      health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.ALIEN_TALL_GRASS]:{ name: 'Alien Spores', health: 1, transparent: true,  emissive: 0.3, solid: false, isCross: true, drops: null },
    [BLOCKS.SAVANNA_GRASS]: { name: 'Savanna Grass',  health: 3, transparent: false, emissive: 0, solid: true, drops: BLOCKS.DIRT },
    [BLOCKS.ACACIA_WOOD]:   { name: 'Acacia Wood',    health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.ACACIA_LEAVES]: { name: 'Acacia Leaves',  health: 1, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.MUD]:           { name: 'Mud',            health: 2, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.SWAMP_GRASS]:   { name: 'Swamp Grass',    health: 3, transparent: false, emissive: 0, solid: true, drops: BLOCKS.DIRT },
    [BLOCKS.SWAMP_WATER]:   { name: 'Swamp Water',    health: 0, transparent: true,  emissive: 0, solid: false, isLiquid: true, drops: null },
    [BLOCKS.ALIEN_SPORE_STEM]:{name: 'Spore Stem',    health: 4, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.ALIEN_SPORE_BLOCK]:{name:'Spore Block',   health: 2, transparent: false, emissive: 0.1, solid: true, drops: null },
    [BLOCKS.VINES]:         { name: 'Vines',          health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.TALL_GRASS]:    { name: 'Tall Grass',     health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.RED_FLOWER]:    { name: 'Red Flower',     health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.CACTUS]:        { name: 'Cactus',         health: 2, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.BLUE_FLOWER]:   { name: 'Blue Flower',    health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.YELLOW_FLOWER]: { name: 'Yellow Flower',  health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.FERN]:          { name: 'Fern',           health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null }
};

export function getBlockProperties(type) {
    return BLOCK_PROPS[type] || BLOCK_PROPS[BLOCKS.AIR];
}

export function getBlockName(type) {
    return (BLOCK_PROPS[type] || BLOCK_PROPS[BLOCKS.AIR]).name;
}

// Texture generation config
const TEX_SIZE = 16; // pixels per texture
const ATLAS_COLS = 8;
const BLOCK_COUNT = Object.keys(BLOCKS).length;
const ATLAS_ROWS = Math.ceil(BLOCK_COUNT / ATLAS_COLS);
export const ATLAS_SIZE = { cols: ATLAS_COLS, rows: ATLAS_ROWS, texSize: TEX_SIZE };

// ---- Pixel art texture generators ----

function fillBase(ctx, r, g, b) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
}

function addNoise(ctx, rng, intensity = 20) {
    const id = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = ((rng() - 0.5) * intensity) | 0;
        d[i] = Math.max(0, Math.min(255, d[i] + v));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v));
    }
    ctx.putImageData(id, 0, 0);
}

function addPixels(ctx, rng, color, count) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        ctx.fillRect((rng() * TEX_SIZE) | 0, (rng() * TEX_SIZE) | 0, 1, 1);
    }
}

function addStripes(ctx, rng, color, axis = 'h', count = 3) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        if (axis === 'h') {
            const y = (rng() * TEX_SIZE) | 0;
            ctx.fillRect(0, y, TEX_SIZE, 1);
        } else {
            const x = (rng() * TEX_SIZE) | 0;
            ctx.fillRect(x, 0, 1, TEX_SIZE);
        }
    }
}

function drawOreSpots(ctx, rng, color, count = 4) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        const x = (rng() * (TEX_SIZE - 2)) | 0;
        const y = (rng() * (TEX_SIZE - 2)) | 0;
        const s = 1 + ((rng() * 2) | 0);
        ctx.fillRect(x, y, s, s);
    }
}

function drawBricks(ctx, rng, mortarColor, brickVariation = 15) {
    const id = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
    const d = id.data;
    // Draw mortar lines
    ctx.fillStyle = mortarColor;
    for (let y = 0; y < TEX_SIZE; y += 4) {
        ctx.fillRect(0, y, TEX_SIZE, 1);
    }
    for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : 4;
        for (let x = offset; x < TEX_SIZE; x += 8) {
            ctx.fillRect(x, row * 4, 1, 4);
        }
    }
    addNoise(ctx, rng, brickVariation);
}

// Generate texture for a block type
function generateBlockTexture(ctx, blockType, face, rng) {
    switch (blockType) {
        case BLOCKS.GRASS:
            if (face === 'top') {
                fillBase(ctx, 114, 161, 69);
                addNoise(ctx, rng, 15);
                addPixels(ctx, rng, 'rgba(90, 130, 50, 0.8)', 20);
                addPixels(ctx, rng, 'rgba(130, 180, 80, 0.8)', 15);
            } else if (face === 'bottom') {
                fillBase(ctx, 134, 96, 67);
                addNoise(ctx, rng, 20);
                addPixels(ctx, rng, 'rgba(100, 70, 45, 0.6)', 15);
            } else {
                fillBase(ctx, 134, 96, 67);
                addNoise(ctx, rng, 20);
                const id = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
                const d = id.data;
                for (let y = 0; y < TEX_SIZE; y++) {
                    for (let x = 0; x < TEX_SIZE; x++) {
                        let isGrass = false;
                        if (y < 4) isGrass = true;
                        else if (y < 8) isGrass = (rng() > (y - 3) / 4);
                        if (isGrass) {
                            const i = (y * TEX_SIZE + x) * 4;
                            const v = ((rng() - 0.5) * 20) | 0;
                            d[i] = Math.max(0, Math.min(255, 114 + v));
                            d[i+1] = Math.max(0, Math.min(255, 161 + v));
                            d[i+2] = Math.max(0, Math.min(255, 69 + v));
                        } else if (y > 3 && y < 9) {
                            const aboveI = ((y - 1) * TEX_SIZE + x) * 4;
                            if (d[aboveI+1] > 120 && d[aboveI] < 125) {
                                const i = (y * TEX_SIZE + x) * 4;
                                d[i] = Math.max(0, d[i] - 30);
                                d[i+1] = Math.max(0, d[i+1] - 30);
                                d[i+2] = Math.max(0, d[i+2] - 30);
                            }
                        }
                    }
                }
                ctx.putImageData(id, 0, 0);
            }
            break;
        case BLOCKS.DIRT:
            fillBase(ctx, 134, 96, 67);
            addNoise(ctx, rng, 20);
            addPixels(ctx, rng, 'rgba(100, 70, 45, 0.7)', 30);
            addPixels(ctx, rng, 'rgba(150, 110, 80, 0.5)', 20);
            break;
        case BLOCKS.STONE:
            fillBase(ctx, 125, 125, 125);
            addNoise(ctx, rng, 15);
            addPixels(ctx, rng, 'rgba(90, 90, 90, 0.6)', 30);
            addPixels(ctx, rng, 'rgba(160, 160, 160, 0.5)', 20);
            break;
        case BLOCKS.SAND:
            fillBase(ctx, 219, 209, 160);
            addNoise(ctx, rng, 10);
            addPixels(ctx, rng, 'rgba(180, 170, 120, 0.8)', 30);
            addPixels(ctx, rng, 'rgba(240, 230, 180, 0.6)', 20);
            break;
        case BLOCKS.WATER:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(30, 80, 180, 0.65)';
            ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
            addNoise(ctx, rng, 10);
            break;
        case BLOCKS.WOOD:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 160, 130, 80);
                addNoise(ctx, rng, 15);
                const id = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
                const d = id.data;
                for (let y = 0; y < TEX_SIZE; y++) {
                    for (let x = 0; x < TEX_SIZE; x++) {
                        const dx = x - 7.5;
                        const dy = y - 7.5;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        const i = (y * TEX_SIZE + x) * 4;
                        if (dist > 7) {
                            d[i] = 70; d[i+1] = 50; d[i+2] = 30;
                        } else {
                            if (Math.abs(Math.sin(dist * 1.5)) > 0.7) {
                                d[i] = Math.max(0, d[i] - 30);
                                d[i+1] = Math.max(0, d[i+1] - 30);
                                d[i+2] = Math.max(0, d[i+2] - 20);
                            }
                        }
                    }
                }
                ctx.putImageData(id, 0, 0);
            } else {
                fillBase(ctx, 70, 50, 30);
                addNoise(ctx, rng, 10);
                ctx.fillStyle = 'rgba(40, 25, 15, 0.7)';
                for (let i = 0; i < 25; i++) {
                    const x = (rng() * TEX_SIZE) | 0;
                    const y = (rng() * TEX_SIZE) | 0;
                    const h = 4 + (rng() * 8) | 0;
                    ctx.fillRect(x, y, 1, h);
                }
                ctx.fillStyle = 'rgba(100, 75, 45, 0.6)';
                for (let i = 0; i < 20; i++) {
                    const x = (rng() * TEX_SIZE) | 0;
                    const y = (rng() * TEX_SIZE) | 0;
                    const h = 3 + (rng() * 6) | 0;
                    ctx.fillRect(x, y, 1, h);
                }
            }
            break;
        case BLOCKS.LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            fillBase(ctx, 40, 100, 30);
            addNoise(ctx, rng, 20);
            for (let i = 0; i < 45; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                ctx.clearRect(x, y, 1 + (rng() * 2)|0, 1 + (rng() * 2)|0);
            }
            ctx.fillStyle = 'rgba(70, 140, 50, 0.8)';
            for (let i = 0; i < 40; i++) {
                ctx.fillRect((rng() * TEX_SIZE) | 0, (rng() * TEX_SIZE) | 0, 1, 1);
            }
            break;
        case BLOCKS.PLANKS:
            fillBase(ctx, 160, 130, 75);
            addNoise(ctx, rng, 15);
            ctx.fillStyle = 'rgba(90, 65, 30, 0.7)';
            for (let x = 0; x < TEX_SIZE; x += 4) {
                ctx.fillRect(x, 0, 1, TEX_SIZE);
            }
            ctx.fillStyle = 'rgba(120, 90, 50, 0.5)';
            for (let i = 0; i < 40; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                const h = 2 + (rng() * 5) | 0;
                if (x % 4 !== 0) ctx.fillRect(x, y, 1, h);
            }
            ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
            for (let x = 2; x < TEX_SIZE; x += 4) {
                ctx.fillRect(x, 1, 1, 1);
                ctx.fillRect(x, TEX_SIZE - 2, 1, 1);
            }
            break;
        case BLOCKS.COBBLESTONE:
            fillBase(ctx, 100, 100, 100);
            addNoise(ctx, rng, 15);
            for (let y = 0; y < TEX_SIZE; y++) {
                for (let x = 0; x < TEX_SIZE; x++) {
                    const val = Math.sin(x * 0.8 + Math.cos(y * 0.8)) + Math.cos(y * 0.8);
                    if (val < -0.1) {
                        ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
                        ctx.fillRect(x, y, 1, 1);
                    } else if (val > 1.1) {
                        ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
                        ctx.fillRect(x, y, 1, 1);
                    } else if (val < 0.2 && rng() > 0.5) {
                        ctx.fillStyle = 'rgba(70, 70, 70, 0.8)';
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
            break;
        case BLOCKS.IRON_ORE:
            fillBase(ctx, 128, 128, 128);
            addNoise(ctx, rng, 16);
            drawOreSpots(ctx, rng, 'rgba(200, 180, 160, 0.9)', 5);
            break;
        case BLOCKS.GOLD_ORE:
            fillBase(ctx, 128, 128, 128);
            addNoise(ctx, rng, 16);
            drawOreSpots(ctx, rng, 'rgba(255, 220, 50, 0.9)', 5);
            break;
        case BLOCKS.CRYSTAL_ORE:
            fillBase(ctx, 100, 100, 120);
            addNoise(ctx, rng, 14);
            drawOreSpots(ctx, rng, 'rgba(180, 100, 255, 0.9)', 6);
            drawOreSpots(ctx, rng, 'rgba(220, 160, 255, 0.6)', 3);
            break;
        case BLOCKS.MANA_ORE:
            fillBase(ctx, 90, 100, 130);
            addNoise(ctx, rng, 14);
            drawOreSpots(ctx, rng, 'rgba(50, 150, 255, 0.9)', 6);
            drawOreSpots(ctx, rng, 'rgba(100, 200, 255, 0.6)', 3);
            break;
        case BLOCKS.OBSIDIAN:
            fillBase(ctx, 20, 15, 30);
            addNoise(ctx, rng, 8);
            addPixels(ctx, rng, 'rgba(40,20,60,0.5)', 10);
            addPixels(ctx, rng, 'rgba(60,30,80,0.2)', 5);
            break;
        case BLOCKS.GLOWSTONE:
            fillBase(ctx, 200, 180, 80);
            addNoise(ctx, rng, 20);
            addPixels(ctx, rng, 'rgba(255,240,120,0.5)', 15);
            addPixels(ctx, rng, 'rgba(180,160,60,0.4)', 8);
            break;
        case BLOCKS.DUNGEON_BRICK:
            fillBase(ctx, 60, 55, 70);
            drawBricks(ctx, rng, 'rgba(40,38,50,0.7)', 12);
            addPixels(ctx, rng, 'rgba(80,70,90,0.3)', 5);
            break;
        case BLOCKS.DUNGEON_FLOOR:
            fillBase(ctx, 50, 48, 55);
            addNoise(ctx, rng, 12);
            // Tile pattern
            ctx.fillStyle = 'rgba(35,33,40,0.5)';
            ctx.fillRect(0, 0, TEX_SIZE, 1);
            ctx.fillRect(0, 8, TEX_SIZE, 1);
            ctx.fillRect(0, 0, 1, TEX_SIZE);
            ctx.fillRect(8, 0, 1, TEX_SIZE);
            break;
        case BLOCKS.MUSHROOM_STEM:
            fillBase(ctx, 200, 190, 170);
            addNoise(ctx, rng, 10);
            addStripes(ctx, rng, 'rgba(180,170,150,0.4)', 'h', 3);
            break;
        case BLOCKS.MUSHROOM_CAP:
            fillBase(ctx, 180, 40, 40);
            addNoise(ctx, rng, 15);
            addPixels(ctx, rng, 'rgba(255,255,255,0.7)', 4);
            break;
        case BLOCKS.ALIEN_STONE:
            fillBase(ctx, 50, 70, 80);
            addNoise(ctx, rng, 15);
            addPixels(ctx, rng, 'rgba(30,100,100,0.4)', 8);
            addPixels(ctx, rng, 'rgba(80,120,100,0.2)', 5);
            break;
        case BLOCKS.ALIEN_GRASS:
            if (face === 'top') {
                fillBase(ctx, 40, 180, 140);
                addNoise(ctx, rng, 18);
                addPixels(ctx, rng, 'rgba(80,220,180,0.4)', 10);
            } else if (face === 'bottom') {
                fillBase(ctx, 50, 70, 80);
                addNoise(ctx, rng, 12);
            } else {
                fillBase(ctx, 50, 70, 80);
                addNoise(ctx, rng, 10);
                ctx.fillStyle = 'rgba(40,180,140,0.8)';
                ctx.fillRect(0, 0, TEX_SIZE, 3);
            }
            break;
        case BLOCKS.ALIEN_CRYSTAL:
            fillBase(ctx, 120, 60, 200);
            addNoise(ctx, rng, 18);
            addPixels(ctx, rng, 'rgba(200,150,255,0.6)', 10);
            addPixels(ctx, rng, 'rgba(255,200,255,0.3)', 5);
            break;
        case BLOCKS.SNOW:
            fillBase(ctx, 235, 245, 255);
            addNoise(ctx, rng, 8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            for (let i = 0; i < 30; i++) {
                ctx.fillRect((rng() * TEX_SIZE) | 0, (rng() * TEX_SIZE) | 0, 1, 1);
            }
            ctx.fillStyle = 'rgba(210, 225, 240, 0.8)';
            for (let i = 0; i < 20; i++) {
                ctx.fillRect((rng() * TEX_SIZE) | 0, (rng() * TEX_SIZE) | 0, 1, 1);
            }
            break;
        case BLOCKS.ICE:
            fillBase(ctx, 160, 210, 240);
            addNoise(ctx, rng, 10);
            ctx.fillStyle = 'rgba(200,230,255,0.3)';
            ctx.fillRect((rng() * 12) | 0, 0, 2, TEX_SIZE);
            ctx.fillRect(0, (rng() * 12) | 0, TEX_SIZE, 2);
            break;
        case BLOCKS.LAVA:
            fillBase(ctx, 200, 60, 10);
            addNoise(ctx, rng, 25);
            addPixels(ctx, rng, 'rgba(255,120,20,0.6)', 10);
            addPixels(ctx, rng, 'rgba(255,200,50,0.4)', 6);
            addPixels(ctx, rng, 'rgba(150,30,0,0.5)', 8);
            break;
        case BLOCKS.PORTAL_FRAME:
            fillBase(ctx, 30, 20, 50);
            addNoise(ctx, rng, 10);
            drawOreSpots(ctx, rng, 'rgba(130,80,255,0.7)', 6);
            addPixels(ctx, rng, 'rgba(180,120,255,0.4)', 5);
            break;
        case BLOCKS.PORTAL:
            fillBase(ctx, 80, 20, 180);
            addNoise(ctx, rng, 20);
            addPixels(ctx, rng, 'rgba(160,80,255,0.5)', 15);
            addPixels(ctx, rng, 'rgba(200,150,255,0.3)', 10);
            break;
        case BLOCKS.BEDROCK:
            fillBase(ctx, 40, 40, 40);
            addNoise(ctx, rng, 20);
            addPixels(ctx, rng, 'rgba(25,25,25,0.5)', 15);
            addPixels(ctx, rng, 'rgba(60,60,60,0.3)', 8);
            break;
        case BLOCKS.GRAVEL:
            fillBase(ctx, 130, 125, 120);
            addNoise(ctx, rng, 22);
            addPixels(ctx, rng, 'rgba(110,105,100,0.5)', 12);
            addPixels(ctx, rng, 'rgba(150,145,140,0.4)', 8);
            break;
        case BLOCKS.CLAY:
            fillBase(ctx, 155, 145, 140);
            addNoise(ctx, rng, 10);
            break;
        case BLOCKS.GLASS:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(180, 210, 230, 0.2)';
            ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
            // Edge highlight
            ctx.fillStyle = 'rgba(200,230,255,0.7)';
            ctx.fillRect(0, 0, TEX_SIZE, 1);
            ctx.fillRect(0, 0, 1, TEX_SIZE);
            ctx.fillRect(TEX_SIZE-1, 0, 1, TEX_SIZE);
            ctx.fillRect(0, TEX_SIZE-1, TEX_SIZE, 1);
            break;
        case BLOCKS.TORCH:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#6b4f2c'; // stick
            ctx.fillRect(6, 4, 4, 12);
            ctx.fillStyle = '#ffaa00'; // flame
            ctx.fillRect(6, 2, 4, 4);
            ctx.fillStyle = '#ffee00'; // hot flame
            ctx.fillRect(7, 3, 2, 2);
            break;
        case BLOCKS.SANDSTONE:
            fillBase(ctx, 220, 205, 155);
            addNoise(ctx, rng, 15);
            if (face === 'side') {
                addStripes(ctx, rng, 'rgba(190, 175, 125, 0.5)', 'h', 4);
            }
            break;
        case BLOCKS.RED_SAND:
            fillBase(ctx, 180, 80, 30);
            addNoise(ctx, rng, 12);
            addPixels(ctx, rng, 'rgba(150, 60, 20, 0.4)', 8);
            break;
        case BLOCKS.TERRACOTTA:
            fillBase(ctx, 160, 90, 50);
            addNoise(ctx, rng, 5);
            break;
        case BLOCKS.DEAD_BUSH:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.strokeStyle = '#8c603b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 16); ctx.lineTo(8, 6);
            ctx.moveTo(8, 12); ctx.lineTo(4, 4);
            ctx.moveTo(8, 10); ctx.lineTo(12, 5);
            ctx.moveTo(8, 8); ctx.lineTo(10, 3);
            ctx.stroke();
            break;
        case BLOCKS.ALIEN_TALL_GRASS:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
            ctx.fillRect(7, 4, 2, 12);
            ctx.fillStyle = 'rgba(255, 100, 200, 0.9)';
            ctx.beginPath(); ctx.arc(8, 4, 3, 0, Math.PI*2); ctx.fill();
            break;
        case BLOCKS.SAVANNA_GRASS:
            if (face === 'top') {
                fillBase(ctx, 160, 150, 60); // Dry yellow/green
                addNoise(ctx, rng, 20);
                addPixels(ctx, rng, 'rgba(120,110,40,0.8)', 15);
            } else if (face === 'bottom') {
                fillBase(ctx, 100, 65, 45);
                addNoise(ctx, rng, 20);
            } else {
                fillBase(ctx, 100, 65, 45);
                addNoise(ctx, rng, 15);
                ctx.fillStyle = 'rgba(160,150,60,0.9)';
                for (let x = 0; x < TEX_SIZE; x++) {
                    const h = 4 + (rng() * 4) | 0;
                    ctx.fillRect(x, 0, 1, h);
                }
            }
            break;
        case BLOCKS.ACACIA_WOOD:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 160, 90, 50); // Orange-ish inner
                addNoise(ctx, rng, 10);
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(8, 8, 3, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI*2); ctx.stroke();
            } else {
                fillBase(ctx, 100, 95, 90); // Gray bark
                addNoise(ctx, rng, 10);
                addStripes(ctx, rng, 'rgba(70,65,60,0.5)', 'v', 3);
            }
            break;
        case BLOCKS.ACACIA_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            fillBase(ctx, 90, 130, 40); // Olive green
            addNoise(ctx, rng, 15);
            addPixels(ctx, rng, 'rgba(0,0,0,0)', 50); // transparent holes
            break;
        case BLOCKS.MUD:
            fillBase(ctx, 70, 50, 40);
            addNoise(ctx, rng, 10);
            break;
        case BLOCKS.SWAMP_GRASS:
            if (face === 'top') {
                fillBase(ctx, 70, 90, 40); // Dark murky green
                addNoise(ctx, rng, 20);
                addPixels(ctx, rng, 'rgba(50,70,30,0.8)', 15);
            } else if (face === 'bottom') {
                fillBase(ctx, 70, 50, 40); // Mud bottom
                addNoise(ctx, rng, 10);
            } else {
                fillBase(ctx, 70, 50, 40);
                addNoise(ctx, rng, 10);
                ctx.fillStyle = 'rgba(70,90,40,0.9)';
                for (let x = 0; x < TEX_SIZE; x++) {
                    const h = 4 + (rng() * 4) | 0;
                    ctx.fillRect(x, 0, 1, h);
                }
            }
            break;
        case BLOCKS.SWAMP_WATER:
            fillBase(ctx, 40, 80, 60);
            ctx.fillStyle = 'rgba(30,60,40,0.5)';
            ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
            addNoise(ctx, rng, 10);
            break;
        case BLOCKS.ALIEN_SPORE_STEM:
            fillBase(ctx, 50, 120, 60);
            addNoise(ctx, rng, 20);
            addStripes(ctx, rng, 'rgba(30,90,40,0.6)', 'v', 4);
            break;
        case BLOCKS.ALIEN_SPORE_BLOCK:
            fillBase(ctx, 150, 40, 180);
            addNoise(ctx, rng, 30);
            drawOreSpots(ctx, rng, 'rgba(255,100,255,0.8)', 6);
            break;
        case BLOCKS.VINES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(40, 90, 30, 0.9)';
            for (let i = 0; i < 6; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const h = 8 + (rng() * 8) | 0;
                ctx.fillRect(x, 0, 2, h);
            }
            break;
        case BLOCKS.TALL_GRASS:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.strokeStyle = 'rgba(60, 160, 45, 0.9)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 8; i++) {
                const x = 2 + (rng() * 12) | 0;
                const h = 6 + (rng() * 8) | 0;
                const curveDir = rng() > 0.5 ? 2 : -2;
                ctx.beginPath();
                ctx.moveTo(x, TEX_SIZE);
                ctx.quadraticCurveTo(x + curveDir/2, TEX_SIZE - h/2, x + curveDir, TEX_SIZE - h);
                ctx.stroke();
            }
            break;
        case BLOCKS.RED_FLOWER:
        case BLOCKS.BLUE_FLOWER:
        case BLOCKS.YELLOW_FLOWER:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(60, 160, 45, 0.9)';
            ctx.fillRect(7, 8, 2, 8); // stem
            ctx.fillStyle = blockType === BLOCKS.RED_FLOWER ? '#ff3333' : 
                            (blockType === BLOCKS.BLUE_FLOWER ? '#3333ff' : '#ffff33');
            ctx.beginPath();
            ctx.arc(8, 6, 4, 0, Math.PI*2);
            ctx.fill();
            break;
        case BLOCKS.FERN:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.strokeStyle = 'rgba(50, 140, 40, 0.9)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(8, TEX_SIZE);
                ctx.quadraticCurveTo(8 + (i%2===0?-5:5), TEX_SIZE - 4 - i*2, 8 + (i%2===0?-8:8), TEX_SIZE - 8 - i*2);
                ctx.stroke();
            }
            break;
        case BLOCKS.CACTUS:
            fillBase(ctx, 40, 120, 40);
            addNoise(ctx, rng, 15);
            addStripes(ctx, rng, 'rgba(20, 80, 20, 0.6)', 'v', 4);
            addPixels(ctx, rng, 'rgba(0, 0, 0, 0.8)', 20); // Spikes
            break;
        default:
            fillBase(ctx, 255, 0, 255);
            break;
    }
}

function hasFaceVariants(blockType) {
    return [
        BLOCKS.GRASS, BLOCKS.WOOD, BLOCKS.MUSHROOM_STEM, BLOCKS.SAVANNA_GRASS, BLOCKS.ACACIA_WOOD, BLOCKS.SWAMP_GRASS, BLOCKS.ALIEN_GRASS
    ].includes(blockType);
}

// Build the atlas: for face-variant blocks, store 3 rows (top, side, bottom)
// For uniform blocks, store 1 texture and use the same UV for all faces
export function createTextureAtlas() {
    // Calculate atlas layout
    // Each block gets at most 3 faces (top, side, bottom)
    // We lay them out linearly
    const entries = []; // { blockType, face, col, row }
    let col = 0, row = 0;

    const uvMap = {}; // blockType -> { top: {u,v}, side: {u,v}, bottom: {u,v} }

    for (const key of Object.keys(BLOCKS)) {
        const bt = BLOCKS[key];
        if (bt === BLOCKS.AIR) continue;

        if (hasFaceVariants(bt)) {
            // Top
            uvMap[bt] = {};
            for (const face of ['top', 'side', 'bottom']) {
                entries.push({ blockType: bt, face, col, row });
                uvMap[bt][face] = { col, row };
                col++;
                if (col >= ATLAS_COLS) { col = 0; row++; }
            }
        } else {
            entries.push({ blockType: bt, face: 'all', col, row });
            uvMap[bt] = { top: { col, row }, side: { col, row }, bottom: { col, row } };
            col++;
            if (col >= ATLAS_COLS) { col = 0; row++; }
        }
    }

    const totalRows = row + (col > 0 ? 1 : 0);
    const atlasW = ATLAS_COLS * TEX_SIZE;
    const atlasH = totalRows * TEX_SIZE;

    const canvas = document.createElement('canvas');
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    // Temp canvas for per-texture generation
    const tmp = document.createElement('canvas');
    tmp.width = TEX_SIZE;
    tmp.height = TEX_SIZE;
    const tmpCtx = tmp.getContext('2d', { willReadFrequently: true });
    tmpCtx.imageSmoothingEnabled = false;

    const rng = seededRandom(42);

    for (const entry of entries) {
        tmpCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
        generateBlockTexture(tmpCtx, entry.blockType, entry.face === 'all' ? 'side' : entry.face, rng);
        ctx.drawImage(tmp, entry.col * TEX_SIZE, entry.row * TEX_SIZE);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    // UV helper: returns u,v coordinates (0-1) and size for a face
    const uUnit = 1 / ATLAS_COLS;
    const vUnit = 1 / totalRows;

    function getUV(blockType, face) {
        const map = uvMap[blockType];
        if (!map) return { u: 0, v: 0, uSize: uUnit, vSize: vUnit }; // fallback
        let faceKey = 'side';
        if (face === 'top' || face === 'py') faceKey = 'top';
        else if (face === 'bottom' || face === 'ny') faceKey = 'bottom';
        const entry = map[faceKey] || map.side || map.top;
        return {
            u: entry.col * uUnit,
            v: 1 - (entry.row + 1) * vUnit, // flip Y for Three.js
            uSize: uUnit,
            vSize: vUnit
        };
    }

    // Generate small icon canvases for inventory display
    function getBlockIcon(blockType) {
        const SCALE = 4; // Upscale for crisp isometric rendering
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = TEX_SIZE * 2 * SCALE;
        iconCanvas.height = TEX_SIZE * 2 * SCALE;
        const iconCtx = iconCanvas.getContext('2d', { willReadFrequently: true });
        iconCtx.imageSmoothingEnabled = false;
        
        const props = getBlockProperties(blockType);
        
        if (props.isCross) {
            // Flat 2D for cross models
            const tmp = document.createElement('canvas');
            tmp.width = TEX_SIZE; tmp.height = TEX_SIZE;
            const tmpCtx = tmp.getContext('2d');
            tmpCtx.imageSmoothingEnabled = false;
            generateBlockTexture(tmpCtx, blockType, 'side', seededRandom(blockType * 1000 + 77));
            iconCtx.drawImage(tmp, 0, 0, TEX_SIZE, TEX_SIZE, (TEX_SIZE/2)*SCALE, (TEX_SIZE/2)*SCALE, TEX_SIZE*SCALE, TEX_SIZE*SCALE);
            return iconCanvas;
        }

        // Generate 3 faces
        const top = document.createElement('canvas'); top.width = TEX_SIZE; top.height = TEX_SIZE;
        const side1 = document.createElement('canvas'); side1.width = TEX_SIZE; side1.height = TEX_SIZE;
        const side2 = document.createElement('canvas'); side2.width = TEX_SIZE; side2.height = TEX_SIZE;
        
        generateBlockTexture(top.getContext('2d'), blockType, 'top', seededRandom(blockType * 1000 + 77));
        generateBlockTexture(side1.getContext('2d'), blockType, 'side', seededRandom(blockType * 1000 + 78));
        generateBlockTexture(side2.getContext('2d'), blockType, 'side', seededRandom(blockType * 1000 + 79));

        // Darken faces for 3D effect
        const s2Ctx = side2.getContext('2d');
        s2Ctx.fillStyle = 'rgba(0,0,0,0.4)';
        s2Ctx.fillRect(0,0,TEX_SIZE,TEX_SIZE);
        
        const s1Ctx = side1.getContext('2d');
        s1Ctx.fillStyle = 'rgba(0,0,0,0.15)';
        s1Ctx.fillRect(0,0,TEX_SIZE,TEX_SIZE);

        // Upscale canvases to prevent anti-aliasing blur during transform
        const topScaled = document.createElement('canvas'); topScaled.width = TEX_SIZE * SCALE; topScaled.height = TEX_SIZE * SCALE;
        const tCtx = topScaled.getContext('2d'); tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(top, 0, 0, TEX_SIZE, TEX_SIZE, 0, 0, TEX_SIZE * SCALE, TEX_SIZE * SCALE);

        const side1Scaled = document.createElement('canvas'); side1Scaled.width = TEX_SIZE * SCALE; side1Scaled.height = TEX_SIZE * SCALE;
        const s1sCtx = side1Scaled.getContext('2d'); s1sCtx.imageSmoothingEnabled = false;
        s1sCtx.drawImage(side1, 0, 0, TEX_SIZE, TEX_SIZE, 0, 0, TEX_SIZE * SCALE, TEX_SIZE * SCALE);

        const side2Scaled = document.createElement('canvas'); side2Scaled.width = TEX_SIZE * SCALE; side2Scaled.height = TEX_SIZE * SCALE;
        const s2sCtx = side2Scaled.getContext('2d'); s2sCtx.imageSmoothingEnabled = false;
        s2sCtx.drawImage(side2, 0, 0, TEX_SIZE, TEX_SIZE, 0, 0, TEX_SIZE * SCALE, TEX_SIZE * SCALE);

        iconCtx.save();
        
        // Top face
        iconCtx.setTransform(1, 0.5, -1, 0.5, TEX_SIZE * SCALE, 0);
        iconCtx.drawImage(topScaled, 0, 0);

        // Left face
        iconCtx.setTransform(1, 0.5, 0, 1, 0, TEX_SIZE * SCALE * 0.5);
        iconCtx.drawImage(side1Scaled, 0, 0);

        // Right face
        iconCtx.setTransform(1, -0.5, 0, 1, TEX_SIZE * SCALE, TEX_SIZE * SCALE);
        iconCtx.drawImage(side2Scaled, 0, 0);
        
        iconCtx.restore();

        return iconCanvas;
    }

    return { texture, getUV, atlasW, atlasH, totalRows, getBlockIcon };
}
