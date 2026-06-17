// ============================================
// main.js — Entry Point and Game Loop
// ============================================
import * as THREE from 'three';
import { GameEngine, InputManager, CHUNK_SIZE, CHUNK_HEIGHT, World } from './engine.js';
import { createTextureAtlas, getBlockProperties, getBlockName, BLOCKS } from './textures.js';
import { generatePlanetParams, generateChunkTerrain } from './generation.js';
import { Player, EntityManager, Mob, MOB_TYPES, Item } from './entities.js';
import { LightingSystem, ParticleSystem, UISystem, TorchLightSystem, CloudSystem, MeteorShowerSystem } from './systems.js';
import { ProjectileManager, SpellProjectile } from './magic.js';
import { AudioManager } from './audio.js';

// Helper: find safe spawn location
function findSafeSpawn(params) {
    const centerBlocks = generateChunkTerrain(0, 0, params);
    
    // Search spiral from center to find a solid block that isn't under liquid
    const searchRadius = Math.floor(CHUNK_SIZE / 2);
    for (let r = 0; r < searchRadius; r++) {
        for (let x = CHUNK_SIZE/2 - r; x <= CHUNK_SIZE/2 + r; x++) {
            for (let z = CHUNK_SIZE/2 - r; z <= CHUNK_SIZE/2 + r; z++) {
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
    return { x: CHUNK_SIZE/2, y: CHUNK_HEIGHT + 10, z: CHUNK_SIZE/2 };
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
        const canvas = document.getElementById('game-canvas');
        this.engine.init(canvas);

        // Create dynamic HUD elements
        this._createHUDElements();
        this.input.init(canvas);

        // Generate textures
        this.atlas = createTextureAtlas();
        
        // Planet Generation
        this.planetParams = generatePlanetParams(Math.random() * 1000000);
        this.world = new World(this.engine.scene, this.atlas);
        
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
        this.engine.scene.fog = new THREE.Fog(this.planetParams.skyColor || 0x87ceeb, renderDistBlocks * 0.75, renderDistBlocks);
        
        // Block outline
        const outlineGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const outlineMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        this.blockOutline = new THREE.LineSegments(new THREE.EdgesGeometry(outlineGeo), outlineMat);
        this.engine.scene.add(this.blockOutline);
        this.blockOutline.visible = false;

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
            if (!this.input.isLocked && !this.ui.isOpen && document.getElementById('start-screen').classList.contains('hidden')) {
                // We lost pointer lock but the inventory is not open, show pause
                document.getElementById('pause-screen').classList.remove('hidden');
                this.isPaused = true;
            } else {
                document.getElementById('pause-screen').classList.add('hidden');
                this.isPaused = false;
            }
        });

        this.loop();
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
                <div id="debug-info" class="hidden"></div>
            `;
            document.body.appendChild(hud);
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
        const speed = Math.sqrt(this.player.velocity.x**2 + this.player.velocity.z**2);
        if (this.player.grounded && speed > 0.5) {
            this.viewModel.position.y = Math.sin(performance.now() * 0.01) * 0.05;
            this.viewModel.position.x = Math.cos(performance.now() * 0.005) * 0.05;
        } else {
            this.viewModel.position.lerp(new THREE.Vector3(0,0,0), 0.1);
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
                        -s,-s,-s,  s,-s,s,  s,s,s,  -s,s,-s,
                        -s,-s,s,   s,-s,-s, s,s,-s, -s,s,s
                    ];
                    const uvInfo = this.atlas.getUV(slot.item.subtype, 'side');
                    const uvs = [];
                    for(let i=0; i<2; i++) {
                        uvs.push(uvInfo.u, uvInfo.v,  uvInfo.u + uvInfo.uSize, uvInfo.v,  uvInfo.u + uvInfo.uSize, uvInfo.v + uvInfo.vSize,  uvInfo.u, uvInfo.v + uvInfo.vSize);
                    }
                    const indices = [0,1,2, 0,2,3, 4,5,6, 4,6,7];
                    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    geom.setIndex(indices);
                    geom.computeVertexNormals();
                    this.heldItemMesh = new THREE.Mesh(geom, mat);
                } else {
                    const geom = new THREE.BoxGeometry(0.25, 0.25, 0.25).toNonIndexed();
                    const uvs = geom.attributes.uv.array;
                    const faceNames = ['side', 'side', 'top', 'bottom', 'side', 'side'];
                    for(let i=0; i<6; i++) {
                        const uvInfo = this.atlas.getUV(slot.item.subtype, faceNames[i]);
                        for(let v=0; v<6; v++) {
                            const baseU = uvs[i*12 + v*2];
                            const baseV = uvs[i*12 + v*2 + 1];
                            uvs[i*12 + v*2] = uvInfo.u + baseU * uvInfo.uSize;
                            uvs[i*12 + v*2 + 1] = uvInfo.v + baseV * uvInfo.vSize;
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
                entityHit.mob.takeDamage(this.player.equippedWand ? 10 : 5, lookDir);
                this.audio.playHit();
                this.particles.emit(entityHit.mob.position, 'blood', 5, 0xff0000);
                this.input.mouse.leftClick = false; // single attack per click
                this.breakTimer = 0.5; // attack cooldown reuse breakTimer
            } else if (hit.hit && this.breakTimer >= 0) { // Mine block
                this.breakTimer += dt;
                
                // Breaking particles (cracks)
                if (Math.random() < 0.2) this.particles.emit(hit.position, 'block_break', 1, 0x555555);
                
                const blockProps = getBlockProperties(hit.blockType);
                const breakTime = (blockProps.health || 1) * 0.1;
                
                const scale = 1.02 - (this.breakTimer / breakTime) * 0.2;
                this.blockOutline.scale.set(scale, scale, scale);

                if (this.breakTimer >= breakTime) {
                    const blockType = this.world.getBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
                    this.world.setBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, BLOCKS.AIR);
                    if (blockType === BLOCKS.TORCH) this.torchSystem.removeTorch(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z);
                    
                    const props = getBlockProperties(blockType);
                    if (blockType !== BLOCKS.AIR && blockType !== BLOCKS.WATER && blockType !== BLOCKS.LAVA) {
                        const dropType = props.drops !== undefined && props.drops !== null ? props.drops : blockType;
                        this.entityManager.spawnItem(Item.blockItem(dropType, getBlockName(dropType)), 1, new THREE.Vector3(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5));
                    }

                    this.particles.emit(hit.position, 'block_break', 15);
                    this.audio.playBreak();
                    this.breakTimer = 0;
                    this.blockOutline.scale.set(1, 1, 1);
                }
            }
        } else {
            this.viewModel.rotation.x = 0;
            this.breakTimer = 0;
            this.blockOutline.scale.set(1, 1, 1);
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
        }
        
        if (this.isPaused) {
            this.input.resetMouse();
            return;
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
                this.player.velocity.set(0,0,0);
                this.audio.playHit();
            }
        }
        
        this.input.resetMouse();

        // Update Camera to match player eyes
        const eyePos = this.player.getEyePosition();
        this.engine.camera.position.copy(eyePos);
        const lookDir = this.player.getLookDirection();
        this.engine.camera.lookAt(eyePos.clone().add(lookDir));
        // Check Portal Warp
        const pbx = Math.floor(this.player.position.x);
        const pby = Math.floor(this.player.position.y);
        const pbz = Math.floor(this.player.position.z);
        if (this.world.getBlock(pbx, pby, pbz) === BLOCKS.PORTAL && !this.isWarping) {
            this.warpToNewPlanet();
        }

        // Update World (Chunks)
        this.world.update(this.player.position, (cx, cz) => generateChunkTerrain(cx, cz, this.planetParams), dt);

        // Update Systems
        const headX = Math.floor(this.engine.camera.position.x);
        const headY = Math.floor(this.engine.camera.position.y);
        const headZ = Math.floor(this.engine.camera.position.z);
        const headBlock = this.world.getBlock(headX, headY, headZ);
        const isUnderwater = window.getBlockProperties ? window.getBlockProperties(headBlock).isLiquid : 
                             (getBlockProperties ? getBlockProperties(headBlock).isLiquid : false);

        this.lighting.update(dt, this.engine.camera.position, isUnderwater);
        
        if (this.engine.scene.fog) {
            if (isUnderwater) {
                this.engine.scene.fog.near = 0;
                this.engine.scene.fog.far = 15;
            } else {
                const renderDistBlocks = (this.engine.renderDistance || 8) * 16;
                this.engine.scene.fog.near = renderDistBlocks * 0.75;
                this.engine.scene.fog.far = renderDistBlocks;
            }
        }
        this.particles.update(dt);
        this.cloudSystem.update(dt, this.engine.camera.position);
        this.meteorSystem.update(dt, this.player.position);
        this.entityManager.update(dt, this.world, this.player.position, this.player.inventory, this.player);
        this.projectileManager.update(dt, (proj) => {
            let hitFound = false;
            let hitPos = proj.position.clone();

            // Check entities
            const eHit = this.entityManager.raycast(proj.position, proj.velocity.clone().normalize(), dt * proj.stats.speed + 0.5);
            if (eHit.hit && eHit.mob) {
                hitFound = true;
                hitPos = eHit.mob.position.clone();
                if (proj.stats.element === 'ICE') {
                    eHit.mob.takeDamage(proj.stats.damage, proj.velocity.clone().normalize());
                    eHit.mob.freeze(3.0); // 3 seconds freeze
                } else if (proj.stats.element !== 'FIRE') {
                    // Normal hit
                    eHit.mob.takeDamage(proj.stats.damage, proj.velocity.clone().normalize());
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
        this.engine.renderer.render(this.engine.scene, this.engine.camera);
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
        const di = document.getElementById('debug-info');
        if (di && !di.classList.contains('hidden')) {
            const bx = Math.floor(this.player.position.x);
            const by = Math.floor(this.player.position.y);
            const bz = Math.floor(this.player.position.z);
            const biome = this.planetParams?.biome?.name || 'Unknown';
            const blockName = getBlockName(this.world.getBlock(bx, by - 1, bz)) || 'Air';
            di.innerHTML = `Voxel Odyssey (Debug Mode)<br>
FPS: ${this.fps}<br>
XYZ: ${bx}, ${by}, ${bz}<br>
Biome: ${biome}<br>
Looking at: ${blockName}<br>
Chunks: ${this.world.chunks.size} | Mobs: ${this.entityManager.mobs.length} | Render Distance: ${this.world.renderDistance}`;
        }
    }

    warpToNewPlanet() {
        this.isWarping = true;
        this.audio.playCast();
        
        // Simple screen fade
        const fade = document.createElement('div');
        fade.style.position = 'fixed';
        fade.style.top = '0'; fade.style.left = '0';
        fade.style.width = '100%'; fade.style.height = '100%';
        fade.style.backgroundColor = 'white';
        fade.style.opacity = '0';
        fade.style.transition = 'opacity 1.5s ease-in-out';
        fade.style.zIndex = '9999';
        fade.style.pointerEvents = 'none';
        document.body.appendChild(fade);

        setTimeout(() => { fade.style.opacity = '1'; }, 50);

        setTimeout(() => {
            // New Seed
            this.currentSeed = Math.floor(Math.random() * 1000000);
            this.planetParams = generatePlanetParams(this.currentSeed);
            
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
            const spawnPos = findSafeSpawn(this.planetParams);
            this.player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
            this.player.velocity.set(0,0,0);
            
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
