// ============================================
// main.js — Entry Point and Game Loop
// ============================================
import * as THREE from 'three';
import { GameEngine, InputManager, CHUNK_SIZE, CHUNK_HEIGHT, World } from './engine.js';
import { createTextureAtlas, getBlockProperties, getBlockName, BLOCKS } from './textures.js';
import { generatePlanetParams, generateChunkTerrain, generateNetherChunk } from './generation.js';
import { Player, EntityManager, Mob, MOB_TYPES, Item } from './entities.js';
import { LightingSystem, ParticleSystem, UISystem, TorchLightSystem, CloudSystem, MeteorShowerSystem } from './systems.js';
import { ProjectileManager, SpellProjectile } from './magic.js';
import { AudioManager } from './audio.js';

// Helper: find safe spawn location
function findSafeSpawn(params, isNether = false) {
    const centerBlocks = isNether ? generateNetherChunk(0, 0, params) : generateChunkTerrain(0, 0, params);

    // Search spiral from center to find a solid block that isn't under liquid
    const searchRadius = Math.floor(CHUNK_SIZE / 2);
    for (let r = 0; r < searchRadius; r++) {
        for (let x = CHUNK_SIZE / 2 - r; x <= CHUNK_SIZE / 2 + r; x++) {
            for (let z = CHUNK_SIZE / 2 - r; z <= CHUNK_SIZE / 2 + r; z++) {
                if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue;

                for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
                    const idx = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
                    const block = centerBlocks[idx];

                    if (block !== BLOCKS.AIR) {
                        // If the highest block is liquid, this column is unsafe
                        if (block === BLOCKS.WATER || block === BLOCKS.SWAMP_WATER || block === BLOCKS.LAVA) {
                            break; // Skip this column
                        }

                        // Otherwise, we found a solid block!
                        return { x: x, y: y + 2, z: z };
                    }
                }
            }
        }
    }

    // Fallback if no safe block found in chunk 0,0
    return { x: CHUNK_SIZE / 2, y: CHUNK_HEIGHT + 10, z: CHUNK_SIZE / 2 };
}

class ChestVisual {
    constructor(scene, x, y, z, atlas) {
        this.scene = scene;
        this.pos = { x, y, z };
        this.isOpen = false;
        this.lidAngle = 0;
        this.targetAngle = 0;
        
        this.group = new THREE.Group();
        this.group.position.set(x + 0.5, y, z + 0.5);

        const tex = atlas.texture;
        
        // Helper to clone texture for a specific face to set its UVs
        const makeMat = (uvData) => {
            const faceTex = tex.clone();
            faceTex.repeat.set(uvData.uSize, uvData.vSize);
            faceTex.offset.set(uvData.u, uvData.v);
            faceTex.needsUpdate = true;
            return new THREE.MeshLambertMaterial({ map: faceTex });
        };
        
        // Materials order for BoxGeometry: right (+x), left (-x), top (+y), bottom (-y), front (+z), back (-z)
        const sideMat = makeMat(atlas.getUV(window.BLOCKS.CHEST_BLOCK, 'side'));
        const topMat = makeMat(atlas.getUV(window.BLOCKS.CHEST_BLOCK, 'top'));
        const botMat = makeMat(atlas.getUV(window.BLOCKS.CHEST_BLOCK, 'bottom'));
        const frontMat = makeMat(atlas.getUV(window.BLOCKS.CHEST_BLOCK, 'front'));
        
        const chestMaterials = [sideMat, sideMat, topMat, botMat, frontMat, sideMat];
        
        // Base
        const baseGeo = new THREE.BoxGeometry(0.875, 0.625, 0.875);
        baseGeo.translate(0, 0.3125, 0); // Origin at bottom center
        const baseMesh = new THREE.Mesh(baseGeo, chestMaterials);
        this.group.add(baseMesh);

        // Lid
        const lidGeo = new THREE.BoxGeometry(0.875, 0.25, 0.875);
        lidGeo.translate(0, 0.125, 0.4375); // Origin at hinge (back edge)
        this.lidMesh = new THREE.Mesh(lidGeo, chestMaterials);
        this.lidMesh.position.set(0, 0.625, -0.4375);
        this.group.add(this.lidMesh);

        this.scene.add(this.group);
    }

    update(dt) {
        this.targetAngle = this.isOpen ? -Math.PI / 2.5 : 0;
        this.lidAngle += (this.targetAngle - this.lidAngle) * 10 * dt;
        this.lidMesh.rotation.x = this.lidAngle;
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.children.forEach(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        });
    }
}



class Game {
    constructor() {
        this.engine = new GameEngine();
        this.input = new InputManager();
        this.ui = new UISystem();

        this.lastTime = performance.now();
        this.clock = new THREE.Clock();

        this.isReady = false;
        this.fps = 0;
        this.frames = 0;
        this.lastFpsTime = performance.now();
        this.breakTimer = 0;
        this.isPaused = false;

        // UI start is handled in window.onload
    }

