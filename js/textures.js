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
    FERN: 52,
    WHITE_FLOWER: 53,
    CHERRY_LOG: 54,
    CHERRY_LEAVES: 55,
    PINK_PETALS: 56,
    AUTUMN_WOOD: 57,
    AUTUMN_LEAVES: 58,
    FALLEN_LEAVES: 59,
    GLOW_STEM: 60,
    GLOW_LEAVES: 61,
    GLOW_SHROOM: 62,
    PALM_WOOD: 63,
    PALM_LEAVES: 64,
    OASIS_FERN: 65,
    DUNGEON_FIRE_BRICK: 66,
    DUNGEON_FIRE_FLOOR: 67,
    DUNGEON_ICE_BRICK: 68,
    DUNGEON_ICE_FLOOR: 69,
    DUNGEON_JUNGLE_BRICK: 70,
    DUNGEON_JUNGLE_FLOOR: 71,
    DUNGEON_DESERT_BRICK: 72,
    DUNGEON_DESERT_FLOOR: 73,
    DUNGEON_UNDEAD_BRICK: 74,
    DUNGEON_UNDEAD_FLOOR: 75,
    DUNGEON_DOOR: 76,
    BOSS_SPAWNER: 77,
    COAL_ORE: 78,
    DIAMOND_ORE: 79,
    STONE_BRICKS: 80,
    BRICKS: 81,
    BOOKSHELF: 82,
    MOSSY_COBBLESTONE: 83,
    CHEST_BLOCK: 84,
    LADDER: 85,
    IRON_BLOCK: 86,
    GOLD_BLOCK: 87,
    DIAMOND_BLOCK: 88,
    WOOL: 89,
    FURNACE: 90,
    NETHERRACK: 91,
    SOUL_SAND: 92,
    NETHER_BRICKS: 93,
    CRIMSON_NYLIUM: 94,
    CRIMSON_STEM: 95,
    CRIMSON_LEAVES: 96,
    NETHER_WART_BLOCK: 97
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
    [BLOCKS.FERN]:          { name: 'Fern',           health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.WHITE_FLOWER]:  { name: 'White Flower',   health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.CHERRY_LOG]:    { name: 'Cherry Log',     health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.CHERRY_LEAVES]: { name: 'Cherry Leaves',  health: 1, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.PINK_PETALS]:   { name: 'Pink Petals',    health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.AUTUMN_WOOD]:   { name: 'Autumn Wood',    health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.AUTUMN_LEAVES]: { name: 'Autumn Leaves',  health: 1, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.FALLEN_LEAVES]: { name: 'Fallen Leaves',  health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.GLOW_STEM]:     { name: 'Glow Stem',      health: 4, transparent: false, emissive: 0.2, solid: true, drops: null },
    [BLOCKS.GLOW_LEAVES]:   { name: 'Glow Leaves',    health: 1, transparent: true,  emissive: 0.5, solid: true, drops: null },
    [BLOCKS.GLOW_SHROOM]:   { name: 'Glow Shroom',    health: 1, transparent: true,  emissive: 0.8, solid: false, isCross: true, drops: null },
    [BLOCKS.PALM_WOOD]:     { name: 'Palm Wood',      health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.PALM_LEAVES]:   { name: 'Palm Leaves',    health: 1, transparent: true,  emissive: 0, solid: true, drops: null },
    [BLOCKS.OASIS_FERN]:    { name: 'Oasis Fern',     health: 1, transparent: true,  emissive: 0, solid: false, isCross: true, drops: null },
    [BLOCKS.DUNGEON_FIRE_BRICK]: { name: 'Fire Brick', health: 12, transparent: false, emissive: 0.1, solid: true, drops: null },
    [BLOCKS.DUNGEON_FIRE_FLOOR]: { name: 'Fire Floor', health: 12, transparent: false, emissive: 0.2, solid: true, drops: null },
    [BLOCKS.DUNGEON_ICE_BRICK]:  { name: 'Ice Brick',  health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_ICE_FLOOR]:  { name: 'Ice Floor',  health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_JUNGLE_BRICK]:{name: 'Jungle Brick',health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_JUNGLE_FLOOR]:{name: 'Jungle Floor',health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_DESERT_BRICK]:{name: 'Desert Brick',health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_DESERT_FLOOR]:{name: 'Desert Floor',health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_UNDEAD_BRICK]:{name: 'Undead Brick',health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_UNDEAD_FLOOR]:{name: 'Undead Floor',health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DUNGEON_DOOR]:  { name: 'Dungeon Door',   health: 5, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.BOSS_SPAWNER]:  { name: 'Boss Spawner',   health: Infinity, transparent: true, emissive: 0, solid: false, drops: null },
    [BLOCKS.COAL_ORE]:      { name: 'Coal Ore',       health: 6, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.DIAMOND_ORE]:   { name: 'Diamond Ore',    health: 10, transparent: false, emissive: 0.2, solid: true, drops: null },
    [BLOCKS.STONE_BRICKS]:  { name: 'Stone Bricks',   health: 7, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.BRICKS]:        { name: 'Bricks',         health: 8, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.BOOKSHELF]:     { name: 'Bookshelf',      health: 4, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.MOSSY_COBBLESTONE]:{ name: 'Mossy Cobble', health: 6, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.CHEST_BLOCK]:   { name: 'Chest',          health: 4, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.LADDER]:        { name: 'Ladder',         health: 2, transparent: true,  emissive: 0, solid: false, isCross: true, isClimbable: true, drops: null },
    [BLOCKS.IRON_BLOCK]:    { name: 'Iron Block',     health: 10, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.GOLD_BLOCK]:    { name: 'Gold Block',     health: 10, transparent: false, emissive: 0.1, solid: true, drops: null },
    [BLOCKS.DIAMOND_BLOCK]: { name: 'Diamond Block',  health: 12, transparent: false, emissive: 0.2, solid: true, drops: null },
    [BLOCKS.WOOL]:          { name: 'Wool',           health: 2, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.FURNACE]:       { name: 'Furnace',        health: 6, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.NETHERRACK]:    { name: 'Netherrack',     health: 3, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.SOUL_SAND]:     { name: 'Soul Sand',      health: 3, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.NETHER_BRICKS]: { name: 'Nether Bricks',  health: 12, transparent: false, emissive: 0, solid: true, drops: null },
    [BLOCKS.CRIMSON_NYLIUM]:{ name: 'Crimson Nylium', health: 4, transparent: false, emissive: 0, solid: true, drops: 91 }, // drops netherrack
    [BLOCKS.CRIMSON_STEM]:  { name: 'Crimson Stem',   health: 5, transparent: false, emissive: 0, solid: true, drops: null }, // Will make it drop custom wood in drops logic if needed
    [BLOCKS.CRIMSON_LEAVES]:{ name: 'Crimson Leaves', health: 1, transparent: true, emissive: 0, solid: true, drops: null },
    [BLOCKS.NETHER_WART_BLOCK]: { name: 'Nether Wart Block', health: 2, transparent: false, emissive: 0, solid: true, drops: null }
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

function addRings(ctx, rng, ringColor, borderColor = 'rgba(60, 45, 25, 0.9)') {
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(TEX_SIZE/2, TEX_SIZE/2, 3, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(TEX_SIZE/2, TEX_SIZE/2, 6, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, TEX_SIZE, TEX_SIZE);
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
                const id = ctx.createImageData(TEX_SIZE, TEX_SIZE);
                for (let i = 0; i < id.data.length; i += 4) {
                    let r = 114, g = 80, b = 56;
                    const noise = (rng() - 0.5) * 35;
                    id.data[i] = Math.min(255, Math.max(0, r + noise));
                    id.data[i+1] = Math.min(255, Math.max(0, g + noise));
                    id.data[i+2] = Math.min(255, Math.max(0, b + noise));
                    id.data[i+3] = 255;
                }
                ctx.putImageData(id, 0, 0);
            } else {
                // Exact Grass Side Mask (classic pattern)
                const grassMask = [
                    "GGGGGGGGGGGGGGGG",
                    "GGGGGGGGGGGGGGGG",
                    "GGGGGGGGGGGGGGGG",
                    "GGGGGGGGGGGGGGGG",
                    "GGGGGGGDGGGGGGGD",
                    "GDGGGGGDDGGGGDGD",
                    "GDDGGDDDDGDGDDDD",
                    "DDDDGDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD",
                    "DDDDDDDDDDDDDDDD"
                ];

                const id = ctx.createImageData(TEX_SIZE, TEX_SIZE);
                const d = id.data;

                for (let y = 0; y < TEX_SIZE; y++) {
                    for (let x = 0; x < TEX_SIZE; x++) {
                        const i = (y * TEX_SIZE + x) * 4;
                        const isGrass = grassMask[y][x] === 'G';

                        let r, g, b;
                        if (isGrass) {
                            // Grass base color matching image
                            r = 106; g = 158; b = 59;
                        } else {
                            // Dirt base color matching image
                            r = 114; g = 80; b = 56;
                        }

                        // Add distinct blocky noise
                        const noise = (rng() - 0.5) * 35;
                        r = Math.min(255, Math.max(0, r + noise));
                        g = Math.min(255, Math.max(0, g + noise));
                        b = Math.min(255, Math.max(0, b + noise));

                        // If dirt and right under grass, add a tiny bit of shadow
                        if (!isGrass && y > 0 && grassMask[y-1][x] === 'G') {
                            r *= 0.8; g *= 0.8; b *= 0.8;
                        }

                        d[i] = r;
                        d[i+1] = g;
                        d[i+2] = b;
                        d[i+3] = 255;
                    }
                }
                ctx.putImageData(id, 0, 0);
            }
            break;
        case BLOCKS.DIRT:
            const dirtId = ctx.createImageData(TEX_SIZE, TEX_SIZE);
            for (let i = 0; i < dirtId.data.length; i += 4) {
                let r = 114, g = 80, b = 56;
                const noise = (rng() - 0.5) * 35;
                dirtId.data[i] = Math.min(255, Math.max(0, r + noise));
                dirtId.data[i+1] = Math.min(255, Math.max(0, g + noise));
                dirtId.data[i+2] = Math.min(255, Math.max(0, b + noise));
                dirtId.data[i+3] = 255;
            }
            ctx.putImageData(dirtId, 0, 0);
            break;
        case BLOCKS.STONE:
            fillBase(ctx, 125, 125, 125);
            addNoise(ctx, rng, 15);
            addPixels(ctx, rng, 'rgba(90, 90, 90, 0.6)', 30);
            addPixels(ctx, rng, 'rgba(160, 160, 160, 0.5)', 20);
            break;
        case BLOCKS.SAND:
            const sandId = ctx.createImageData(TEX_SIZE, TEX_SIZE);
            for (let i = 0; i < sandId.data.length; i += 4) {
                let r = 225, g = 215, b = 170;
                const noise = (rng() - 0.5) * 25;
                sandId.data[i] = Math.min(255, Math.max(0, r + noise));
                sandId.data[i+1] = Math.min(255, Math.max(0, g + noise));
                sandId.data[i+2] = Math.min(255, Math.max(0, b + noise));
                sandId.data[i+3] = 255;
            }
            ctx.putImageData(sandId, 0, 0);
            // Add a few larger grain specs for detail
            addPixels(ctx, rng, 'rgba(190, 180, 130, 0.8)', 15);
            addPixels(ctx, rng, 'rgba(250, 240, 200, 0.6)', 15);
            break;
        case BLOCKS.WATER:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(30, 80, 180, 0.65)';
            ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
            addNoise(ctx, rng, 10);
            break;
        case BLOCKS.WOOD:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 160, 130, 80); // Lighter inner wood
                addNoise(ctx, rng, 15);
                // Draw rings
                ctx.strokeStyle = 'rgba(120, 90, 50, 0.8)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(8, 8, 3, 0, Math.PI*2); ctx.stroke();
                ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI*2); ctx.stroke();
                // Draw bark border
                ctx.strokeStyle = 'rgba(60, 45, 25, 0.9)';
                ctx.lineWidth = 2;
                ctx.strokeRect(0, 0, TEX_SIZE, TEX_SIZE);
            } else {
                fillBase(ctx, 80, 60, 35); // Darker brown bark base
                addNoise(ctx, rng, 10);
                // Vertical bark stripes
                ctx.fillStyle = 'rgba(40, 25, 15, 0.8)'; // Dark crevices
                for (let x = 0; x < TEX_SIZE; x += 2 + (rng()*2)|0) {
                    ctx.fillRect(x, 0, 1, TEX_SIZE);
                }
                ctx.fillStyle = 'rgba(100, 75, 45, 0.7)'; // Lighter ridges
                for (let x = 1; x < TEX_SIZE; x += 3 + (rng()*2)|0) {
                    ctx.fillRect(x, 0, 1, TEX_SIZE);
                }
                // Break up stripes slightly
                ctx.fillStyle = 'rgba(60, 40, 20, 0.5)';
                for (let i = 0; i < 30; i++) {
                    const x = (rng() * TEX_SIZE) | 0;
                    const y = (rng() * TEX_SIZE) | 0;
                    ctx.fillRect(x, y, 2, 2);
                }
            }
            break;
        case BLOCKS.LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            fillBase(ctx, 25, 80, 20); // Darker base green
            addNoise(ctx, rng, 20);
            
            // Random leafy clusters
            for (let i = 0; i < 80; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                const shade = rng();
                if (shade < 0.3) {
                    ctx.fillStyle = 'rgba(15, 60, 15, 0.9)'; // deep shadow
                } else if (shade < 0.6) {
                    ctx.fillStyle = 'rgba(50, 120, 35, 0.9)'; // midtone
                } else {
                    ctx.fillStyle = 'rgba(80, 160, 50, 0.9)'; // highlight
                }
                const w = 1 + (rng() * 2) | 0;
                const h = 1 + (rng() * 2) | 0;
                ctx.fillRect(x, y, w, h);
            }
            
            // Very small transparent gaps (makes it dense but still slightly see-through)
            for (let i = 0; i < 40; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                ctx.clearRect(x, y, 1, 1);
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
            // Draw stone borders
            ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
            for (let y = 0; y < TEX_SIZE; y++) {
                for (let x = 0; x < TEX_SIZE; x++) {
                    const cx = (x + (y % 6 > 2 ? 3 : 0)) % 5;
                    const cy = y % 4;
                    if (cx === 0 || cy === 0 || (rng() < 0.05)) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
            // Add highlights
            ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
            for (let y = 0; y < TEX_SIZE; y++) {
                for (let x = 0; x < TEX_SIZE; x++) {
                    const cx = (x + (y % 6 > 2 ? 3 : 0)) % 5;
                    const cy = y % 4;
                    if (cx === 1 && cy === 1 && rng() < 0.8) {
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
            ctx.fillStyle = 'rgba(35,33,40,0.5)';
            ctx.fillRect(0, 0, TEX_SIZE, 1);
            ctx.fillRect(0, 8, TEX_SIZE, 1);
            ctx.fillRect(0, 0, 1, TEX_SIZE);
            ctx.fillRect(8, 0, 1, TEX_SIZE);
            break;
        case BLOCKS.DUNGEON_FIRE_BRICK:
            fillBase(ctx, 90, 30, 20);
            drawBricks(ctx, rng, 'rgba(50,15,10,0.8)', 15);
            break;
        case BLOCKS.DUNGEON_FIRE_FLOOR:
            fillBase(ctx, 80, 25, 15); addNoise(ctx, rng, 10);
            ctx.fillStyle = 'rgba(40,10,5,0.6)'; ctx.fillRect(0,0,TEX_SIZE,1); ctx.fillRect(0,8,TEX_SIZE,1); ctx.fillRect(0,0,1,TEX_SIZE); ctx.fillRect(8,0,1,TEX_SIZE);
            break;
        case BLOCKS.DUNGEON_ICE_BRICK:
            fillBase(ctx, 120, 180, 220);
            drawBricks(ctx, rng, 'rgba(80,120,160,0.8)', 10);
            break;
        case BLOCKS.DUNGEON_ICE_FLOOR:
            fillBase(ctx, 110, 160, 200); addNoise(ctx, rng, 10);
            ctx.fillStyle = 'rgba(60,100,140,0.6)'; ctx.fillRect(0,0,TEX_SIZE,1); ctx.fillRect(0,8,TEX_SIZE,1); ctx.fillRect(0,0,1,TEX_SIZE); ctx.fillRect(8,0,1,TEX_SIZE);
            break;
        case BLOCKS.DUNGEON_JUNGLE_BRICK:
            fillBase(ctx, 50, 70, 50);
            drawBricks(ctx, rng, 'rgba(25,45,25,0.8)', 15);
            break;
        case BLOCKS.DUNGEON_JUNGLE_FLOOR:
            fillBase(ctx, 40, 60, 40); addNoise(ctx, rng, 10);
            ctx.fillStyle = 'rgba(20,35,20,0.6)'; ctx.fillRect(0,0,TEX_SIZE,1); ctx.fillRect(0,8,TEX_SIZE,1); ctx.fillRect(0,0,1,TEX_SIZE); ctx.fillRect(8,0,1,TEX_SIZE);
            break;
        case BLOCKS.DUNGEON_DESERT_BRICK:
            fillBase(ctx, 180, 160, 100);
            drawBricks(ctx, rng, 'rgba(120,100,60,0.8)', 12);
            break;
        case BLOCKS.DUNGEON_DESERT_FLOOR:
            fillBase(ctx, 160, 140, 80); addNoise(ctx, rng, 10);
            ctx.fillStyle = 'rgba(100,80,40,0.6)'; ctx.fillRect(0,0,TEX_SIZE,1); ctx.fillRect(0,8,TEX_SIZE,1); ctx.fillRect(0,0,1,TEX_SIZE); ctx.fillRect(8,0,1,TEX_SIZE);
            break;
        case BLOCKS.DUNGEON_UNDEAD_BRICK:
            fillBase(ctx, 40, 40, 45);
            drawBricks(ctx, rng, 'rgba(20,20,25,0.9)', 18);
            break;
        case BLOCKS.DUNGEON_UNDEAD_FLOOR:
            fillBase(ctx, 35, 35, 40); addNoise(ctx, rng, 10);
            ctx.fillStyle = 'rgba(15,15,20,0.6)'; ctx.fillRect(0,0,TEX_SIZE,1); ctx.fillRect(0,8,TEX_SIZE,1); ctx.fillRect(0,0,1,TEX_SIZE); ctx.fillRect(8,0,1,TEX_SIZE);
            break;
        case BLOCKS.DUNGEON_DOOR:
            fillBase(ctx, 40, 40, 45); // Dark stone base
            addNoise(ctx, rng, 8);
            
            // Outer stone border
            ctx.fillStyle = 'rgba(20, 20, 25, 0.8)';
            ctx.fillRect(0, 0, TEX_SIZE, 2);
            ctx.fillRect(0, 0, 2, TEX_SIZE);
            ctx.fillRect(TEX_SIZE - 2, 0, 2, TEX_SIZE);
            ctx.fillRect(0, TEX_SIZE - 2, TEX_SIZE, 2);
            
            // Glowing magical runes / seal
            ctx.fillStyle = 'rgba(255, 50, 50, 0.6)';
            ctx.fillRect(6, 6, 4, 4);
            ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
            ctx.fillRect(7, 7, 2, 2);
            
            // Crossbars
            ctx.fillStyle = 'rgba(15, 15, 20, 0.9)';
            ctx.fillRect(0, 7, TEX_SIZE, 2);
            ctx.fillRect(7, 0, 2, TEX_SIZE);
            break;
        case BLOCKS.BOSS_SPAWNER:
            ctx.clearRect(0,0,TEX_SIZE,TEX_SIZE); // Invisible
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
                addNoise(ctx, rng, 20);
                const id = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
                const d = id.data;
                const blades = [];
                for (let x = 0; x < TEX_SIZE; x++) blades.push(3 + (rng() * 6) | 0);
                for (let y = 0; y < TEX_SIZE; y++) {
                    for (let x = 0; x < TEX_SIZE; x++) {
                        let isGrass = false;
                        if (y < blades[x]) {
                            isGrass = true;
                            if (y > 3 && rng() > 0.8) isGrass = false;
                        }
                        if (isGrass) {
                            const i = (y * TEX_SIZE + x) * 4;
                            const v = ((rng() - 0.5) * 30) | 0;
                            d[i] = Math.max(0, Math.min(255, 160 + v));
                            d[i+1] = Math.max(0, Math.min(255, 150 + v));
                            d[i+2] = Math.max(0, Math.min(255, 60 + v));
                        } else if (y > 0) {
                            const aboveI = ((y - 1) * TEX_SIZE + x) * 4;
                            if (d[aboveI+1] > 120 && d[aboveI] < 170) {
                                const i = (y * TEX_SIZE + x) * 4;
                                d[i] = Math.max(0, d[i] - 40);
                                d[i+1] = Math.max(0, d[i+1] - 40);
                                d[i+2] = Math.max(0, d[i+2] - 40);
                            }
                        }
                    }
                }
                ctx.putImageData(id, 0, 0);
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
            addNoise(ctx, rng, 30);
            for (let i = 0; i < 70; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                ctx.clearRect(x, y, 2, 2);
            }
            ctx.fillStyle = 'rgba(110, 150, 50, 0.9)';
            for (let i = 0; i < 40; i++) {
                ctx.fillRect((rng() * TEX_SIZE) | 0, (rng() * TEX_SIZE) | 0, 1, 1);
            }
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
                addNoise(ctx, rng, 20);
                const id = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
                const d = id.data;
                const blades = [];
                for (let x = 0; x < TEX_SIZE; x++) blades.push(3 + (rng() * 6) | 0);
                for (let y = 0; y < TEX_SIZE; y++) {
                    for (let x = 0; x < TEX_SIZE; x++) {
                        let isGrass = false;
                        if (y < blades[x]) {
                            isGrass = true;
                            if (y > 3 && rng() > 0.8) isGrass = false;
                        }
                        if (isGrass) {
                            const i = (y * TEX_SIZE + x) * 4;
                            const v = ((rng() - 0.5) * 30) | 0;
                            d[i] = Math.max(0, Math.min(255, 70 + v));
                            d[i+1] = Math.max(0, Math.min(255, 90 + v));
                            d[i+2] = Math.max(0, Math.min(255, 40 + v));
                        } else if (y > 0) {
                            const aboveI = ((y - 1) * TEX_SIZE + x) * 4;
                            if (d[aboveI+1] > 75 && d[aboveI] < 100) { 
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
            ctx.fillStyle = '#3ca02d'; // Mid green
            // Blade 1
            ctx.fillRect(4, 15, 1, 1); ctx.fillRect(4, 14, 1, 1);
            ctx.fillRect(3, 13, 1, 1); ctx.fillRect(3, 12, 1, 1);
            ctx.fillRect(2, 11, 1, 1);
            // Blade 2
            ctx.fillRect(7, 15, 2, 1); ctx.fillRect(7, 13, 1, 2);
            ctx.fillRect(8, 10, 1, 3); ctx.fillRect(9, 7, 1, 3);
            // Blade 3
            ctx.fillRect(11, 15, 1, 1); ctx.fillRect(11, 14, 1, 1);
            ctx.fillRect(12, 13, 1, 1); ctx.fillRect(12, 12, 1, 1);
            ctx.fillRect(13, 11, 1, 1);
            // Highlights
            ctx.fillStyle = '#55c044';
            ctx.fillRect(8, 11, 1, 1); ctx.fillRect(8, 14, 1, 1);
            ctx.fillRect(3, 12, 1, 1); ctx.fillRect(12, 12, 1, 1);
            // Shadows
            ctx.fillStyle = '#2e8020';
            ctx.fillRect(7, 14, 1, 2); ctx.fillRect(8, 15, 1, 1);
            ctx.fillRect(4, 15, 1, 1); ctx.fillRect(11, 15, 1, 1);
            break;
        case BLOCKS.RED_FLOWER:
        case BLOCKS.BLUE_FLOWER:
        case BLOCKS.YELLOW_FLOWER:
        case BLOCKS.WHITE_FLOWER:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#3ca02d'; // Stem
            ctx.fillRect(7, 9, 2, 7);
            ctx.fillRect(6, 12, 1, 1);
            ctx.fillRect(9, 13, 1, 1);
            // Flower head
            if (blockType === BLOCKS.RED_FLOWER) ctx.fillStyle = '#ff2222';
            if (blockType === BLOCKS.BLUE_FLOWER) ctx.fillStyle = '#2266ff';
            if (blockType === BLOCKS.YELLOW_FLOWER) ctx.fillStyle = '#ffee22';
            if (blockType === BLOCKS.WHITE_FLOWER) ctx.fillStyle = '#ffffff';
            ctx.fillRect(6, 5, 4, 4);
            ctx.fillRect(7, 4, 2, 1);
            ctx.fillRect(5, 6, 1, 2);
            ctx.fillRect(10, 6, 1, 2);
            if (blockType === BLOCKS.WHITE_FLOWER) ctx.fillStyle = '#eeeeee';
            else ctx.fillStyle = '#ddaa00'; // center
            ctx.fillRect(7, 6, 2, 2);
            break;
        case BLOCKS.FERN:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#3ca02d'; // Base green
            // Central stem
            ctx.fillRect(7, 8, 2, 8);
            // Fronds left
            ctx.fillRect(5, 10, 2, 1);
            ctx.fillRect(3, 9, 2, 1);
            ctx.fillRect(5, 13, 2, 1);
            ctx.fillRect(4, 12, 1, 1);
            // Fronds right
            ctx.fillRect(9, 11, 2, 1);
            ctx.fillRect(11, 10, 2, 1);
            ctx.fillRect(9, 14, 2, 1);
            ctx.fillRect(11, 13, 1, 1);
            // Highlight
            ctx.fillStyle = '#55c044';
            ctx.fillRect(7, 8, 1, 8); // Stem highlight
            ctx.fillRect(6, 10, 1, 1);
            ctx.fillRect(4, 9, 1, 1);
            ctx.fillRect(10, 11, 1, 1);
            ctx.fillRect(12, 10, 1, 1);
            // Shadows
            ctx.fillStyle = '#2e8020';
            ctx.fillRect(8, 10, 1, 6); // Inner stem shadow
            ctx.fillRect(5, 14, 2, 1); ctx.fillRect(9, 15, 2, 1);
            break;
        case BLOCKS.CACTUS:
            fillBase(ctx, 40, 120, 40);
            addNoise(ctx, rng, 15);
            addStripes(ctx, rng, 'rgba(20, 80, 20, 0.6)', 'v', 4);
            addPixels(ctx, rng, 'rgba(0, 0, 0, 0.8)', 20); // Spikes
            break;
        case BLOCKS.CHERRY_LOG:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 220, 180, 190);
                addRings(ctx, rng, 'rgba(200, 150, 160, 0.8)');
            } else {
                fillBase(ctx, 60, 40, 40);
                addNoise(ctx, rng, 10);
                addStripes(ctx, rng, 'rgba(40, 25, 25, 0.5)', 'v', 3);
            }
            break;
        case BLOCKS.CHERRY_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            // Draw leafy clusters instead of solid background
            for (let i = 0; i < 150; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                const shade = rng();
                if (shade < 0.3) {
                    ctx.fillStyle = 'rgba(230, 140, 160, 0.9)'; // deep shadow pink
                } else if (shade < 0.6) {
                    ctx.fillStyle = 'rgba(255, 170, 190, 0.9)'; // midtone pink
                } else {
                    ctx.fillStyle = 'rgba(255, 200, 220, 0.9)'; // highlight pink
                }
                const w = 1 + (rng() * 2) | 0;
                const h = 1 + (rng() * 2) | 0;
                ctx.fillRect(x, y, w, h);
            }
            break;
        case BLOCKS.PINK_PETALS:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#ffb3cc';
            ctx.fillRect(4, 14, 2, 1);
            ctx.fillRect(9, 15, 3, 1);
            ctx.fillRect(11, 13, 2, 1);
            ctx.fillRect(2, 12, 2, 1);
            ctx.fillStyle = '#ff80aa';
            ctx.fillRect(5, 14, 1, 1);
            ctx.fillRect(10, 15, 1, 1);
            break;
        case BLOCKS.AUTUMN_WOOD:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 160, 130, 90);
                addRings(ctx, rng, 'rgba(120, 90, 60, 0.8)');
            } else {
                fillBase(ctx, 100, 70, 40);
                addNoise(ctx, rng, 15);
                addStripes(ctx, rng, 'rgba(60, 40, 20, 0.6)', 'v', 4);
            }
            break;
        case BLOCKS.AUTUMN_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            for (let i = 0; i < 150; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                const shade = rng();
                if (shade < 0.3) {
                    ctx.fillStyle = 'rgba(180, 60, 10, 0.9)'; // deep shadow orange/red
                } else if (shade < 0.6) {
                    ctx.fillStyle = 'rgba(220, 100, 20, 0.9)'; // midtone orange
                } else {
                    ctx.fillStyle = 'rgba(255, 150, 40, 0.9)'; // highlight yellow/orange
                }
                const w = 1 + (rng() * 2) | 0;
                const h = 1 + (rng() * 2) | 0;
                ctx.fillRect(x, y, w, h);
            }
            break;
        case BLOCKS.FALLEN_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#dd6611';
            ctx.fillRect(3, 14, 2, 1);
            ctx.fillRect(10, 15, 2, 1);
            ctx.fillRect(7, 13, 3, 1);
            ctx.fillStyle = '#ff9900';
            ctx.fillRect(4, 14, 1, 1);
            ctx.fillRect(11, 15, 1, 1);
            ctx.fillRect(8, 13, 1, 1);
            break;
        case BLOCKS.GLOW_STEM:
            fillBase(ctx, 20, 60, 60);
            addNoise(ctx, rng, 10);
            addStripes(ctx, rng, 'rgba(10, 200, 200, 0.4)', 'v', 5); // glowing lines
            break;
        case BLOCKS.GLOW_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            for (let i = 0; i < 150; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                const shade = rng();
                if (shade < 0.3) {
                    ctx.fillStyle = 'rgba(5, 80, 80, 0.9)'; // deep shadow
                } else if (shade < 0.6) {
                    ctx.fillStyle = 'rgba(10, 120, 120, 0.9)'; // midtone
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.9)'; // glowing spots
                }
                const w = 1 + (rng() * 2) | 0;
                const h = 1 + (rng() * 2) | 0;
                ctx.fillRect(x, y, w, h);
            }
            break;
        case BLOCKS.GLOW_SHROOM:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#118888'; // Stem
            ctx.fillRect(7, 8, 2, 8);
            ctx.fillStyle = '#00ffff'; // Glowing cap
            ctx.fillRect(5, 5, 6, 3);
            ctx.fillRect(4, 6, 8, 2);
            ctx.fillStyle = '#aaffff'; // Highlights
            ctx.fillRect(6, 5, 2, 1);
            break;
        case BLOCKS.PALM_WOOD:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 200, 170, 130);
                addRings(ctx, rng, 'rgba(160, 130, 90, 0.8)');
            } else {
                fillBase(ctx, 150, 120, 80);
                addNoise(ctx, rng, 15);
                addStripes(ctx, rng, 'rgba(100, 80, 50, 0.6)', 'h', 6); // Palm trees have horizontal lines
            }
            break;
        case BLOCKS.PALM_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            for (let i = 0; i < 150; i++) {
                const x = (rng() * TEX_SIZE) | 0;
                const y = (rng() * TEX_SIZE) | 0;
                const shade = rng();
                if (shade < 0.3) {
                    ctx.fillStyle = 'rgba(30, 90, 30, 0.9)'; // deep shadow
                } else if (shade < 0.6) {
                    ctx.fillStyle = 'rgba(80, 180, 60, 0.9)'; // midtone
                } else {
                    ctx.fillStyle = 'rgba(110, 210, 80, 0.9)'; // highlight
                }
                const w = 1 + (rng() * 2) | 0;
                const h = 1 + (rng() * 2) | 0;
                ctx.fillRect(x, y, w, h);
            }
            break;
        case BLOCKS.OASIS_FERN:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = '#22cc44'; // Bright oasis green
            ctx.fillRect(7, 6, 2, 10); // Central stem
            ctx.fillRect(5, 8, 2, 1); // Large fronds
            ctx.fillRect(9, 8, 2, 1);
            ctx.fillRect(4, 11, 3, 1);
            ctx.fillRect(9, 11, 3, 1);
            ctx.fillRect(3, 14, 4, 1);
            ctx.fillRect(9, 14, 4, 1);
            ctx.fillStyle = '#66ff88'; // Highlight
            ctx.fillRect(7, 6, 1, 10);
            ctx.fillRect(6, 8, 1, 1);
            ctx.fillRect(5, 11, 1, 1);
            break;
        case BLOCKS.COAL_ORE:
            fillBase(ctx, 128, 128, 128);
            addNoise(ctx, rng, 16);
            drawOreSpots(ctx, rng, 'rgba(25, 25, 25, 0.95)', 7);
            drawOreSpots(ctx, rng, 'rgba(10, 10, 10, 0.7)', 3);
            break;
        case BLOCKS.DIAMOND_ORE:
            fillBase(ctx, 128, 128, 128);
            addNoise(ctx, rng, 16);
            drawOreSpots(ctx, rng, 'rgba(50, 220, 220, 0.95)', 5);
            drawOreSpots(ctx, rng, 'rgba(100, 255, 240, 0.6)', 3);
            break;
        case BLOCKS.STONE_BRICKS:
            fillBase(ctx, 130, 130, 130);
            drawBricks(ctx, rng, 'rgb(100,100,100)', 10);
            break;
        case BLOCKS.BRICKS:
            fillBase(ctx, 160, 80, 60);
            drawBricks(ctx, rng, 'rgb(180,170,155)', 12);
            break;
        case BLOCKS.BOOKSHELF:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 160, 130, 80);
                addNoise(ctx, rng, 15);
                addStripes(ctx, rng, 'rgba(100, 70, 40, 0.4)', 'v', 4);
            } else {
                fillBase(ctx, 80, 50, 30); // dark back
                // books
                const colors = ['#d32f2f', '#388e3c', '#1976d2', '#fbc02d', '#7b1fa2', '#795548', '#ffffff'];
                for (let row = 0; row < 2; row++) {
                    const y = row * 8 + 1;
                    ctx.fillStyle = '#6d4c41'; // shelf
                    ctx.fillRect(0, y + 6, TEX_SIZE, 1);
                    
                    let xOffset = 1;
                    for (let b = 0; b < 4; b++) {
                        const bw = 2 + (rng() * 2 | 0);
                        if (xOffset + bw > 14) break;
                        ctx.fillStyle = colors[(rng() * colors.length) | 0];
                        ctx.fillRect(xOffset, y, bw, 6);
                        ctx.fillStyle = 'rgba(0,0,0,0.3)';
                        ctx.fillRect(xOffset, y+2, bw, 1);
                        xOffset += bw + 1;
                    }
                }
            }
            break;
        case BLOCKS.MOSSY_COBBLESTONE:
            fillBase(ctx, 120, 120, 120);
            addNoise(ctx, rng, 20);
            addPixels(ctx, rng, 'rgba(80, 80, 80, 0.7)', 30);
            addPixels(ctx, rng, 'rgba(60, 120, 40, 0.8)', 25);
            addPixels(ctx, rng, 'rgba(40, 100, 30, 0.6)', 20);
            break;
        case BLOCKS.CHEST_BLOCK:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 140, 90, 40);
                addNoise(ctx, rng, 10);
                ctx.strokeStyle = 'rgba(60, 40, 15, 0.8)';
                ctx.strokeRect(1, 1, 14, 14);
            } else {
                fillBase(ctx, 160, 110, 50);
                addNoise(ctx, rng, 10);
                ctx.strokeStyle = 'rgba(60, 40, 15, 0.8)';
                ctx.strokeRect(1, 1, 14, 14);
                
                if (face === 'front') {
                    // latch only on front
                    ctx.fillStyle = '#111';
                    ctx.fillRect(7, 4, 2, 4);
                    ctx.fillStyle = '#ccc';
                    ctx.fillRect(7, 5, 2, 1);
                }
            }
            break;
        case BLOCKS.LADDER:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgb(120, 80, 40)';
            ctx.fillRect(2, 0, 2, TEX_SIZE); // left rail
            ctx.fillRect(12, 0, 2, TEX_SIZE); // right rail
            for (let y = 2; y < TEX_SIZE; y += 4) {
                ctx.fillRect(4, y, 8, 2); // rungs
            }
            addNoise(ctx, rng, 10);
            break;
        case BLOCKS.IRON_BLOCK:
            fillBase(ctx, 210, 210, 210);
            addNoise(ctx, rng, 5);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.strokeRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
            ctx.strokeRect(1, 1, TEX_SIZE-1, TEX_SIZE-1);
            break;
        case BLOCKS.GOLD_BLOCK:
            fillBase(ctx, 250, 200, 50);
            addNoise(ctx, rng, 10);
            ctx.fillStyle = '#fff9c4';
            ctx.fillRect(1, 1, 4, 1);
            ctx.fillRect(1, 1, 1, 4);
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.6)';
            ctx.strokeRect(0, 0, TEX_SIZE, TEX_SIZE);
            break;
        case BLOCKS.DIAMOND_BLOCK:
            fillBase(ctx, 80, 220, 220);
            addNoise(ctx, rng, 15);
            ctx.fillStyle = '#e0f7fa';
            ctx.fillRect(1, 1, 3, 3);
            ctx.fillStyle = '#006064';
            ctx.fillRect(12, 12, 3, 3);
            ctx.strokeStyle = '#26c6da';
            ctx.strokeRect(0, 0, TEX_SIZE, TEX_SIZE);
            break;
        case BLOCKS.WOOL:
            fillBase(ctx, 235, 235, 235);
            addNoise(ctx, rng, 10);
            addPixels(ctx, rng, 'rgba(200, 200, 200, 0.5)', 40);
            break;
        case BLOCKS.FURNACE:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 110, 110, 110);
                addNoise(ctx, rng, 15);
            } else {
                fillBase(ctx, 120, 120, 120);
                addNoise(ctx, rng, 15);
                ctx.strokeStyle = 'rgba(80, 80, 80, 0.9)';
                ctx.strokeRect(0, 0, TEX_SIZE, TEX_SIZE);
                ctx.strokeRect(2, 2, 12, 12);
                
                if (face === 'front') {
                    // fire pit only on front
                    ctx.fillStyle = '#222';
                    ctx.fillRect(4, 8, 8, 5);
                    addPixels(ctx, rng, 'rgba(255, 100, 0, 0.8)', 6);
                    addPixels(ctx, rng, 'rgba(255, 200, 0, 0.9)', 3);
                }
            }
            break;
        case BLOCKS.NETHERRACK:
            fillBase(ctx, 110, 30, 30);
            addNoise(ctx, rng, 20);
            addPixels(ctx, rng, 'rgba(80, 20, 20, 0.8)', 30);
            addPixels(ctx, rng, 'rgba(150, 40, 40, 0.6)', 30);
            break;
        case BLOCKS.SOUL_SAND:
            fillBase(ctx, 80, 50, 40);
            addNoise(ctx, rng, 15);
            addPixels(ctx, rng, 'rgba(60, 30, 20, 0.8)', 40);
            // Draw some "faces"
            ctx.fillStyle = 'rgba(40, 20, 10, 0.8)';
            for(let i=0; i<3; i++) {
                let fx = Math.floor(rng() * 12);
                let fy = Math.floor(rng() * 12);
                ctx.fillRect(fx, fy, 1, 2);
                ctx.fillRect(fx+2, fy, 1, 2);
                ctx.fillRect(fx+1, fy+2, 1, 1);
            }
            break;
        case BLOCKS.NETHER_BRICKS:
            fillBase(ctx, 60, 20, 25);
            drawBricks(ctx, rng, 'rgba(30, 10, 15, 0.9)', 5);
            break;
        case BLOCKS.CRIMSON_NYLIUM:
            if (face === 'top') {
                fillBase(ctx, 140, 20, 20);
                addNoise(ctx, rng, 20);
                addPixels(ctx, rng, 'rgba(180, 40, 40, 0.8)', 30);
            } else if (face === 'bottom') {
                fillBase(ctx, 110, 30, 30); // Netherrack
                addNoise(ctx, rng, 20);
            } else {
                // Side
                fillBase(ctx, 110, 30, 30); // Netherrack bottom
                addNoise(ctx, rng, 20);
                ctx.fillStyle = 'rgba(140, 20, 20, 0.9)'; // Nylium top
                for(let x=0; x<TEX_SIZE; x++) {
                    let h = 4 + Math.floor(rng() * 4);
                    ctx.fillRect(x, 0, 1, h);
                }
            }
            break;
        case BLOCKS.CRIMSON_STEM:
            if (face === 'top' || face === 'bottom') {
                fillBase(ctx, 100, 30, 40);
                // rings
                ctx.strokeStyle = 'rgba(130, 40, 50, 0.8)';
                ctx.beginPath();
                ctx.arc(8, 8, 3, 0, Math.PI*2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(8, 8, 6, 0, Math.PI*2);
                ctx.stroke();
            } else {
                fillBase(ctx, 80, 20, 30);
                addStripes(ctx, rng, 'rgba(60, 15, 20, 0.6)', 'vertical', 6);
                addNoise(ctx, rng, 10);
            }
            break;
        case BLOCKS.CRIMSON_LEAVES:
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            ctx.fillStyle = 'rgba(150, 0, 0, 0.9)';
            for(let i=0; i<80; i++) {
                ctx.fillRect(Math.floor(rng()*16), Math.floor(rng()*16), 2, 2);
            }
            break;
        case BLOCKS.NETHER_WART_BLOCK:
            fillBase(ctx, 110, 0, 0);
            addNoise(ctx, rng, 25);
            addPixels(ctx, rng, 'rgba(80, 0, 0, 0.8)', 40);
            break;
        default:
            fillBase(ctx, 255, 0, 255);
            break;
    }
}
function hasFaceVariants(blockType) {
    return [
        BLOCKS.GRASS, BLOCKS.WOOD, BLOCKS.MUSHROOM_STEM, BLOCKS.SAVANNA_GRASS, BLOCKS.ACACIA_WOOD, BLOCKS.SWAMP_GRASS, BLOCKS.ALIEN_GRASS, BLOCKS.PORTAL_FRAME, BLOCKS.CHERRY_LOG, BLOCKS.AUTUMN_WOOD, BLOCKS.PALM_WOOD,
        BLOCKS.BOOKSHELF, BLOCKS.CHEST_BLOCK, BLOCKS.FURNACE, BLOCKS.CRIMSON_NYLIUM, BLOCKS.CRIMSON_STEM
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
            for (const face of ['top', 'side', 'bottom', 'front']) {
                entries.push({ blockType: bt, face, col, row });
                uvMap[bt][face] = { col, row };
                col++;
                if (col >= ATLAS_COLS) { col = 0; row++; }
            }
        } else {
            entries.push({ blockType: bt, face: 'all', col, row });
            uvMap[bt] = { top: { col, row }, side: { col, row }, bottom: { col, row }, front: { col, row } };
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

    const animatedFrames = [];

    for (const entry of entries) {
        tmpCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
        generateBlockTexture(tmpCtx, entry.blockType, entry.face === 'all' ? 'side' : entry.face, rng);
        ctx.drawImage(tmp, entry.col * TEX_SIZE, entry.row * TEX_SIZE);

        if (entry.blockType === BLOCKS.WATER || entry.blockType === BLOCKS.LAVA || entry.blockType === BLOCKS.SWAMP_WATER) {
            const fCanvas = document.createElement('canvas');
            fCanvas.width = TEX_SIZE; fCanvas.height = TEX_SIZE;
            fCanvas.getContext('2d').drawImage(tmp, 0, 0);
            animatedFrames.push({
                x: entry.col * TEX_SIZE,
                y: entry.row * TEX_SIZE,
                canvas: fCanvas
            });
        }
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
        else if (face === 'front' || face === 'pz') faceKey = 'front';
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

    function updateAnimatedTextures(time) {
        if (animatedFrames.length === 0) return;
        // Slow down update rate to prevent constant GPU texture upload lag
        const shift = Math.floor(time * 0.001) % TEX_SIZE;
        if (texture.userData.lastShift === shift) return;
        texture.userData.lastShift = shift;

        for (const frame of animatedFrames) {
            tmpCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            tmpCtx.drawImage(frame.canvas, 0, shift);
            tmpCtx.drawImage(frame.canvas, 0, shift - TEX_SIZE);
            ctx.drawImage(tmp, frame.x, frame.y);
        }
        texture.needsUpdate = true;
    }

    return { texture, getUV, atlasW, atlasH, totalRows, getBlockIcon, updateAnimatedTextures };
}

// ----------------------------------------------------
// Procedural Item Pixel Art Generator
// ----------------------------------------------------
export function generateItemTexture(itemType, itemSubtype) {
    const TEX_SIZE = 16;
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');
    
    // Clear transparent
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

    const palettes = {
        'wood': { c: '#8d6e63', d: '#5d4037', h: '#a1887f' },
        'stone': { c: '#9e9e9e', d: '#616161', h: '#e0e0e0' },
        'iron_ingot': { c: '#e0e0e0', d: '#9e9e9e', h: '#ffffff' },
        'gold_ingot': { c: '#fbc02d', d: '#f57f17', h: '#fff176' },
        'diamond': { c: '#00bcd4', d: '#00838f', h: '#84ffff' },
        'coal': { c: '#212121', d: '#000000', h: '#424242' },
        'mana_crystal': { c: '#03a9f4', d: '#01579b', h: '#b3e5fc' },
        'boss': { c: '#aa00ff', d: '#5500aa', h: '#d580ff' },
        'stick': { c: '#795548', d: '#4e342e', h: '#a1887f' },
        'wand_basic': { c: '#795548', d: '#4e342e', g: '#e0e0e0' },
        'wand_fire': { c: '#795548', d: '#4e342e', g: '#ff3d00' },
        'wand_ice': { c: '#795548', d: '#4e342e', g: '#00b0ff' },
        'wand_nature': { c: '#795548', d: '#4e342e', g: '#00e676' },
        'spell_fire': { c: '#ff3d00', d: '#dd2c00', h: '#ff9e80' },
        'spell_ice': { c: '#00b0ff', d: '#0091ea', h: '#80d8ff' },
        'spell_nature': { c: '#00e676', d: '#00c853', h: '#b9f6ca' },
        'spell_basic': { c: '#e0e0e0', d: '#9e9e9e', h: '#ffffff' }
    };

    // Helper to determine material tier from subtype
    let matName = 'iron_ingot';
    if (itemSubtype.includes('wood')) matName = 'wood';
    if (itemSubtype.includes('stone') || itemSubtype.includes('cobble')) matName = 'stone';
    if (itemSubtype.includes('iron')) matName = 'iron_ingot';
    if (itemSubtype.includes('gold')) matName = 'gold_ingot';
    if (itemSubtype.includes('diamond')) matName = 'diamond';
    if (itemSubtype.includes('boss')) matName = 'boss';

    let p = palettes[matName] || palettes['iron_ingot'];
    
    // Override palette for specific material items
    if (itemType === 'material') {
        p = palettes[itemSubtype] || p;
    } else if (itemType === 'wand') {
        p = palettes[itemSubtype] || palettes['wand_basic'];
    }

    const drawGrid = (grid) => {
        for (let y = 0; y < grid.length; y++) {
            const row = grid[y];
            for (let x = 0; x < row.length; x++) {
                const char = row[x];
                if (char === ' ') continue;
                if (char === 'C') ctx.fillStyle = p.c; // core
                else if (char === 'D') ctx.fillStyle = p.d; // dark
                else if (char === 'H') ctx.fillStyle = p.h; // highlight
                else if (char === 'S') ctx.fillStyle = palettes.stick.c; // stick
                else if (char === 'T') ctx.fillStyle = palettes.stick.d; // stick dark
                else if (char === 'G') ctx.fillStyle = p.g || p.h; // glow/gem
                else if (char === 'B') ctx.fillStyle = '#000000'; // black border
                else if (char === 'O') ctx.fillStyle = '#222222'; // outline
                else continue;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    };

    let shape = [];

    if (itemType === 'equipment') {
        if (itemSubtype.includes('sword')) {
            shape = [
                "            OBO ",
                "           OBHBO",
                "          OBHCBO",
                "         OBHCBO ",
                "        OBHCBO  ",
                "       OBHCBO   ",
                "      OBHCBO    ",
                "     OBHCBO     ",
                "  OOOBHCBO      ",
                " OSSDDCBO       ",
                "OSSSSDOO        ",
                "OSSSDSO         ",
                " OODOO          ",
                " OOO            ",
                "                ",
                "                "
            ];
        } else if (itemSubtype.includes('pickaxe')) {
            shape = [
                "      OOOOOO    ",
                "    OOOBHHHDOO  ",
                "  OOBHCBCCCCDDO ",
                "  OBCBOOOOOSSDO ",
                "  ODO     OSSO  ",
                "  OO      OSSO  ",
                "         OSSO   ",
                "         OSSO   ",
                "        OSSO    ",
                "        OSSO    ",
                "       OSSO     ",
                "       OSSO     ",
                "      OSSO      ",
                "      OSSO      ",
                "       OO       ",
                "                "
            ];
        } else if (itemSubtype.includes('axe')) {
            shape = [
                "     OOOO       ",
                "    OBHHDO      ",
                "   OBHCCDDO     ",
                "   OBCCOSDO     ",
                "   OBCOSSO      ",
                "   ODOSSO       ",
                "   OOSSO        ",
                "    OSSO        ",
                "    OSSO        ",
                "   OSSO         ",
                "   OSSO         ",
                "  OSSO          ",
                "  OSSO          ",
                "   OO           ",
                "                ",
                "                "
            ];
        } else if (itemSubtype.includes('head')) {
            shape = [
                "                ",
                "   OOOOOOOOOO   ",
                "  OOHHHHHHHHDO  ",
                "  OHCCCCCCCCDO  ",
                " OHCCOOOOAOCDDO ",
                " OHCO     AOCDO ",
                " OHD       ADOO ",
                " OHO       AOO  ",
                " OOO       AA   ",
                "                ",
                "                ",
                "                ",
                "                ",
                "                ",
                "                ",
                "                "
            ];
        } else if (itemSubtype.includes('chest')) {
            shape = [
                "   OO      OO   ",
                "  OHDO    OHDO  ",
                " OHCCOOOOOCCCDO ",
                " OHCCHHHHHHCDDO ",
                " OHCCCCCCCCCDDO ",
                " OHCCOOOOAOCDDO ",
                " OHD      AODDO ",
                " OHO OOOOAO ODO ",
                " OOO OHCCDO OOO ",
                "     OHCCDO     ",
                "     OHCCDO     ",
                "     ODDDDO     ",
                "      OOOO      ",
                "                ",
                "                ",
                "                "
            ];
        } else if (itemSubtype.includes('legs')) {
            shape = [
                "                ",
                "  OOOOOOOOOOOO  ",
                " OOHHHHHHHHHHDO ",
                " OHCCCCCCCCCDDO ",
                " OHCCCCCCCCCDDO ",
                " OHCCCCDDCCCCDO ",
                " OHCDDOAOHCCDDO ",
                " OHDO  AO ODCDO ",
                " OHO   AO  ODOO ",
                " OHO   AO  ODOO ",
                " OHO   AO  ODOO ",
                " OHO   AO  ODOO ",
                " OHO   AO  ODOO ",
                " OOO   AO  OOOO ",
                "                ",
                "                "
            ];
        } else if (itemSubtype.includes('boots')) {
            shape = [
                "                ",
                "                ",
                "                ",
                "                ",
                "                ",
                "                ",
                "                ",
                " OOOO      OOOO ",
                " OHCO      OHCO ",
                " OHDO      OHDO ",
                " OHDO      OHDO ",
                " OHDO      OHDO ",
                " OHCDOOOO OHCDDO",
                " ODDDDDDO ODDDDD",
                " OOOOOOOO OOOOOO",
                "                "
            ];
        }
    } else if (itemType === 'material') {
        if (itemSubtype === 'coal' || itemSubtype === 'diamond' || itemSubtype === 'mana_crystal') {
            shape = [
                "                ",
                "      OOOO      ",
                "    OOOHHDOO    ",
                "   OOHHCHCDDO   ",
                "  OOHCCHCCCDDO  ",
                "  OHCBBBBBCDDO  ",
                " OHCBBBBBBCDDOO ",
                " OHCBBBBBBCDDDO ",
                " OHCBBBBBBCDDDO ",
                " OOHCBBBBCDDDOO ",
                "  OOHCCCCCDDDO  ",
                "   OOHCCCDDDO   ",
                "    OOODDDOO    ",
                "      OOOO      ",
                "                ",
                "                "
            ];
        } else if (itemSubtype === 'iron_ingot' || itemSubtype === 'gold_ingot') {
            shape = [
                "                ",
                "                ",
                "                ",
                "                ",
                "                ",
                "      OOOOOO    ",
                "    OOOHHHHDOO  ",
                "   OOHCCCCCCDDO ",
                "  OOHCCCCCCCCDDO",
                " OOHCCCCCCCCCDDO",
                " OODDDDDDDDDDDDO",
                "  OOOOOOOOOOOOO ",
                "                ",
                "                ",
                "                ",
                "                "
            ];
        } else if (itemSubtype === 'flint_and_steel') {
            shape = [
                "                ",
                "       OOOOO    ",
                "      OHHCCD    ",
                "     OHD  CD    ",
                "    OHD   CD    ",
                "   OHD    CD    ",
                "   OD    CD     ",
                "        CCO     ",
                "  OO   CCO      ",
                " OGBO CCO       ",
                " OGBBCOO        ",
                "  OGBBO         ",
                "   OOO          ",
                "                ",
                "                ",
                "                "
            ];
            // Override palette colors manually for flint and steel
            ctx.fillStyle = '#666'; // For steel C
            ctx.fillStyle = '#444'; // For steel D
            ctx.fillStyle = '#333'; // For flint G
            ctx.fillStyle = '#222'; // For flint B
            // Just use the parser with a custom palette override
            const fsPalette = { c: '#999', d: '#555', h: '#ccc', g: '#333', b: '#222' };
            ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < 16; x++) {
                    const char = shape[y][x];
                    if (char === 'C') ctx.fillStyle = fsPalette.c;
                    else if (char === 'D') ctx.fillStyle = fsPalette.d;
                    else if (char === 'H') ctx.fillStyle = fsPalette.h;
                    else if (char === 'G') ctx.fillStyle = fsPalette.g;
                    else if (char === 'B') ctx.fillStyle = fsPalette.b;
                    else if (char === 'O') ctx.fillStyle = '#000000';
                    else continue;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
            return canvas;
        } else if (itemSubtype === 'stick') {
            shape = [
                "            OO  ",
                "           OHO  ",
                "          OHDO  ",
                "         OHDO   ",
                "        OHDO    ",
                "       OHDO     ",
                "      OHDO      ",
                "     OHDO       ",
                "    OHDO        ",
                "   OHDO         ",
                "  OHDO          ",
                "  ODO           ",
                "  OO            ",
                "                ",
                "                ",
                "                "
            ];
        }
    } else if (itemType === 'wand') {
        shape = [
            "            OO  ",
            "           OGGO ",
            "          OGGGO ",
            "         OHGGO  ",
            "        OHDO    ",
            "       OHDO     ",
            "      OHDO      ",
            "     OHDO       ",
            "    OHDO        ",
            "   OHDO         ",
            "  OHDO          ",
            "  ODO           ",
            "  OO            ",
            "                ",
            "                ",
            "                "
        ];
    } else if (itemType === 'spell') {
        let sc = 'spell_basic';
        if (itemSubtype === 'FIRE') sc = 'spell_fire';
        if (itemSubtype === 'ICE') sc = 'spell_ice';
        if (itemSubtype === 'HEAL') sc = 'spell_nature';
        p = palettes[sc];
        shape = [
            "                ",
            "      OOOO      ",
            "    OOCHHDOO    ",
            "   OCHHHHCDDO   ",
            "  OCHHHHCCCCDO  ",
            "  OHHHCCCCCCDO  ",
            " OHHHCCCCCCCCDO ",
            " OHHCCCCCCCCCDO ",
            " OHHCCCCCCCCCDO ",
            " OHCCCCCCCCCCDO ",
            "  OCCCCCCCCDDO  ",
            "  OCDDDDDDDCDO  ",
            "   OODDDDDDOO   ",
            "    OOOOOOOO    ",
            "                ",
            "                "
        ];
    }

    if (shape.length > 0) {
        drawGrid(shape);
    } else {
        // Fallback generic box
        ctx.fillStyle = p.c || '#ff00ff';
        ctx.fillRect(4, 4, 8, 8);
        ctx.fillStyle = p.d || '#880088';
        ctx.fillRect(4, 12, 8, 2);
        ctx.fillRect(12, 4, 2, 10);
    }

    return canvas;
}