    start() {
        if (this.hasStarted) return;
        this.hasStarted = true;

        const canvas = document.getElementById('game-canvas');
        this.engine.init(canvas);

        // Create dynamic HUD elements
        this._createHUDElements();
        this.input.init(canvas);

        // Generate textures
        this.atlas = createTextureAtlas();

        // Seed: use typed value or generate random
        const seedInput = document.getElementById('seed-input');
        const rawSeed = seedInput && seedInput.value.trim() ? seedInput.value.trim() : (Math.random() * 1000000 | 0).toString();
        this.worldSeed = rawSeed;

        // Planet Generation
        this.currentSeed = rawSeed;
        this.currentDimension = 'overworld'; // 'overworld' or 'nether'
        this.planetParams = generatePlanetParams(rawSeed);
        this.world = new World(this.engine.scene, this.atlas);

        // Chest Management
        this.chestInventories = new Map();
        this.chestVisuals = new Map();
        
        // Furnace Management
        this.furnaces = new Map(); // key -> { input, fuel, output, progress, isSmelting }

        this.world.onChestGenerated = (x, y, z) => this._addChest(x, y, z, true);
        this.world.onChestPlaced = (x, y, z) => this._addChest(x, y, z, false);
        this.world.onFurnacePlaced = (x, y, z) => this._addFurnace(x, y, z);
        this.world.onChestRemoved = (x, y, z) => {
            const key = `${x},${y},${z}`;
            if (this.chestVisuals.has(key)) {
                this.chestVisuals.get(key).dispose();
                this.chestVisuals.delete(key);
            }
            if (this.chestInventories.has(key)) {
                // Drop items from chest
                const inv = this.chestInventories.get(key);
                for (let i=0; i<inv.length; i++) {
                    if (inv[i]) {
                        this.entityManager.spawnItem(inv[i].item, inv[i].count, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
                    }
                }
                this.chestInventories.delete(key);
            }
        };

        this.world.onFurnaceRemoved = (x, y, z) => {
            const key = `${x},${y},${z}`;
            if (this.furnaces.has(key)) {
                const f = this.furnaces.get(key);
                const pos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
                if (f.input) this.entityManager.spawnItem(f.input.item, f.input.count, pos);
                if (f.fuel) this.entityManager.spawnItem(f.fuel.item, f.fuel.count, pos);
                if (f.output) this.entityManager.spawnItem(f.output.item, f.output.count, pos);
                this.furnaces.delete(key);
            }
        };



        this.world.onBlockDestroyed = (x, y, z, oldType, newType) => {
            if (oldType === BLOCKS.AIR || oldType === BLOCKS.WATER || oldType === BLOCKS.LAVA || oldType === BLOCKS.SWAMP_WATER) return;
            // When replaced by a fluid (water or lava) or air (player breaking)
            const props = getBlockProperties(oldType);
            
            // Ore blocks drop material items instead of themselves
            const ORE_DROPS = {
                [BLOCKS.IRON_ORE]:    { subtype: 'iron_ingot', name: 'Iron Ingot' },
                [BLOCKS.GOLD_ORE]:    { subtype: 'gold_ingot', name: 'Gold Ingot' },
                [BLOCKS.CRYSTAL_ORE]: { subtype: 'diamond', name: 'Diamond' },
                [BLOCKS.DIAMOND_ORE]: { subtype: 'diamond', name: 'Diamond' },
                [BLOCKS.MANA_ORE]:    { subtype: 'mana_crystal', name: 'Mana Crystal' },
                [BLOCKS.COAL_ORE]:    { subtype: 'coal', name: 'Coal' },
            };
            const oreDrop = ORE_DROPS[oldType];
            if (oreDrop) {
                const matItem = new Item('material', oreDrop.subtype, {}, oreDrop.name);
                matItem.stackable = true;
                matItem.maxStack = 64;
                this.entityManager.spawnItem(matItem, 1, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
            } else {
                const dropType = props.drops !== undefined && props.drops !== null ? props.drops : oldType;
                if (dropType !== BLOCKS.AIR) {
                    this.entityManager.spawnItem(Item.blockItem(dropType, getBlockName(dropType)), 1, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
                }
            }
        };

        this.world.onChunkUnloaded = (cx, cz) => {
            const minX = cx * 16; // CHUNK_SIZE
            const maxX = minX + 16;
            const minZ = cz * 16;
            const maxZ = minZ + 16;
            
            // Cleanup chest visuals in unloaded chunk
            for (const [key, visual] of this.chestVisuals.entries()) {
                if (visual.pos.x >= minX && visual.pos.x < maxX && visual.pos.z >= minZ && visual.pos.z < maxZ) {
                    visual.dispose();
                    this.chestVisuals.delete(key);
                }
            }
        };

        // Expose BLOCKS globally for UISystem recipe matching
        window.BLOCKS = BLOCKS;

        // Systems
        this.lighting = new LightingSystem(this.engine.scene);
        this.torchSystem = new TorchLightSystem(this.engine.scene);
        this.particles = new ParticleSystem(this.engine.scene);
        this.audio = new AudioManager();

        // Entities
        this.player = new Player();
        // Spawn player at safe location
        const spawnPos = findSafeSpawn(this.planetParams);
        this.player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);

        this.entityManager = new EntityManager(this.engine.scene, this.atlas);
        this.projectileManager = new ProjectileManager(this.engine.scene);
        this.cloudSystem = new CloudSystem(this.engine.scene);
        this.meteorSystem = new MeteorShowerSystem(this.engine.scene, this.particles, this.audio, this.world);

        // Setup Scene
        const renderDistBlocks = (this.engine.renderDistance || 8) * 16;
        this.engine.scene.fog = new THREE.FogExp2(this.planetParams.skyColor || 0x87ceeb, 1.0 / (renderDistBlocks * 0.75));

        // Block outline
        const outlineGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const outlineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        this.blockOutline = new THREE.LineSegments(new THREE.EdgesGeometry(outlineGeo), outlineMat);
        this.engine.scene.add(this.blockOutline);
        this.blockOutline.visible = false;

        const overlayGeo = new THREE.BoxGeometry(1.03, 1.03, 1.03);
        const overlayMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 });
        this.miningOverlay = new THREE.Mesh(overlayGeo, overlayMat);
        this.engine.scene.add(this.miningOverlay);
        this.miningOverlay.visible = false;

        // View Model (Hands/Wand)
        this.viewModel = new THREE.Group();
        this.handMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.6, 0.2),
            new THREE.MeshLambertMaterial({ color: 0xe0ac69 }) // skin tone
        );
        this.handMesh.position.set(0.4, -0.4, -0.5);
        this.handMesh.rotation.x = -Math.PI / 4;
        this.handMesh.rotation.z = -Math.PI / 6;
        this.viewModel.add(this.handMesh);
        this.engine.camera.add(this.viewModel);
        this.engine.scene.add(this.engine.camera); // Needed for child objects to render
        this.heldItemMesh = null;

        // Minimap Camera
        const d = 40; // minimap view half-size in blocks
        // Render true top-down view (far plane large enough to see ground)
        this.minimapCamera = new THREE.OrthographicCamera(-d, d, d, -d, 1, 300);
        this.minimapCamera.position.set(0, 250, 0);
        this.minimapCamera.lookAt(0, 0, 0);

        this.input.requestPointerLock();
        this.isReady = true;

        // Pause Menu Handlers
        document.getElementById('btn-resume').onclick = () => {
            document.getElementById('pause-screen').classList.add('hidden');
            this.input.requestPointerLock();
        };

        document.getElementById('btn-quit').onclick = () => {
            location.reload(); // Simple quit
        };

        // Copy Seed button
        const copyBtn = document.getElementById('btn-copy-seed');
        const seedDisplay = document.getElementById('current-seed-display');
        if (seedDisplay) seedDisplay.textContent = this.worldSeed;
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(this.worldSeed).catch(() => {});
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
            };
        }

        const fovSlider = document.getElementById('fov-slider');
        const fovVal = document.getElementById('fov-val');
        if (fovSlider) {
            fovSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                if(fovVal) fovVal.textContent = val;
                this.engine.camera.fov = val;
                this.engine.camera.updateProjectionMatrix();
            });
        }


        // Settings Handlers
        const slider = document.getElementById('render-distance-slider');
        const sliderVal = document.getElementById('render-distance-val');
        if (slider && sliderVal) {
            slider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                sliderVal.textContent = val;
                if (this.world) this.world.setRenderDistance(val);
            });
        }

        // Pointer lock listener for pausing
        document.addEventListener('pointerlockchange', () => {
            const ps = document.getElementById('pause-screen');
            if (!this.input.isLocked && !this.ui.isOpen && document.getElementById('start-screen').classList.contains('hidden')) {
                // We lost pointer lock but the inventory is not open, show pause
                if (ps) ps.classList.remove('hidden');
                this.isPaused = true;
            } else {
                if (ps) ps.classList.add('hidden');
                this.isPaused = false;
            }
        });

        this.loop();
    }

    _addChest(x, y, z, isGenerated = false) {
        const key = `${x},${y},${z}`;
        if (!this.chestInventories.has(key)) {
            // Default empty 27-slot inventory
            const inv = new Array(27).fill(null);
            this.chestInventories.set(key, inv);

            if (isGenerated) {
                // Randomly generate loot
                const rng = () => Math.random();
                let lootTable = [];
                // Check if this is a dungeon chest based on depth
                if (y < 40) {
                    lootTable = [
                        { item: new Item('material', 'iron_ingot', {}, 'Iron Ingot'), maxCount: 8, chance: 0.6 },
                        { item: new Item('material', 'gold_ingot', {}, 'Gold Ingot'), maxCount: 4, chance: 0.4 },
                        { item: new Item('material', 'diamond', {}, 'Diamond'), maxCount: 2, chance: 0.2 },
                        { item: new Item('material', 'mana_crystal', {}, 'Mana Crystal'), maxCount: 4, chance: 0.3 },
                        { item: Item.equipmentItem('sword_iron', { damage: 8 }, 'Iron Sword'), maxCount: 1, chance: 0.2 },
                        { item: Item.equipmentItem('chestplate_iron', { protection: 4 }, 'Iron Chestplate'), maxCount: 1, chance: 0.15 }
                    ];
                } else {
                    lootTable = [
                        { item: new Item('material', 'wood_log', {}, 'Wood Log'), maxCount: 16, chance: 0.7 },
                        { item: new Item('material', 'cobblestone', {}, 'Cobblestone'), maxCount: 32, chance: 0.8 },
                        { item: new Item('material', 'coal', {}, 'Coal'), maxCount: 12, chance: 0.5 },
                        { item: Item.equipmentItem('pickaxe_stone', { mineSpeed: 1.5, damage: 3 }, 'Stone Pickaxe'), maxCount: 1, chance: 0.3 },
                        { item: new Item('spell', 'fire', { spell: { element: 'fire', type: 'projectile', cost: 10, modifiers: [] } }, 'Fire Spell'), maxCount: 1, chance: 0.4 },
                        { item: new Item('spell', 'ice', { spell: { element: 'ice', type: 'projectile', cost: 10, modifiers: [] } }, 'Ice Spell'), maxCount: 1, chance: 0.4 }
                    ];
                }

                // Populate 3-8 slots randomly
                const numSlots = 3 + Math.floor(rng() * 6);
                for (let i = 0; i < numSlots; i++) {
                    const slotIdx = Math.floor(rng() * 27);
                    if (!inv[slotIdx]) {
                        const entry = lootTable[Math.floor(rng() * lootTable.length)];
                        if (rng() < entry.chance) {
                            const count = 1 + Math.floor(rng() * entry.maxCount);
                            const itemClone = Object.assign(Object.create(Object.getPrototypeOf(entry.item)), entry.item);
                            itemClone.stackable = entry.maxCount > 1;
                            inv[slotIdx] = { item: itemClone, count: count };
                        }
                    }
                }
            }
        }
        if (!this.chestVisuals.has(key)) {
            const visual = new ChestVisual(this.engine.scene, x, y, z, this.atlas);
            this.chestVisuals.set(key, visual);
        }
    }
    _addFurnace(x, y, z) {
        const key = `${x},${y},${z}`;
        if (!this.furnaces.has(key)) {
            // Initial furnace state
            this.furnaces.set(key, {
                input: null,
                fuel: null,
                output: null,
                progress: 0,
                isSmelting: false
            });
        }
    }

    _updateFurnaces(dt) {
        // Simple smelting recipes
        const getSmeltResult = (inputItem) => {
            if (!inputItem || !inputItem.item) return null;
            const type = inputItem.item.type;
            const subtype = inputItem.item.subtype;
            
            if (type === 'block' && (subtype === window.BLOCKS.IRON_ORE || subtype === window.BLOCKS.GOLD_ORE || subtype === window.BLOCKS.CRYSTAL_ORE || subtype === window.BLOCKS.MANA_ORE)) {
                // Return INGOT or GEM
                let matSubtype = 'iron_ingot';
                if (subtype === window.BLOCKS.GOLD_ORE) matSubtype = 'gold_ingot';
                if (subtype === window.BLOCKS.CRYSTAL_ORE) matSubtype = 'crystal_shard';
                if (subtype === window.BLOCKS.MANA_ORE) matSubtype = 'mana_crystal';
                return { type: 'material', subtype: matSubtype, name: matSubtype.replace('_', ' '), stackable: true, maxStack: 64, id: `mat_${matSubtype}` };
            }
            if (type === 'block' && subtype === window.BLOCKS.SAND) {
                return { type: 'block', subtype: window.BLOCKS.GLASS, name: 'Glass', stackable: true, maxStack: 64, id: `block_${window.BLOCKS.GLASS}` };
            }
            if (type === 'block' && subtype === window.BLOCKS.COBBLESTONE) {
                return { type: 'block', subtype: window.BLOCKS.STONE, name: 'Stone', stackable: true, maxStack: 64, id: `block_${window.BLOCKS.STONE}` };
            }
            return null;
        };

        const isFuel = (fuelItem) => {
            if (!fuelItem || !fuelItem.item) return false;
            if (fuelItem.item.type === 'material' && (fuelItem.item.subtype === 'coal' || fuelItem.item.subtype === 'stick')) return true;
            if (fuelItem.item.type === 'block' && (fuelItem.item.subtype === window.BLOCKS.PLANKS || fuelItem.item.subtype === window.BLOCKS.WOOD)) return true;
            return false;
        };

        for (const [key, f] of this.furnaces.entries()) {
            const resultItem = getSmeltResult(f.input);
            const hasFuel = isFuel(f.fuel);
            
            const canSmelt = resultItem && hasFuel && 
                (!f.output || (f.output.item.type === resultItem.type && f.output.item.subtype === resultItem.subtype && f.output.count < f.output.item.maxStack));

            if (canSmelt) {
                f.isSmelting = true;
                f.progress += dt / 5.0; // 5 seconds to smelt

                if (f.progress >= 1.0) {
                    // Smelted!
                    f.progress = 0;
                    f.input.count--;
                    if (f.input.count <= 0) f.input = null;
                    
                    // Consume 1 fuel
                    f.fuel.count--;
                    if (f.fuel.count <= 0) f.fuel = null;
                    
                    if (f.output) {
                        f.output.count++;
                    } else {
                        f.output = { item: resultItem, count: 1 };
                    }
                }
            } else {
                f.isSmelting = false;
                if (f.progress > 0) {
                    f.progress -= dt / 2.0; // cool down if interrupted
                    if (f.progress < 0) f.progress = 0;
                }
            }
        }
    }

    _createHUDElements() {
        // Crosshair
        if (!document.getElementById('crosshair')) {
            const ch = document.createElement('div');
            ch.id = 'crosshair';
            ch.innerHTML = '<div class="ch ch-h"></div><div class="ch ch-v"></div><div class="ch ch-dot"></div>';
            document.body.appendChild(ch);
        }
        // Damage flash
        if (!document.getElementById('damage-flash')) {
            const df = document.createElement('div');
            df.id = 'damage-flash';
            document.body.appendChild(df);
        }
        // HUD bars
        if (!document.getElementById('health-container')) {
            const hud = document.createElement('div');
            hud.innerHTML = `
                <div id="health-container" class="bar-container">
                    <span class="bar-icon">♥</span>
                    <div class="bar-track"><div class="bar-fill health-fill" id="health-fill"></div></div>
                    <span class="bar-text" id="health-text">100/100</span>
                </div>
                <div id="mana-container" class="bar-container">
                    <span class="bar-icon">★</span>
                    <div class="bar-track"><div class="bar-fill mana-fill" id="mana-fill"></div></div>
                    <span class="bar-text" id="mana-text">100/100</span>
                </div>
            `;
            document.body.appendChild(hud);
        }
        // Minimap Overlay
        if (!document.getElementById('minimap-overlay')) {
            const mmo = document.createElement('div');
            mmo.id = 'minimap-overlay';
            mmo.style.cssText = 'position: absolute; top: 20px; right: 20px; width: 200px; height: 200px; pointer-events: none; z-index: 100; font-family: Outfit, sans-serif; border: 4px solid black; box-shadow: 0 0 15px rgba(0,0,0,0.8);';
            mmo.innerHTML = `
                <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); color: white; font-weight: bold; text-shadow: 1px 1px 2px #000; font-size: 14px;">N</div>
                <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); color: white; font-weight: bold; text-shadow: 1px 1px 2px #000; font-size: 14px;">S</div>
                <div style="position: absolute; top: 50%; left: 8px; transform: translateY(-50%); color: white; font-weight: bold; text-shadow: 1px 1px 2px #000; font-size: 14px;">W</div>
                <div style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); color: white; font-weight: bold; text-shadow: 1px 1px 2px #000; font-size: 14px;">E</div>
                <div id="minimap-player-arrow" style="position: absolute; top: 50%; left: 50%; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 16px solid #ff3333; transform-origin: 50% 50%; margin-left: -6px; margin-top: -8px; filter: drop-shadow(0 0 3px black);"></div>
            `;
            document.body.appendChild(mmo);
        }
    }

    // UI functions removed by user request

    handleInput(dt) {
        if (!this.input.isPointerLocked()) return;

        // Hotbar selection via keys
        if (this.input.hotbarIndex >= 0) {
            this.player.selectedSlot = this.input.hotbarIndex;
        }
        // Hotbar selection via scroll wheel
        if (this.input.mouse.scrollDelta !== 0) {
            this.player.selectedSlot = ((this.player.selectedSlot + this.input.mouse.scrollDelta) % 9 + 9) % 9;
        }

        // Raycast for interactions
        const lookDir = this.player.getLookDirection();
        const eyePos = this.player.getEyePosition();
        const hit = this.world.raycast(eyePos, lookDir, 8);
        const entityHit = this.entityManager.raycast(eyePos, lookDir, 4); // Melee range

        // View model bobbing and item display
        const speed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.z ** 2);
        if (this.player.grounded && speed > 0.5) {
            this.viewModel.position.y = Math.sin(performance.now() * 0.01) * 0.05;
            this.viewModel.position.x = Math.cos(performance.now() * 0.005) * 0.05;
        } else {
            this.viewModel.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }

        // Update held item visual
        const slot = this.player.inventory.slots[this.player.selectedSlot];
        if (!slot && this.heldItemMesh) {
            this.viewModel.remove(this.heldItemMesh);
            this.heldItemMesh = null;
        } else if (slot && (!this.heldItemMesh || this.heldItemMesh.userData.item !== slot.item)) {
            if (this.heldItemMesh) this.viewModel.remove(this.heldItemMesh);

            if (slot.item.type === 'block') {
                const blockProps = getBlockProperties(slot.item.subtype);
                const mat = new THREE.MeshLambertMaterial({
                    map: this.atlas.texture,
                    alphaTest: 0.5,
                    transparent: blockProps.transparent || blockProps.isCross || false,
                    side: blockProps.isCross ? THREE.DoubleSide : THREE.FrontSide
                });

                if (blockProps.isCross || slot.item.subtype === BLOCKS.TORCH) {
                    const geom = new THREE.BufferGeometry();
                    const s = 0.15; // slightly smaller
                    const positions = [
                        -s, -s, -s, s, -s, s, s, s, s, -s, s, -s,
                        -s, -s, s, s, -s, -s, s, s, -s, -s, s, s
                    ];
                    const uvInfo = this.atlas.getUV(slot.item.subtype, 'side');
                    const uvs = [];
                    for (let i = 0; i < 2; i++) {
                        uvs.push(uvInfo.u, uvInfo.v, uvInfo.u + uvInfo.uSize, uvInfo.v, uvInfo.u + uvInfo.uSize, uvInfo.v + uvInfo.vSize, uvInfo.u, uvInfo.v + uvInfo.vSize);
                    }
                    const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
                    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    geom.setIndex(indices);
                    geom.computeVertexNormals();
                    this.heldItemMesh = new THREE.Mesh(geom, mat);
                } else {
                    const geom = new THREE.BoxGeometry(0.25, 0.25, 0.25).toNonIndexed();
                    const uvs = geom.attributes.uv.array;
                    const faceNames = ['side', 'side', 'top', 'bottom', 'side', 'side'];
                    for (let i = 0; i < 6; i++) {
                        const uvInfo = this.atlas.getUV(slot.item.subtype, faceNames[i]);
                        for (let v = 0; v < 6; v++) {
                            const baseU = uvs[i * 12 + v * 2];
                            const baseV = uvs[i * 12 + v * 2 + 1];
                            uvs[i * 12 + v * 2] = uvInfo.u + baseU * uvInfo.uSize;
                            uvs[i * 12 + v * 2 + 1] = uvInfo.v + baseV * uvInfo.vSize;
                        }
                    }
                    this.heldItemMesh = new THREE.Mesh(geom, mat);
                }
                this.heldItemMesh.position.set(0.4, -0.2, -0.8);
                if (!blockProps.isCross && slot.item.subtype !== BLOCKS.TORCH) {
                    this.heldItemMesh.rotation.y = -Math.PI / 4;
                    this.heldItemMesh.rotation.x = Math.PI / 8;
                }

            } else if (slot.item.type === 'wand') {
                this.heldItemMesh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8),
                    new THREE.MeshLambertMaterial({ color: 0x6b4f2c })
                );
                this.heldItemMesh.position.set(0.4, -0.1, -0.8);
                this.heldItemMesh.rotation.x = Math.PI / 4;
            } else {
                this.heldItemMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.3, 0.3),
                    new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide })
                );
                this.heldItemMesh.position.set(0.4, -0.2, -0.8);
            }
            this.heldItemMesh.userData.item = slot.item;
            this.viewModel.add(this.heldItemMesh);
        }

        // Left click (Attack / Mine / Magic)
        if (this.input.mouse.leftClick) {
            this.viewModel.rotation.x += (-0.5 - this.viewModel.rotation.x) * 0.2; // swing animation (lerp)

            if (slot && slot.item.type === 'wand') {
                const wandIndex = this.player.activeSpellIndex || 0;
                const castInfo = slot.item.data.wand.cast(wandIndex, this.player);
                if (castInfo) {
                    if (castInfo.stats.element === 'HEAL') {
                        this.player.health = Math.min(this.player.maxHealth, this.player.health + Math.abs(castInfo.stats.damage));
                    }
                    this.particles.emit(eyePos, 'magic', 10, castInfo.spell.color);
                    this.audio.playCast();
                    for (let i = 0; i < castInfo.stats.count; i++) {
                        let projDir = lookDir.clone();
                        if (castInfo.stats.count > 1) {
                            projDir.x += (Math.random() - 0.5) * 0.2;
                            projDir.y += (Math.random() - 0.5) * 0.2;
                            projDir.z += (Math.random() - 0.5) * 0.2;
                            projDir.normalize();
                        }
                        const proj = new SpellProjectile(eyePos, projDir, castInfo.stats, castInfo.spell.color);
                        this.projectileManager.add(proj);
                    }
                }
                this.input.mouse.leftClick = false; // single cast
            } else if (entityHit.hit && this.breakTimer === 0) { // Attack entity
                let damage = 5; // Unarmed base damage
                if (slot && slot.item.type === 'equipment' && slot.item.data.equipData && slot.item.data.equipData.damage) {
                    damage = slot.item.data.equipData.damage;
                } else if (slot && slot.item.type === 'wand') {
                    damage = 10;
                }
                entityHit.mob.takeDamage(damage, lookDir);
                this.audio.playHit();

                this.particles.emit(entityHit.mob.position, 'blood', 5, 0xff0000);
                this.input.mouse.leftClick = false; // single attack per click
                this.breakTimer = 0.5; // attack cooldown reuse breakTimer
            } else if (hit.hit && this.breakTimer >= 0) { // Mine block
                this.breakTimer += dt;

                // Breaking particles (cracks)
                if (Math.random() < 0.2) this.particles.emit(hit.position, 'block_break', 1, 0x555555);

                const blockProps = getBlockProperties(hit.blockType);
                
                let mineMult = 1.0;
                if (slot && slot.item.type === 'equipment' && slot.item.data.equipData && slot.item.data.equipData.mineSpeed) {
                    mineMult = slot.item.data.equipData.mineSpeed;
                }
                
                const breakTime = ((blockProps.health || 1) * 0.1) / mineMult;
                
                this.miningOverlay.visible = true;
                this.miningOverlay.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5);
                this.miningOverlay.material.opacity = (this.breakTimer / breakTime) * 0.8;

                if (this.breakTimer >= breakTime) {
                    const blockType = this.world.getBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
                    // The setBlock call will trigger onBlockDestroyed which spawns the item
                    this.world.setBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BLOCKS.AIR);
                    
                    if (blockType === BLOCKS.TORCH) this.torchSystem.removeTorch(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
                    
                    this.audio.playBreak(blockType);
                    this.breakTimer = 0;
                    this.miningOverlay.visible = false;
                }
            }
        } else {
            this.viewModel.rotation.x = 0;
            this.breakTimer = 0;
            this.miningOverlay.visible = false;
        }

        // Hover Outline
        if (hit.hit && !entityHit.hit) {
            const props = getBlockProperties(hit.blockType);
            const isSmall = props.isCross || hit.blockType === BLOCKS.TORCH || hit.blockType === BLOCKS.DEAD_BUSH || hit.blockType === BLOCKS.MUSHROOM_STEM;
            const size = isSmall ? 0.4 : 1.02;

            this.blockOutline.geometry.dispose();
            this.blockOutline.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size));

            if (isSmall) {
                this.blockOutline.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.2, hit.blockPos.z + 0.5);
            } else {
                this.blockOutline.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5);
            }
            this.blockOutline.visible = true;
        } else {
            this.blockOutline.visible = false;
        }

        // Right click actions
        if (this.input.mouse.rightClick) {
            const slot = this.player.inventory.slots[this.player.selectedSlot];

            if (slot && slot.item.subtype === 'flint_and_steel' && hit.hit) {
                // If clicked on Obsidian, try to light a portal
                if (hit.blockType === window.BLOCKS.OBSIDIAN) {
                    this.tryLightPortal(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
                    this.audio.playHit();
                }
                this.input.mouse.rightClick = false;
                return;
            }

            if (hit.hit && hit.blockType === window.BLOCKS.CHEST_BLOCK) {
                // Open Chest
                this.audio.playClick(); // Or a specific chest open sound
                const key = `${hit.blockPos.x},${hit.blockPos.y},${hit.blockPos.z}`;
                const visual = this.chestVisuals.get(key);
                if (visual) visual.isOpen = true;
                
                this.ui.toggleChest(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, this.chestInventories.get(key), () => {
                    // On close callback
                    if (visual) visual.isOpen = false;
                    this.input.requestPointerLock();
                });
                document.exitPointerLock();
                this.input.mouse.rightClick = false;
                return;
            }

            if (hit.hit && hit.blockType === window.BLOCKS.FURNACE) {
                // Open Furnace
                this.audio.playClick(); 
                const key = `${hit.blockPos.x},${hit.blockPos.y},${hit.blockPos.z}`;
                
                this.ui.toggleFurnace(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, this.furnaces.get(key), () => {
                    this.input.requestPointerLock();
                });
                document.exitPointerLock();
                this.input.mouse.rightClick = false;
                return;
            }
            if (hit.hit && hit.blockType === window.BLOCKS.DUNGEON_DOOR) {
                this.audio.playClick();
                if (this.ui.toggleDungeonMenu) {
                    this.ui.toggleDungeonMenu(() => {
                        this.input.requestPointerLock();
                    });
                    document.exitPointerLock();
                    this.input.mouse.rightClick = false;
                }
                return;
            }

            if (hit.hit && hit.blockType === window.BLOCKS.BOOKSHELF) {
                // Restore Mana
                if (this.player.mana < this.player.maxMana) {
                    this.player.mana += 20;
                    if (this.player.mana > this.player.maxMana) this.player.mana = this.player.maxMana;
                    this.audio.playHit(); // Magical sound 
                    
                    // Consume bookshelf? Or let it be reusable? Let's make it reusable but with a tiny cooldown maybe? 
                    // No cooldown mentioned. 
                }
                this.input.mouse.rightClick = false;
                return;
            }
            if (slot && slot.item.type === 'wand') {
                if (this.player.activeSpellIndex === undefined) this.player.activeSpellIndex = 0;
                this.player.activeSpellIndex = (this.player.activeSpellIndex + 1) % slot.item.data.wand.maxSlots;
                this.audio.playClick();
            } else if (slot && slot.item.type === 'block' && hit.hit) {
                // Place block
                const placePos = { x: hit.blockPos.x + hit.normal.x, y: hit.blockPos.y + hit.normal.y, z: hit.blockPos.z + hit.normal.z };
                const curBlock = this.world.getBlock(placePos.x, placePos.y, placePos.z);
                if (curBlock === BLOCKS.AIR || curBlock === BLOCKS.WATER || curBlock === BLOCKS.SWAMP_WATER || curBlock === BLOCKS.LAVA) {
                    this.world.setBlock(placePos.x, placePos.y, placePos.z, slot.item.subtype);
                    if (slot.item.subtype === BLOCKS.TORCH) this.torchSystem.addTorch(placePos.x, placePos.y, placePos.z);
                    this.audio.playPlace();
                    slot.count--;
                    if (slot.count <= 0) {
                        this.player.inventory.slots[this.player.selectedSlot] = null;
                    }
                }
            }
            this.input.mouse.rightClick = false; // single action
        }
    }

    loop() {
        requestAnimationFrame(() => this.loop());

        if (!this.isReady) return;

        const time = performance.now();
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        // FPS counter
        this.frames++;
        if (time - this.lastFpsTime > 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastFpsTime = time;
        }

        if (this.input.menuKeys.inventory) {
            this.ui.toggle();
            if (this.ui.isOpen) {
                if (this.input.isPointerLocked()) document.exitPointerLock();
            } else {
                this.input.requestPointerLock();
            }
        }

        if (this.input.menuKeys.debug) {
            const di = document.getElementById('debug-info');
            if (di) di.classList.toggle('hidden');
            this.input.menuKeys.debug = false;
        }

        if (this.isPaused) {
            this.input.resetMouse();
            return;
        }

        if (this.input.menuKeys.dropItem) {
            const slot = this.player.inventory.slots[this.player.selectedSlot];
            if (slot && slot.item) {
                const dropCount = this.input.keys.sprint ? slot.count : 1;
                const lookDir = this.player.getLookDirection();
                const eyePos = this.player.getEyePosition();
                const dropPos = eyePos.clone().add(lookDir.clone().multiplyScalar(0.5));
                const velocity = lookDir.clone().multiplyScalar(10);
                
                this.entityManager.spawnItem(slot.item, dropCount, dropPos, velocity);
                
                slot.count -= dropCount;
                if (slot.count <= 0) {
                    this.player.inventory.slots[this.player.selectedSlot] = null;
                }
            }
            this.input.menuKeys.dropItem = false;
        }

        if (this.input.isPointerLocked()) {
            // Footsteps
            if (this.player.grounded && (this.input.keys.forward || this.input.keys.backward || this.input.keys.left || this.input.keys.right)) {
                this.footstepTimer = (this.footstepTimer || 0) + dt;
                const footstepInterval = this.input.keys.sprint ? 0.3 : 0.45;
                if (this.footstepTimer >= footstepInterval) {
                    this.footstepTimer = 0;
                    this.audio.playFootstep();
                }
            } else {
                this.footstepTimer = 0.45; // trigger immediately next step
            }

            this.player.update(dt, this.input.keys, this.input.mouse, this.world);
            this.handleInput(dt);

            if (this.player.health <= 0) {
                // Respawn
                this.player.health = this.player.maxHealth;
                this.player.mana = this.player.maxMana;
                const spawnPos = findSafeSpawn(this.planetParams);
                this.player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
                this.player.velocity.set(0, 0, 0);
                this.audio.playHit();
            }
        }

        this.input.resetMouse();

        if (!this.bobPhase) this.bobPhase = 0;

        if (this.player.grounded && (this.input.keys.forward || this.input.keys.backward || this.input.keys.left || this.input.keys.right)) {
            const speed = this.input.keys.sprint ? 7.5 : 5.0;
            this.bobPhase += dt * speed;
        } else {
            // Decay back to neutral
            this.bobPhase *= Math.pow(0.5, dt * 10);
        }

        const bobOffset = Math.sin(this.bobPhase) * 0.02; // Very subtle bob

        // Update Camera to match player eyes
        const eyePos = this.player.getEyePosition();
        this.engine.camera.position.copy(eyePos);
        this.engine.camera.position.y += Math.abs(bobOffset); // Upward bounce

        const lookDir = this.player.getLookDirection();
        this.engine.camera.lookAt(eyePos.clone().add(lookDir));
        // Add subtle tilt based on bob
        this.engine.camera.rotateZ(bobOffset * 0.05);
        // Check Portal Warp
        const pbx = Math.floor(this.player.position.x);
        const pby = Math.floor(this.player.position.y);
        const pbz = Math.floor(this.player.position.z);
        if (this.world.getBlock(pbx, pby, pbz) === BLOCKS.PORTAL && !this.isWarping) {
            this.warpToNewPlanet();
        }

        this.engine.update(dt);
        
        const chunkGenFn = this.currentDimension === 'nether' ? generateNetherChunk : generateChunkTerrain;
        this.world.update(this.player.position, (cx, cz) => chunkGenFn(cx, cz, this.planetParams), dt);

        this.input.update(dt);

        // Update Systems
        const headX = Math.floor(this.engine.camera.position.x);
        const headY = Math.floor(this.engine.camera.position.y);
        const headZ = Math.floor(this.engine.camera.position.z);
        const headBlock = this.world.getBlock(headX, headY, headZ);
        const isUnderwater = window.getBlockProperties ? window.getBlockProperties(headBlock).isLiquid :
            (getBlockProperties ? getBlockProperties(headBlock).isLiquid : false);

        let isUnderground = true;
        for (let y = headY; y < 128; y++) {
            if (this.world.getBlock(headX, y, headZ) === BLOCKS.AIR) {
                isUnderground = false;
                break;
            }
        }

        this.lighting.update(dt, this.engine.camera.position, isUnderwater, isUnderground);

        if (this.engine.scene.fog) {
            // Keep track of the original planet fog density for Systems to use
            if (this.engine.scene.fog.baseDensity === undefined) {
                this.engine.scene.fog.baseDensity = this.engine.scene.fog.density;
            }
        }
        this.particles.update(dt);
        this.cloudSystem.update(dt, this.engine.camera.position);
        this.entityManager.update(dt, this.world, this.player.position, this.player.inventory, this.player, this.lighting.timeOfDay, this.currentDimension);

        for (let visual of this.chestVisuals.values()) {
            visual.update(dt);
        }



        const _tempVec3 = new THREE.Vector3();
        
        this.projectileManager.update(dt, (proj) => {
            let hitFound = false;
            let hitPos = _tempVec3.copy(proj.position);

            // Check entities
            _tempVec3.copy(proj.velocity).normalize();
            const eHit = this.entityManager.raycast(proj.position, _tempVec3, dt * proj.stats.speed + 0.5);
            if (eHit.hit && eHit.mob) {
                hitFound = true;
                hitPos.copy(eHit.mob.position);
                if (proj.stats.element === 'ICE') {
                    eHit.mob.takeDamage(proj.stats.damage, _tempVec3);
                    eHit.mob.freeze(3.0); // 3 seconds freeze
                } else if (proj.stats.element !== 'FIRE') {
                    // Normal hit
                    eHit.mob.takeDamage(proj.stats.damage, _tempVec3);
                }
            }

            // Check blocks
            if (!hitFound) {
                const bx = Math.floor(proj.position.x);
                const by = Math.floor(proj.position.y);
                const bz = Math.floor(proj.position.z);
                const blockType = this.world.getBlock(bx, by, bz);
                if (blockType !== BLOCKS.AIR && blockType !== BLOCKS.WATER && blockType !== BLOCKS.SWAMP_WATER && blockType !== BLOCKS.LAVA) {
                    const props = getBlockProperties(blockType);
                    if (props && (props.solid || props.isCross)) {
                        hitFound = true;
                    }
                }
            }

            if (hitFound) {
                if (proj.stats.element === 'FIRE') {
                    // Explode! AOE damage
                    for (const mob of this.entityManager.mobs) {
                        if (mob.position.distanceTo(hitPos) < 4.0) {
                            const knockbackDir = mob.position.clone().sub(hitPos).normalize();
                            mob.takeDamage(proj.stats.damage, knockbackDir);
                        }
                    }
                    this.particles.emit(hitPos, 'explosion', 30, 0xffaa00);
                } else {
                    this.particles.emit(hitPos, 'magic_burst', 15, proj.color);
                }
                return true;
            }
            return false;
        });

        // Render
        if (this.atlas && this.atlas.updateAnimatedTextures) {
            this.atlas.updateAnimatedTextures(time);
        }
        
        // 1. Main Render Pass
        this.engine.renderer.autoClear = false;
        this.engine.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        this.engine.renderer.setScissorTest(false);
        this.engine.renderer.clear();
        this.engine.renderer.render(this.engine.scene, this.engine.camera);

        // 2. Minimap Render Pass
        const mmo = document.getElementById('minimap-overlay');
        if (this.minimapCamera && !this.ui.isOpen) {
            if (mmo) mmo.style.display = 'block';
            const mapSize = 200;
            const padding = 20;
            const rx = window.innerWidth - mapSize - padding;
            const ry = window.innerHeight - mapSize - padding;
            
            // Tilt the camera for a 2.5D map look but fixed height to avoid jump parallax
            this.minimapCamera.position.set(this.player.position.x, 250, this.player.position.z + 40);
            this.minimapCamera.lookAt(this.player.position.x, 0, this.player.position.z);
            
            this.engine.renderer.setViewport(rx, ry, mapSize, mapSize);
            this.engine.renderer.setScissor(rx, ry, mapSize, mapSize);
            this.engine.renderer.setScissorTest(true);
            
            // Clear color and depth so minimap has a clean background (sky color or black)
            this.engine.renderer.clear(); 
            
            this.viewModel.visible = false; // Don't render hands in minimap
            if (this.cloudSystem && this.cloudSystem.clouds) this.cloudSystem.clouds.visible = false; // Hide clouds
            
            // Optional: disable fog for minimap so we can see clearly
            const oldFog = this.engine.scene.fog;
            this.engine.scene.fog = null;
            
            this.engine.renderer.render(this.engine.scene, this.minimapCamera);
            
            // Update player indicator rotation
            const arrow = document.getElementById('minimap-player-arrow');
            if (arrow) {
                const lookDir = this.player.getLookDirection();
                const angle = Math.atan2(lookDir.x, -lookDir.z); 
                arrow.style.transform = `rotate(${angle}rad)`;
            }
            
            this.engine.scene.fog = oldFog;
            this.viewModel.visible = true;
            if (this.cloudSystem && this.cloudSystem.clouds) this.cloudSystem.clouds.visible = true; // Restore clouds
            if (this.engine.scene.fog) {
                this.engine.scene.fog.density = this.engine.scene.fog.baseDensity;
            }
        } else {
            if (mmo) mmo.style.display = 'none';
        }
        
        // Reset viewport for UI
        this.engine.renderer.setScissorTest(false);
        this.engine.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        this.ui.updateHUD(this.player, this.fps, this.atlas);

        // Update HUD bars
        const hf = document.getElementById('health-fill');
        const ht = document.getElementById('health-text');
        const mf = document.getElementById('mana-fill');
        const mt = document.getElementById('mana-text');
        if (hf) hf.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
        if (ht) ht.textContent = `${Math.ceil(this.player.health)}/${this.player.maxHealth}`;
        if (mf) mf.style.width = `${(this.player.mana / this.player.maxMana) * 100}%`;
        if (mt) mt.textContent = `${Math.ceil(this.player.mana)}/${this.player.maxMana}`;
        
        // Update Boss Health Bar UI
        const bossUI = document.getElementById('boss-health-container');
        const bossNameUI = document.getElementById('boss-name');
        const bossFillUI = document.getElementById('boss-health-fill');
        let activeBoss = null;
        let closestDist = Infinity;
        
        for (const mob of this.entityManager.mobs) {
            if (mob.isBoss && mob.alive) {
                const dist = mob.position.distanceTo(this.player.position);
                if (dist < 32 && dist < closestDist) {
                    closestDist = dist;
                    activeBoss = mob;
                }
            }
        }
        
        if (bossUI) {
            if (activeBoss) {
                bossUI.style.display = 'block';
                const bossType = activeBoss.typeKey || 'BOSS';
                if (bossNameUI) bossNameUI.textContent = `${bossType} (${Math.ceil(activeBoss.health)}/${activeBoss.maxHealth})`;
                if (bossFillUI) bossFillUI.style.width = `${Math.max(0, (activeBoss.health / activeBoss.maxHealth) * 100)}%`;
            } else {
                bossUI.style.display = 'none';
            }
        }

        const di = document.getElementById('debug-info');
        if (di && !di.classList.contains('hidden')) {
            try {
                const bx = Math.floor(this.player.position.x);
                const by = Math.floor(this.player.position.y);
                const bz = Math.floor(this.player.position.z);
                const biome = this.world.getBiomeAt(bx, bz)?.name || 'Unknown';
                
                const lookDir = this.player.getLookDirection();
                const eyePos = this.player.getEyePosition();
                const hit = this.world.raycast(eyePos, lookDir, 8);
                const lookBlockName = hit.hit ? `${getBlockName(hit.blockType)} [${hit.blockPos.x}, ${hit.blockPos.y}, ${hit.blockPos.z}]` : 'None';
                
                di.innerHTML = `SlopCraft 3D (Debug Mode)<br>
FPS: ${this.fps}<br>
XYZ: ${this.player.position.x.toFixed(2)}, ${this.player.position.y.toFixed(2)}, ${this.player.position.z.toFixed(2)}<br>
Biome: ${biome}<br>
Looking at: ${lookBlockName}<br>
Chunks: ${this.world.chunks.size} | Mobs: ${this.entityManager.mobs.length} | Render Distance: ${this.world.renderDistance}`;
            } catch (e) {
                di.innerHTML = `F3 Error: ${e.message}`;
            }
        }
    }

    warpToNewPlanet() {
        this.isWarping = true;
        this.audio.playCast();

        const warpToNether = this.currentDimension !== 'nether';

        // Simple screen fade
        const fade = document.createElement('div');
        fade.style.position = 'fixed';
        fade.style.top = '0'; fade.style.left = '0';
        fade.style.width = '100%'; fade.style.height = '100%';
        fade.style.backgroundColor = warpToNether ? '#400000' : 'white';
        fade.style.opacity = '0';
        fade.style.transition = 'opacity 1.5s ease-in-out';
        fade.style.zIndex = '9999';
        fade.style.pointerEvents = 'none';
        document.body.appendChild(fade);

        setTimeout(() => { fade.style.opacity = '1'; }, 50);

        setTimeout(() => {
            if (!warpToNether) {
                // New Seed only when returning to overworld (or keep it if you want)
                this.currentSeed = Math.floor(Math.random() * 1000000);
            }
            this.planetParams = generatePlanetParams(this.currentSeed);
            this.currentDimension = warpToNether ? 'nether' : 'overworld';

            // Clear World
            for (const chunk of this.world.chunks.values()) {
                chunk.dispose();
            }
            this.world.chunks.clear();
            this.world.chunksToGenerate = [];
            this.world.chunksToBuild = [];

            // Clear entities
            for (const mob of this.entityManager.mobs) mob.dispose();
            this.entityManager.mobs = [];
            for (const item of this.entityManager.items) item.dispose();
            this.entityManager.items = [];

            // Reset Player
            const spawnPos = findSafeSpawn(this.planetParams, warpToNether);
            this.player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
            this.player.velocity.set(0, 0, 0);

            // Update UI/Env
            this.lighting.timeOfDay = 0.5;

            // Fade out
            fade.style.opacity = '0';
            setTimeout(() => {
                fade.remove();
                this.isWarping = false;
            }, 1500);

        }, 1500);
    }

    tryLightPortal(startX, startY, startZ) {
        // Find bottom-left corner of the portal inside
        // A simple flood fill or pattern match.
        // For our 4x5 portal frame, the inside is 2x3.
        
        const frameBlocks = [window.BLOCKS.OBSIDIAN, window.BLOCKS.PORTAL_FRAME];
        
        // Scan around the click to find a suitable 2x3 air/empty space surrounded by frame blocks
        let foundPortal = false;
        
        for (let xOffset = -3; xOffset <= 3; xOffset++) {
            for (let yOffset = -4; yOffset <= 4; yOffset++) {
                const px = startX + xOffset;
                const py = startY + yOffset;
                const pz = startZ;
                
                // Check if this could be the bottom-left inside block of the portal
                let isValidFrame = true;
                
                // Check the 2x3 inside is empty
                for (let ix = 0; ix < 2; ix++) {
                    for (let iy = 0; iy < 3; iy++) {
                        const b = this.world.getBlock(px + ix, py + iy, pz);
                        if (b !== window.BLOCKS.AIR) {
                            isValidFrame = false;
                            break;
                        }
                    }
                    if (!isValidFrame) break;
                }
                
                if (!isValidFrame) continue;
                
                // Check the border around the 2x3 is all frame blocks
                // Bottom: (px, py-1), (px+1, py-1)
                // Top: (px, py+3), (px+1, py+3)
                // Left: (px-1, py), (px-1, py+1), (px-1, py+2)
                // Right: (px+2, py), (px+2, py+1), (px+2, py+2)
                const borderOffsets = [
                    [0, -1], [1, -1],   // Bottom
                    [0, 3], [1, 3],     // Top
                    [-1, 0], [-1, 1], [-1, 2], // Left
                    [2, 0], [2, 1], [2, 2]     // Right
                ];
                
                for (let o of borderOffsets) {
                    const b = this.world.getBlock(px + o[0], py + o[1], pz);
                    if (!frameBlocks.includes(b)) {
                        isValidFrame = false;
                        break;
                    }
                }
                
                if (isValidFrame) {
                    // It's a valid portal frame!
                    foundPortal = true;
                    // Light it!
                    for (let ix = 0; ix < 2; ix++) {
                        for (let iy = 0; iy < 3; iy++) {
                            this.world.setBlock(px + ix, py + iy, pz, window.BLOCKS.PORTAL);
                        }
                    }
                    return;
                }
            }
        }
    }
}

// Start game on load
window.onload = () => {
    const game = new Game();
    const startBtn = document.getElementById('btn-new-game');
    if (startBtn) {
        startBtn.onclick = () => {
            document.getElementById('start-screen').classList.add('hidden');
            game.start();
        };
    } else {
        game.start(); // fallback if no button
    }
};
