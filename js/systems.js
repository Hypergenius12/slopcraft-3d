// ============================================
// systems.js — Lighting, Particles, Audio, UI
// ============================================
import * as THREE from 'three';
import { BLOCKS, generateItemTexture } from './textures.js';

export class LightingSystem {
    constructor(scene) {
        this.scene = scene;
        this.timeOfDay = 0.3; // start in morning
        this.dayLength = 600; // seconds

        this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444455, 0.8);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xffffdd, 1.2);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 200;
        const d = 80;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.001; // fix shadow acne
        this.sunLight.shadow.normalBias = 0.05; // fix shadow blinds
        this.scene.add(this.sunLight);

        // Sun Mesh
        const sunGeo = new THREE.SphereGeometry(3, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffdd });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        // SkyDome Shader
        const skyGeo = new THREE.SphereGeometry(400, 32, 15);
        this.skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide,
            fog: false
        });
        this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
        this.scene.add(this.skyDome);
    }
    
    _getLightState(time) {
        // 0.0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1.0 = midnight
        const states = [
            // Midnight - slightly brighter so you can see without torches
            { t: 0.0, amb: new THREE.Color(0x555566), bg: new THREE.Color(0x101018), top: new THREE.Color(0x0a0a14), sun: 0.0, hemi: 0.6 },
            { t: 0.2, amb: new THREE.Color(0x555566), bg: new THREE.Color(0x101018), top: new THREE.Color(0x0a0a14), sun: 0.0, hemi: 0.6 },
            // Sunrise - pink/orange horizon, light blue top
            { t: 0.25, amb: new THREE.Color(0x8a6b52), bg: new THREE.Color(0xffa65a), top: new THREE.Color(0x82a6ff), sun: 0.8, hemi: 0.8 },
            // Day - bright Minecraft blue, high ambient light for soft shadows
            { t: 0.3, amb: new THREE.Color(0xdddddd), bg: new THREE.Color(0xcceeff), top: new THREE.Color(0x88ccff), sun: 1.5, hemi: 1.2 },
            { t: 0.7, amb: new THREE.Color(0xdddddd), bg: new THREE.Color(0xcceeff), top: new THREE.Color(0x88ccff), sun: 1.5, hemi: 1.2 },
            // Sunset - orange/red horizon
            { t: 0.75, amb: new THREE.Color(0x8a5050), bg: new THREE.Color(0xff5a5a), top: new THREE.Color(0x5a82f2), sun: 0.8, hemi: 0.8 },
            // Night
            { t: 0.8, amb: new THREE.Color(0x555566), bg: new THREE.Color(0x101018), top: new THREE.Color(0x0a0a14), sun: 0.0, hemi: 0.6 },
            { t: 1.0, amb: new THREE.Color(0x555566), bg: new THREE.Color(0x101018), top: new THREE.Color(0x0a0a14), sun: 0.0, hemi: 0.6 }
        ];

        for (let i = 0; i < states.length - 1; i++) {
            if (time >= states[i].t && time <= states[i+1].t) {
                const fraction = (time - states[i].t) / (states[i+1].t - states[i].t);
                const amb = states[i].amb.clone().lerp(states[i+1].amb, fraction);
                const bg = states[i].bg.clone().lerp(states[i+1].bg, fraction);
                const top = states[i].top.clone().lerp(states[i+1].top, fraction);
                const sun = states[i].sun + (states[i+1].sun - states[i].sun) * fraction;
                const hemi = states[i].hemi + (states[i+1].hemi - states[i].hemi) * fraction;
                return { amb, bg, top, sun, hemi };
            }
        }
        return states[0]; // fallback
    }
    
    update(dt, cameraPos, isUnderwater = false) {
        this.timeOfDay += dt / this.dayLength;
        if (this.timeOfDay > 1) this.timeOfDay -= 1;

        const angle = (this.timeOfDay - 0.5) * Math.PI * 2;
        
        // Sun position
        const sunDist = 80;
        this.sunLight.position.set(
            cameraPos.x + Math.sin(angle) * sunDist,
            cameraPos.y + Math.cos(angle) * sunDist,
            cameraPos.z
        );
        this.sunLight.target.position.copy(cameraPos);
        this.sunLight.target.updateMatrixWorld();
        this.sunMesh.position.copy(this.sunLight.position);

        this.skyDome.position.copy(cameraPos);

        // Smooth color interpolation
        const state = this._getLightState(this.timeOfDay);
        this.sunLight.intensity = state.sun;

        this.hemiLight.color.copy(state.top);
        this.hemiLight.groundColor.copy(state.amb);
        this.hemiLight.intensity = state.hemi;
        
        this.scene.background = isUnderwater ? new THREE.Color(0x3377aa) : state.bg;
        if (this.scene.fog) {
            this.scene.fog.color.copy(this.scene.background);
            if (isUnderwater) {
                this.scene.fog.density = 0.05;
            } else {
                this.scene.fog.density = this.scene.fog.baseDensity || 0.01;
            }
        }
        
        // Update SkyDome gradient
        this.skyMat.uniforms.topColor.value.copy(state.top);
        this.skyMat.uniforms.bottomColor.value.copy(state.bg);
    }
}

export class TorchLightSystem {
    constructor(scene) {
        this.scene = scene;
        this.lights = new Map();
    }

    addTorch(x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.lights.has(key)) return;
        
        // Brighter intensity, larger distance, less decay so the area is well lit
        const light = new THREE.PointLight(0xffcc55, 12.0, 40);
        light.decay = 1.2;
        light.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.scene.add(light);
        this.lights.set(key, light);
    }

    removeTorch(x, y, z) {
        const key = `${x},${y},${z}`;
        const light = this.lights.get(key);
        if (light) {
            this.scene.remove(light);
            light.dispose();
            this.lights.delete(key);
        }
    }
}

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    emit(pos, type, count = 10, color = 0xffffff) {
        for(let i=0; i<count; i++) {
            const mat = this.material.clone();
            mat.color.setHex(color);
            const mesh = new THREE.Mesh(this.geometry, mat);
            mesh.position.copy(pos);
            
            const vel = new THREE.Vector3(
                (Math.random()-0.5)*5,
                (Math.random()-0.5)*5 + 2,
                (Math.random()-0.5)*5
            );
            
            this.scene.add(mesh);
            this.particles.push({ mesh, vel, age: 0, maxAge: 0.5 + Math.random() });
        }
    }

    update(dt) {
        for(let i=this.particles.length-1; i>=0; i--) {
            const p = this.particles[i];
            p.age += dt;
            if(p.age >= p.maxAge) {
                this.scene.remove(p.mesh);
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            } else {
                p.mesh.position.addScaledVector(p.vel, dt);
                p.vel.y -= 9.8 * dt; // gravity
            }
        }
    }
}

class UISystem {
    constructor() {
        this.elements = {
            geometricUI: document.getElementById('geometric-ui'),
            mainGrid: document.getElementById('main-inventory-grid'),
            invHotbar: document.getElementById('inv-hotbar-grid'),
            mainHotbar: document.getElementById('main-hotbar-grid'),
            wandConfigPanel: document.getElementById('wand-config-panel'),
            wandSlotsGrid: document.getElementById('wand-slots-grid'),
            dragIcon: document.getElementById('drag-item-icon'),
            tooltip: document.getElementById('item-tooltip'),
            craftingGrid: document.getElementById('crafting-grid'),
            craftingOutput: document.getElementById('crafting-output'),
            craftingRecipeName: document.getElementById('crafting-recipe-name'),
            chestPanel: document.getElementById('chest-panel'),
            chestGrid: document.getElementById('chest-grid'),
            furnacePanel: document.getElementById('furnace-panel'),
            furnaceInput: document.getElementById('furnace-input'),
            furnaceFuel: document.getElementById('furnace-fuel'),
            furnaceOutput: document.getElementById('furnace-output'),
            furnaceProgress: document.getElementById('furnace-progress'),
            furnaceFire: document.getElementById('furnace-fire')
        };
        this.isOpen = false;
        this.chestPos = null;
        this.chestInventory = null;
        this.onChestClose = null;
        this.furnacePos = null;
        this.furnaceData = null;
        this.onFurnaceClose = null;
        this.atlas = null;
        
        // 4 crafting slots (2x2 grid)
        this.craftingSlots = [null, null, null, null];

        this.dragState = {
            isDragging: false,
            sourceType: null, // 'inventory' | 'wand' | 'crafting' | 'crafting_output'
            sourceIndex: -1,
            itemData: null,
            offsetX: 0, offsetY: 0
        };

        this.currentPlayer = null;

        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));

        this._initCraftingGrid();
        this._initArmorSlots();
        this._initFurnaceSlots();

        const btnRecipeBook = document.getElementById('btn-recipe-book');
        const modalRecipeBook = document.getElementById('recipe-book-modal');
        const btnCloseRecipes = document.getElementById('btn-close-recipes');
        if (btnRecipeBook && modalRecipeBook && btnCloseRecipes) {
            btnRecipeBook.onclick = () => {
                modalRecipeBook.classList.remove('hidden');
                this._populateRecipeBook();
            };
            btnCloseRecipes.onclick = () => modalRecipeBook.classList.add('hidden');
        }
    }

    toggle() {
        if (!this.isOpen && this.chestPos) {
            // Can't just toggle inventory if chest is open without closing chest
            this.toggleChest(null, null, null, null, null);
        }

        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.elements.geometricUI.classList.remove('hidden');
        } else {
            this.elements.geometricUI.classList.add('hidden');
            this.elements.tooltip.classList.add('hidden');
            if (this.dragState.isDragging) this.cancelDrag();
            
            // Close chest if open
            if (this.chestPos) {
                if (this.onChestClose) this.onChestClose();
                this.chestPos = null;
                this.chestInventory = null;
                this.onChestClose = null;
                this.elements.chestPanel.classList.add('hidden');
            }
            // Close furnace if open
            if (this.furnacePos) {
                if (this.onFurnaceClose) this.onFurnaceClose();
                this.furnacePos = null;
                this.furnaceData = null;
                this.onFurnaceClose = null;
                this.elements.furnacePanel.classList.add('hidden');
            }
        }
    }

    toggleChest(x, y, z, inventory, onClose) {
        if (this.chestPos && this.chestPos.x === x && this.chestPos.y === y && this.chestPos.z === z) {
            this.toggle(); // Close it
            return;
        }

        if (!this.isOpen) {
            this.toggle(); // Open UI
        }

        this.chestPos = {x, y, z};
        this.chestInventory = inventory;
        this.onChestClose = onClose;
        this.elements.chestPanel.classList.remove('hidden');
    }

    toggleFurnace(x, y, z, data, onClose) {
        if (this.furnacePos && this.furnacePos.x === x && this.furnacePos.y === y && this.furnacePos.z === z) {
            this.toggle(); // Close it
            return;
        }

        if (!this.isOpen) {
            this.toggle();
        }

        this.furnacePos = {x, y, z};
        this.furnaceData = data;
        this.onFurnaceClose = onClose;
        this.elements.furnacePanel.classList.remove('hidden');
    }

    updateHUD(player, fps, atlas) {
        if (!player) return;
        this.currentPlayer = player;
        this.atlas = atlas;

        // Render Always-Visible Hotbar
        this.renderGrid(this.elements.mainHotbar, player.inventory.slots.slice(0, 9), 0, player, 'inventory');
        
        // If open, render full inventory
        if (this.isOpen) {
            this.renderGrid(this.elements.mainGrid, player.inventory.slots.slice(9, 36), 9, player, 'inventory');
            this.renderGrid(this.elements.invHotbar, player.inventory.slots.slice(0, 9), 0, player, 'inventory');
            
            // Render Wand Config if holding wand
            const activeSlot = player.inventory.slots[player.selectedSlot];
            if (activeSlot && activeSlot.item.type === 'wand') {
                this.elements.wandConfigPanel.classList.remove('hidden');
                this.renderWandConfig(activeSlot.item);
            } else {
                this.elements.wandConfigPanel.classList.add('hidden');
            }

            // Render crafting slots
            this._updateCraftingSlots();
            this._updateCraftingOutput();

            // Render armor slots
            this._updateArmorSlots();

            // Render chest if open
            if (this.chestPos && this.chestInventory) {
                this.renderGrid(this.elements.chestGrid, this.chestInventory, 0, player, 'chest');
            }

            // Render furnace if open
            if (this.furnacePos && this.furnaceData) {
                this._updateFurnaceSlots();
            }
        }
    }

    renderGrid(container, slotsData, offsetIndex, player, type) {
        if (!container) return;
        if (container.children.length !== slotsData.length) {
            container.innerHTML = '';
            for (let i = 0; i < slotsData.length; i++) {
                const el = document.createElement('div');
                el.className = 'inv-slot';
                const actualIndex = offsetIndex + i;
                
                el.onmousedown = (e) => this.onSlotMouseDown(e, type, actualIndex);
                el.onmouseenter = (e) => this.onSlotEnter(e, type, actualIndex);
                el.onmouseleave = () => this.onSlotLeave();
                el.onmouseup = (e) => this.onSlotMouseUp(e, type, actualIndex);

                container.appendChild(el);
            }
        }

        for (let i = 0; i < slotsData.length; i++) {
            const el = container.children[i];
            const actualIndex = offsetIndex + i;
            const slot = slotsData[i];
            
            if (type === 'inventory' && actualIndex === player.selectedSlot) el.classList.add('active');
            else el.classList.remove('active');

            if (this.dragState.isDragging && this.dragState.sourceType === type && this.dragState.sourceIndex === actualIndex) {
                el.style.opacity = '0.3';
            } else {
                el.style.opacity = '1.0';
            }

            this.renderSlotItem(el, slot);
        }
    }

    renderWandConfig(wandItem) {
        if (!wandItem || !wandItem.data || !wandItem.data.wand) return;
        const wand = wandItem.data.wand;
        
        // Build array of slots [{item: spell, count: 1}] to reuse renderGrid
        const slotsData = wand.spellSlots.map(spell => spell ? { item: spell, count: 1 } : null);
        this.renderGrid(this.elements.wandSlotsGrid, slotsData, 0, this.currentPlayer, 'wand');
    }

    renderSlotItem(el, slot) {
        const cacheKey = slot ? `${slot.item.id}_${slot.count}` : 'empty';
        if (el._cacheKey === cacheKey) return;
        el._cacheKey = cacheKey;
        if (slot && slot.item) {
            let inner = '';
            if (slot.item.type === 'block' && this.atlas) {
                // Use the 3D isometric icon canvas
                const iconCanvas = this.atlas.getBlockIcon(slot.item.subtype);
                const dataURL = iconCanvas.toDataURL();
                inner = `<img src="${dataURL}" class="item-icon" draggable="false" />`;
            } else if (slot.item.type === 'wand') {
                const cvs = generateItemTexture('wand', slot.item.subtype || 'wand_basic');
                inner = `<img src="${cvs.toDataURL()}" class="item-icon" draggable="false" style="image-rendering: pixelated; width: 100%; height: 100%;" />`;
            } else if (slot.item.type === 'spell') {
                const cvs = generateItemTexture('spell', slot.item.data.spell.element || 'spell_basic');
                inner = `<img src="${cvs.toDataURL()}" class="item-icon" draggable="false" style="image-rendering: pixelated; width: 100%; height: 100%;" />`;
            } else if (slot.item.type === 'material') {
                const cvs = generateItemTexture('material', slot.item.subtype);
                inner = `<img src="${cvs.toDataURL()}" class="item-icon" draggable="false" style="image-rendering: pixelated; width: 100%; height: 100%;" />`;
            } else if (slot.item.type === 'equipment') {
                const cvs = generateItemTexture('equipment', slot.item.subtype);
                inner = `<img src="${cvs.toDataURL()}" class="item-icon" draggable="false" style="image-rendering: pixelated; width: 100%; height: 100%;" />`;
            } else {
                inner = `<div style="text-align:center; line-height:100%;">${slot.item.name.substring(0,2).toUpperCase()}</div>`;
            }
            if (slot.count > 1) inner += `<span class="item-count">${slot.count}</span>`;
            el.innerHTML = inner;
        } else {
            el.innerHTML = '';
        }
    }

    // --- Drag & Drop ---
    onSlotMouseDown(e, type, index) {
        if (!this.isOpen || (e.button !== 0 && e.button !== 2)) return;
        let slot = null;
        if (type === 'inventory') slot = this.currentPlayer.inventory.slots[index];
        else if (type === 'crafting') slot = this.craftingSlots[index];
        else if (type === 'crafting_output') {
            const result = this._matchRecipe();
            if (result) {
                // Prevent partial stack dupe by checking if we have space first
                const inv = this.currentPlayer.inventory;
                let space = 0;
                if (result.item.stackable) {
                    for (const s of inv.slots) {
                        if (!s) space += result.item.maxStack;
                        else if (s.item.type === result.item.type && s.item.subtype === result.item.subtype) {
                            space += (s.item.maxStack - s.count);
                        }
                    }
                } else {
                    space = inv.slots.filter(s => !s).length;
                }
                
                if (space >= result.count) {
                    this._consumeCraftingSlots();
                    inv.addItem(result.item, result.count);
                    this._updateCraftingSlots();
                    this._updateCraftingOutput();
                }
            }
            return;
        } else if (type === 'armor') {
            slot = this.currentPlayer.inventory.armor[index];
        } else if (type === 'wand') {
            const w = this.currentPlayer.inventory.slots[this.currentPlayer.selectedSlot];
            if (w && w.item.type === 'wand') slot = w.item.data.wand.spellSlots[index] ? { item: w.item.data.wand.spellSlots[index], count: 1 } : null;
        } else if (type === 'furnace') {
            if (index === 0) slot = this.furnaceData.input;
            else if (index === 1) slot = this.furnaceData.fuel;
            else if (index === 2) {
                slot = this.furnaceData.output; // Can pick up output
            }
        }
        
        if (slot) {
            this.dragState.isDragging = true;
            this.dragState.sourceType = type;
            this.dragState.sourceIndex = index;

            if (e.button === 2 && slot.item.stackable && slot.count > 1) {
                const dragCount = Math.floor(slot.count / 2);
                slot.count -= dragCount;
                this.dragState.itemData = { item: slot.item, count: dragCount };
                this.dragState.isSplit = true;
            } else {
                this.dragState.itemData = slot;
                this.dragState.isSplit = false;
                // If not split, temporarily clear the source slot so it doesn't render while dragging
                if (type === 'inventory') this.currentPlayer.inventory.slots[index] = null;
                else if (type === 'crafting') this.craftingSlots[index] = null;
                else if (type === 'armor') this.currentPlayer.inventory.armor[index] = null;
                else if (type === 'furnace') {
                    if (index === 0) this.furnaceData.input = null;
                    else if (index === 1) this.furnaceData.fuel = null;
                    else if (index === 2) this.furnaceData.output = null;
                }
            }
            
            this._updateInventory();
            this._updateCraftingSlots();
            this._updateArmorSlots();
            this._updateFurnaceSlots();
            
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            this.dragState.offsetX = e.clientX - rect.left - rect.width/2;
            this.dragState.offsetY = e.clientY - rect.top - rect.height/2;
            
            this.elements.dragIcon.classList.remove('hidden');
            this.renderSlotItem(this.elements.dragIcon, this.dragState.itemData);
            this.updateDragIconPos(e.clientX, e.clientY);
            this.elements.tooltip.classList.add('hidden');
        }
    }

    onMouseMove(e) {
        if (this.dragState.isDragging) {
            this.updateDragIconPos(e.clientX, e.clientY);
        } else if (this.isOpen && !this.elements.tooltip.classList.contains('hidden')) {
            this.elements.tooltip.style.left = (e.clientX + 15) + 'px';
            this.elements.tooltip.style.top = (e.clientY + 15) + 'px';
        }
    }

    updateDragIconPos(x, y) {
        this.elements.dragIcon.style.left = (x - this.dragState.offsetX) + 'px';
        this.elements.dragIcon.style.top = (y - this.dragState.offsetY) + 'px';
    }

    onMouseUp(e) {
        if (this.dragState.isDragging) {
            // Handled mostly by onSlotMouseUp if dropped on a slot.
            // If dropped outside, cancel drag (or throw item).
            // Small timeout allows onSlotMouseUp to fire first if over a slot.
            setTimeout(() => {
                if (this.dragState.isDragging) this.cancelDrag();
            }, 10);
        }
    }

    cancelDrag() {
        if (this.dragState.isDragging && this.dragState.itemData) {
            // Return item to source
            const srcType = this.dragState.sourceType;
            const srcIndex = this.dragState.sourceIndex;
            const itemData = this.dragState.itemData;
            
            if (srcType === 'inventory') {
                if (this.dragState.isSplit) {
                    this.currentPlayer.inventory.slots[srcIndex].count += itemData.count;
                } else {
                    this.currentPlayer.inventory.slots[srcIndex] = itemData;
                }
            } else if (srcType === 'crafting') {
                if (this.dragState.isSplit) {
                    this.craftingSlots[srcIndex].count += itemData.count;
                } else {
                    this.craftingSlots[srcIndex] = itemData;
                }
            } else if (srcType === 'armor') {
                this.currentPlayer.inventory.armor[srcIndex] = itemData;
            } else if (srcType === 'chest' && this.chestInventory) {
                if (this.dragState.isSplit) {
                    this.chestInventory[srcIndex].count += itemData.count;
                } else {
                    this.chestInventory[srcIndex] = itemData;
                }
            } else if (srcType === 'furnace' && this.furnaceData) {
                const mapKey = ['input', 'fuel', 'output'][srcIndex];
                if (this.dragState.isSplit) {
                    this.furnaceData[mapKey].count += itemData.count;
                } else {
                    this.furnaceData[mapKey] = itemData;
                }
            }
            this._updateInventory();
            this._updateCraftingSlots();
            this._updateArmorSlots();
            this._updateFurnaceSlots();
            // Since there's no _updateChest, we rely on the main loop's updateHUD for chest redraw
        }
        this.dragState.isDragging = false;
        this.elements.dragIcon.classList.add('hidden');
        this.dragState.itemData = null;
        this.dragState.isSplit = false;
    }

    onSlotMouseUp(e, targetType, targetIndex) {
        if (!this.dragState.isDragging) return;
        
        const srcType = this.dragState.sourceType;
        const srcIndex = this.dragState.sourceIndex;
        const itemData = this.dragState.itemData;
        
        // Prevent dropping onto self
        if (srcType === targetType && srcIndex === targetIndex) {
            this.cancelDrag();
            return;
        }

        const inv = this.currentPlayer.inventory.slots;
        let wand = null;
        if (targetType === 'wand' || srcType === 'wand') {
            const wSlot = inv[this.currentPlayer.selectedSlot];
            if (wSlot && wSlot.item.type === 'wand') wand = wSlot.item.data.wand;
        }

        // --- Execute Move/Swap ---
        if (srcType === 'inventory' && targetType === 'armor') {
            // Equip from inventory to armor
            const targetArmor = this.currentPlayer.inventory.armor[targetIndex];
            this.currentPlayer.inventory.armor[targetIndex] = itemData;
            inv[srcIndex] = targetArmor; // swap back
        } else if (srcType === 'armor' && targetType === 'inventory') {
            // Unequip armor to inventory
            const targetSlot = inv[targetIndex];
            inv[targetIndex] = this.currentPlayer.inventory.armor[srcIndex];
            this.currentPlayer.inventory.armor[srcIndex] = targetSlot;
        } else if (srcType === 'armor' && targetType === 'armor') {
            const temp = this.currentPlayer.inventory.armor[targetIndex];
            this.currentPlayer.inventory.armor[targetIndex] = this.currentPlayer.inventory.armor[srcIndex];
            this.currentPlayer.inventory.armor[srcIndex] = temp;
        } else if (srcType === 'crafting' && targetType === 'inventory') {
            // Move from crafting to inventory
            const targetSlot = inv[targetIndex];
            if (!targetSlot) {
                inv[targetIndex] = itemData;
                this.craftingSlots[srcIndex] = null;
            } else {
                this.craftingSlots[srcIndex] = targetSlot;
                inv[targetIndex] = itemData;
            }
        } else if (srcType === 'inventory' && targetType === 'crafting') {
            // Move from inventory to crafting
            const targetCraft = this.craftingSlots[targetIndex];
            if (!targetCraft) {
                this.craftingSlots[targetIndex] = itemData;
            } else if (targetCraft.item.type === itemData.item.type && targetCraft.item.subtype === itemData.item.subtype && itemData.item.stackable) {
                const add = Math.min(itemData.count, itemData.item.maxStack - targetCraft.count);
                targetCraft.count += add;
                itemData.count -= add;
                if (itemData.count > 0) {
                    if (this.dragState.isSplit) inv[srcIndex].count += itemData.count;
                    else inv[srcIndex] = itemData;
                }
            } else {
                if (this.dragState.isSplit) inv[srcIndex].count += itemData.count;
                else {
                    this.craftingSlots[targetIndex] = itemData;
                    inv[srcIndex] = targetCraft;
                }
            }
        } else if (srcType === 'crafting' && targetType === 'crafting') {
            const temp = this.craftingSlots[targetIndex];
            this.craftingSlots[targetIndex] = itemData;
            this.craftingSlots[srcIndex] = temp;
        } else if (srcType === 'inventory' && targetType === 'inventory') {
            const targetSlot = inv[targetIndex];
            if (!targetSlot) {
                inv[targetIndex] = itemData;
            } else if (targetSlot.item.type === itemData.item.type && targetSlot.item.subtype === itemData.item.subtype && targetSlot.item.stackable) {
                // Stack
                const add = Math.min(itemData.count, targetSlot.item.maxStack - targetSlot.count);
                targetSlot.count += add;
                itemData.count -= add;
                if (itemData.count > 0) {
                    if (this.dragState.isSplit) inv[srcIndex].count += itemData.count;
                    else inv[srcIndex] = itemData;
                }
            } else {
                // Swap
                if (this.dragState.isSplit) inv[srcIndex].count += itemData.count;
                else {
                    inv[srcIndex] = targetSlot;
                    inv[targetIndex] = itemData;
                }
            }
        } 
        else if (srcType === 'wand' && targetType === 'wand') {
            const temp = wand.spellSlots[targetIndex];
            wand.spellSlots[targetIndex] = wand.spellSlots[srcIndex];
            wand.spellSlots[srcIndex] = temp;
        }
        else if (srcType === 'inventory' && targetType === 'wand') {
            if (itemData.item.type === 'spell') {
                const targetSpell = wand.spellSlots[targetIndex];
                wand.spellSlots[targetIndex] = itemData.item;
                
                // Swap spell back to inventory if present, else empty src
                if (targetSpell) inv[srcIndex] = { item: targetSpell, count: 1 };
                else inv[srcIndex] = null;
            } else if (itemData.item.type === 'modifier') {
                const targetSpell = wand.spellSlots[targetIndex];
                if (targetSpell && targetSpell.addModifier) {
                    const success = targetSpell.addModifier(itemData.item);
                    if (success) {
                        inv[srcIndex].count -= 1;
                        if (inv[srcIndex].count <= 0) inv[srcIndex] = null;
                        this.renderWandConfig(this.currentPlayer.inventory.slots[this.currentPlayer.selectedSlot].item);
                    }
                }
            }
        } else if (srcType === 'wand' && targetType === 'inventory') {
            const targetSlot = inv[targetIndex];
            // Only swap if empty or also a spell
            if (!targetSlot) {
                inv[targetIndex] = { item: wand.spellSlots[srcIndex], count: 1 };
                wand.spellSlots[srcIndex] = null;
            } else if (targetSlot.item.type === 'spell') {
                wand.spellSlots[srcIndex] = targetSlot.item;
                inv[targetIndex] = { item: itemData.item, count: 1 };
            }
        } else if (srcType === 'chest' || targetType === 'chest') {
            let sList = srcType === 'inventory' ? inv : (srcType === 'chest' ? this.chestInventory : null);
            let tList = targetType === 'inventory' ? inv : (targetType === 'chest' ? this.chestInventory : null);
            
            if (sList && tList) {
                const targetSlot = tList[targetIndex];
                if (targetSlot && targetSlot.item.type === itemData.item.type && targetSlot.item.subtype === itemData.item.subtype && targetSlot.item.stackable) {
                    const add = Math.min(itemData.count, targetSlot.item.maxStack - targetSlot.count);
                    targetSlot.count += add;
                    itemData.count -= add;
                    if (itemData.count > 0) {
                        if (this.dragState.isSplit) sList[srcIndex].count += itemData.count;
                        else sList[srcIndex] = itemData;
                    }
                } else {
                    // Swap
                    if (this.dragState.isSplit) {
                        sList[srcIndex].count += itemData.count; // Return half to source if swapping
                    } else {
                        sList[srcIndex] = targetSlot;
                        tList[targetIndex] = itemData;
                    }
                }
            }
        } else if (srcType === 'furnace' || targetType === 'furnace') {
            if (targetType === 'furnace' && targetIndex === 2) {
                // Cannot drop into output
                this.cancelDrag();
                return;
            }
            
            // For simplicity, just swap or place item directly. Furnace slots are not a simple array.
            const getFurnaceSlot = (i) => i === 0 ? this.furnaceData.input : (i === 1 ? this.furnaceData.fuel : this.furnaceData.output);
            const setFurnaceSlot = (i, val) => {
                if (i === 0) this.furnaceData.input = val;
                else if (i === 1) this.furnaceData.fuel = val;
                else if (i === 2) this.furnaceData.output = val;
            };

            if (srcType === 'inventory' && targetType === 'furnace') {
                const targetSlot = getFurnaceSlot(targetIndex);
                if (targetSlot && targetSlot.item.type === itemData.item.type && targetSlot.item.subtype === itemData.item.subtype && targetSlot.item.stackable) {
                    const add = Math.min(itemData.count, targetSlot.item.maxStack - targetSlot.count);
                    targetSlot.count += add;
                    itemData.count -= add;
                    if (itemData.count > 0) {
                        if (this.dragState.isSplit) inv[srcIndex].count += itemData.count;
                        else inv[srcIndex] = itemData;
                    }
                } else {
                    if (this.dragState.isSplit) {
                        inv[srcIndex].count += itemData.count;
                    } else {
                        setFurnaceSlot(targetIndex, itemData);
                        inv[srcIndex] = targetSlot;
                    }
                }
            } else if (srcType === 'furnace' && targetType === 'inventory') {
                const targetSlot = inv[targetIndex];
                if (targetSlot && targetSlot.item.type === itemData.item.type && targetSlot.item.subtype === itemData.item.subtype && targetSlot.item.stackable) {
                    const add = Math.min(itemData.count, targetSlot.item.maxStack - targetSlot.count);
                    targetSlot.count += add;
                    itemData.count -= add;
                    if (itemData.count > 0) {
                        if (this.dragState.isSplit) getFurnaceSlot(srcIndex).count += itemData.count;
                        else setFurnaceSlot(srcIndex, itemData);
                    }
                } else {
                    if (this.dragState.isSplit) {
                        getFurnaceSlot(srcIndex).count += itemData.count;
                    } else {
                        inv[targetIndex] = itemData;
                        setFurnaceSlot(srcIndex, targetSlot);
                    }
                }
            } else if (srcType === 'furnace' && targetType === 'furnace') {
                const targetSlot = getFurnaceSlot(targetIndex);
                if (this.dragState.isSplit) {
                    getFurnaceSlot(srcIndex).count += itemData.count;
                } else {
                    setFurnaceSlot(targetIndex, itemData);
                    setFurnaceSlot(srcIndex, targetSlot);
                }
            }
        }

        // Drag successful, clean up without restoring
        this.dragState.isDragging = false;
        this.dragState.itemData = null;
        this.dragState.isSplit = false;
        this.elements.dragIcon.classList.add('hidden');

        this._updateInventory();
        this._updateCraftingSlots();
        this._updateArmorSlots();
        this._updateFurnaceSlots();
    }

    // --- Tooltips ---
    onSlotEnter(e, type, index) {
        if (this.dragState.isDragging || !this.isOpen) return;
        let slot = null;
        if (type === 'inventory') slot = this.currentPlayer.inventory.slots[index];
        else if (type === 'crafting') slot = this.craftingSlots[index];
        else if (type === 'crafting_output') slot = this._matchRecipe();
        else if (type === 'armor') slot = this.currentPlayer.inventory.armor[index];
        else if (type === 'furnace') {
            if (index === 0) slot = this.furnaceData.input;
            else if (index === 1) slot = this.furnaceData.fuel;
            else if (index === 2) slot = this.furnaceData.output;
        }
        else if (type === 'wand') {
            const w = this.currentPlayer.inventory.slots[this.currentPlayer.selectedSlot];
            if (w && w.item.type === 'wand') {
                const spell = w.item.data.wand.spellSlots[index];
                if (spell) slot = { item: spell, count: 1 };
            }
        }

        if (slot) {
            let html = `<strong style="color:#7c5cff; font-size:16px;">${slot.item.name}</strong><br/>`;
            if (slot.item.type === 'spell') {
                const sp = slot.item.data.spell || slot.item; // handle both wrapped and unwrapped spell obj
                html += `<span style="color:#aaa;">Element: ${sp.element || 'Arcane'}</span><br/>`;
                html += `Damage: ${sp.baseDamage || 0}<br/>`;
                html += `Mana: ${sp.baseManaCost || 0}<br/>`;
            } else if (slot.item.type === 'wand') {
                const w = slot.item.data.wand;
                html += `<span style="color:#aaa;">Spell Slots: ${w.maxSlots}</span>`;
            } else if (slot.item.type === 'block') {
                html += `<span style="color:#aaa;">Block</span>`;
            } else if (slot.item.type === 'material') {
                html += `<span style="color:#aaa;">Material — used for crafting</span>`;
            } else if (slot.item.type === 'equipment') {
                const ed = slot.item.data.equipData || {};
                if (ed.protection) html += `<span style="color:#88aaff;">Protection: ${ed.protection}</span><br/>`;
                if (ed.mineSpeed) html += `<span style="color:#ffaa44;">Mine Speed: ${ed.mineSpeed}x</span><br/>`;
                if (ed.damage) html += `<span style="color:#ff6666;">Damage: ${ed.damage}</span><br/>`;
                if (ed.speedMult) html += `<span style="color:#44ff88;">Speed: ${ed.speedMult}x</span><br/>`;
                if (ed.flying) html += `<span style="color:#88ffff;">🕊 Can fly</span><br/>`;
                if (slot.item.description) html += `<span style="color:#aaa;">${slot.item.description}</span>`;
            }
            this.elements.tooltip.innerHTML = html;
            this.elements.tooltip.classList.remove('hidden');
            this.elements.tooltip.style.left = (e.clientX + 15) + 'px';
            this.elements.tooltip.style.top = (e.clientY + 15) + 'px';
        }
    }

    onSlotLeave() {
        this.elements.tooltip.classList.add('hidden');
    }

    // =============================
    // Crafting Grid
    // =============================
    _initCraftingGrid() {
        const grid = this.elements.craftingGrid;
        if (!grid) return;
        grid.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const el = document.createElement('div');
            el.className = 'inv-slot';
            el.onmousedown = (e) => this.onSlotMouseDown(e, 'crafting', i);
            el.onmouseup = (e) => this.onSlotMouseUp(e, 'crafting', i);
            el.onmouseenter = (e) => this.onSlotEnter(e, 'crafting', i);
            el.onmouseleave = () => this.onSlotLeave();
            grid.appendChild(el);
        }

        const out = this.elements.craftingOutput;
        if (out) {
            out.onmousedown = (e) => this.onSlotMouseDown(e, 'crafting_output', 0);
            out.onmouseup = (e) => this.onSlotMouseUp(e, 'crafting_output', 0);
            out.onmouseenter = (e) => this.onSlotEnter(e, 'crafting_output', 0);
            out.onmouseleave = () => this.onSlotLeave();
        }
    }

    _initArmorSlots() {
        // Find all armor/offhand slots in the DOM and wire them up
        const ARMOR_NAMES = ['head', 'chest', 'legs', 'boots', 'offhand'];
        ARMOR_NAMES.forEach((slotName, i) => {
            const isOffhand = slotName === 'offhand';
            const el = document.querySelector(isOffhand ? '.offhand-slot' : `[data-slot="${slotName}"]`);
            if (!el) return;
            const armorIndex = isOffhand ? -1 : i;
            el.onmousedown = (e) => this.onSlotMouseDown(e, 'armor', armorIndex);
            el.onmouseup = (e) => this.onSlotMouseUp(e, 'armor', armorIndex);
            el.onmouseenter = (e) => this.onSlotEnter(e, 'armor', armorIndex);
            el.onmouseleave = () => this.onSlotLeave();
        });
    }

    _initFurnaceSlots() {
        if (this.elements.furnaceInput) {
            this.elements.furnaceInput.onmousedown = (e) => this.onSlotMouseDown(e, 'furnace', 0);
            this.elements.furnaceInput.onmouseup = (e) => this.onSlotMouseUp(e, 'furnace', 0);
            this.elements.furnaceInput.onmouseenter = (e) => this.onSlotEnter(e, 'furnace', 0);
            this.elements.furnaceInput.onmouseleave = () => this.onSlotLeave();
        }
        if (this.elements.furnaceFuel) {
            this.elements.furnaceFuel.onmousedown = (e) => this.onSlotMouseDown(e, 'furnace', 1);
            this.elements.furnaceFuel.onmouseup = (e) => this.onSlotMouseUp(e, 'furnace', 1);
            this.elements.furnaceFuel.onmouseenter = (e) => this.onSlotEnter(e, 'furnace', 1);
            this.elements.furnaceFuel.onmouseleave = () => this.onSlotLeave();
        }
        if (this.elements.furnaceOutput) {
            this.elements.furnaceOutput.onmousedown = (e) => this.onSlotMouseDown(e, 'furnace', 2);
            this.elements.furnaceOutput.onmouseup = (e) => this.onSlotMouseUp(e, 'furnace', 2);
            this.elements.furnaceOutput.onmouseenter = (e) => this.onSlotEnter(e, 'furnace', 2);
            this.elements.furnaceOutput.onmouseleave = () => this.onSlotLeave();
        }
    }

    _updateInventory() {
        if (!this.currentPlayer) return;
        const p = this.currentPlayer;
        this.renderGrid(this.elements.mainHotbar, p.inventory.slots.slice(0, 9), 0, p, 'inventory');
        if (this.isOpen) {
            this.renderGrid(this.elements.mainGrid, p.inventory.slots.slice(9, 36), 9, p, 'inventory');
            this.renderGrid(this.elements.invHotbar, p.inventory.slots.slice(0, 9), 0, p, 'inventory');
        }
    }

    _updateArmorSlots() {
        if (!this.currentPlayer) return;
        const ARMOR_NAMES = ['head', 'chest', 'legs', 'boots'];
        ARMOR_NAMES.forEach((slotName, i) => {
            const el = document.querySelector(`[data-slot="${slotName}"]`);
            if (!el) return;
            this.renderSlotItem(el, this.currentPlayer.inventory.armor[i]);
        });
    }

    _updateCraftingSlots() {
        const grid = this.elements.craftingGrid;
        if (!grid) return;
        for (let i = 0; i < 4; i++) {
            this.renderSlotItem(grid.children[i], this.craftingSlots[i]);
        }
    }

    _updateCraftingOutput() {
        const out = this.elements.craftingOutput;
        const nameEl = this.elements.craftingRecipeName;
        if (!out) return;
        const result = this._matchRecipe();
        if (result) {
            this.renderSlotItem(out, result);
            if (nameEl) nameEl.textContent = result.item.name;
        } else {
            this.renderSlotItem(out, null);
            if (nameEl) nameEl.textContent = '';
        }
    }

    _updateFurnaceSlots() {
        if (!this.furnaceData) return;
        this.renderSlotItem(this.elements.furnaceInput, this.furnaceData.input);
        this.renderSlotItem(this.elements.furnaceFuel, this.furnaceData.fuel);
        this.renderSlotItem(this.elements.furnaceOutput, this.furnaceData.output);
        if (this.elements.furnaceProgress) {
            this.elements.furnaceProgress.style.width = `${Math.floor(this.furnaceData.progress * 100)}%`;
        }
        if (this.elements.furnaceFire) {
            this.elements.furnaceFire.style.opacity = this.furnaceData.isSmelting ? '1.0' : '0.2';
        }
    }

    _getSlotType(slot) {
        if (!slot || !slot.item) return null;
        if (slot.item.type === 'block') return slot.item.subtype;
        if (slot.item.type === 'material') return slot.item.subtype;
        if (slot.item.type === 'equipment') return slot.item.subtype;
        return null;
    }

    _matchRecipe() {
        // Build a 2x2 pattern from crafting slots [tl, tr, bl, br]
        const s = this.craftingSlots.map(s => this._getSlotType(s));
        const [tl, tr, bl, br] = s;

        // Helper: check if a pattern (array of 4 block IDs or null) matches
        const B = (typeof BLOCKS !== 'undefined') ? BLOCKS : window.BLOCKS;
        if (!B) return null;

        // Helper: get count of a specific material/block in the grid
        const getCount = (type) => s.filter(x => x === type).length;
        const totalItems = s.filter(x => x !== null).length;

        const match = (pattern, out) => {
            for (let i = 0; i < 4; i++) {
                if (pattern[i] !== s[i]) return null;
            }
            return out;
        };

        // Utility to make a material item
        const mat = (subType, name, count = 1, icon = null) => ({ item: { type: 'material', subtype: subType, name, stackable: true, maxStack: 64, id: `mat_${subType}`, data: { icon }, description: '' }, count });
        const equip = (subType, data, name, desc, count = 1) => ({ item: { type: 'equipment', subtype: subType, name, stackable: false, maxStack: 1, id: `equip_${subType}_${Date.now()}`, data: { equipData: data }, description: desc }, count });
        const block = (type, name, count = 1) => ({ item: { type: 'block', subtype: type, name, stackable: true, maxStack: 64, id: `block_${type}`, data: {}, description: '' }, count });

        // --- Recipes ---
        // Planks: Shapeless 1 Wood => 4 planks
        if (getCount(B.WOOD) === 1 && totalItems === 1) return block(B.PLANKS, 'Planks', 4);
        if (getCount(B.ACACIA_WOOD) === 1 && totalItems === 1) return block(B.PLANKS, 'Planks', 4);
        if (getCount(B.CHERRY_LOG) === 1 && totalItems === 1) return block(B.PLANKS, 'Planks', 4);

        // Sticks: Shapeless 2 Planks
        if (getCount(B.PLANKS) === 2 && totalItems === 2) return mat('stick', 'Stick', 4);

        // Torch: Shapeless 1 Coal + 1 Stick
        if (getCount('coal') === 1 && getCount('stick') === 1 && totalItems === 2) return block(B.TORCH, 'Torch', 4);

        // Tools (material + stick pattern: [mat, empty, stick, empty] )
        const toolRecipe = (matType, mineSpeed, damage, chopSpeed, toolName, toolSubType) => {
            if (s[0] === matType && !s[1] && s[2] === 'stick' && !s[3])
                return equip(toolSubType, { mineSpeed, damage, chopSpeed }, toolName, `${toolName}. Mine Speed: ${mineSpeed}x`);
            return null;
        };

        // Two-material recipes [mat, mat, stick, empty]
        const armorRecipe2H = (matType, name, subType, protection) => {
            if (s[0] === matType && s[1] === matType && !s[2] && !s[3])
                return equip(subType, { protection }, name, `Protection: ${protection}`);
            return null;
        };
        // Full grid armor [mat, mat, mat, mat]
        const armorRecipeFull = (matType, name, subType, protection) => {
            if (s[0] === matType && s[1] === matType && s[2] === matType && s[3] === matType)
                return equip(subType, { protection }, name, `Protection: ${protection}`);
            return null;
        };
        // U-shape [mat, mat, mat, empty]
        const armorRecipeLegs = (matType, name, subType, protection) => {
            if (s[0] === matType && s[1] === matType && s[2] === matType && !s[3])
                return equip(subType, { protection }, name, `Protection: ${protection}`);
            return null;
        };
        // Vertical [mat, empty, mat, empty]
        const armorRecipeBoots = (matType, name, subType, protection) => {
            if (s[0] === matType && !s[1] && s[2] === matType && !s[3])
                return equip(subType, { protection }, name, `Protection: ${protection}`);
            return null;
        };

        // Pickaxes
        let r;
        r = toolRecipe('iron_ingot', 3.0, 5, 1.5, 'Iron Pickaxe', 'pickaxe'); if (r) return r;
        r = toolRecipe('diamond', 6.0, 8, 3.0, 'Diamond Pickaxe', 'pickaxe'); if (r) return r;
        r = toolRecipe(B.COBBLESTONE, 2.0, 4, 1.2, 'Stone Pickaxe', 'pickaxe'); if (r) return r;
        r = toolRecipe(B.PLANKS, 1.5, 3, 1.0, 'Wooden Pickaxe', 'pickaxe'); if (r) return r;

        // Swords [mat, empty, stick, empty]
        r = toolRecipe('iron_ingot', 1.0, 8, 1.0, 'Iron Sword', 'sword'); if (r) return r;
        r = toolRecipe('diamond', 1.0, 12, 1.0, 'Diamond Sword', 'sword'); if (r) return r;
        r = toolRecipe(B.COBBLESTONE, 1.0, 5, 1.0, 'Stone Sword', 'sword'); if (r) return r;
        r = toolRecipe(B.PLANKS, 1.0, 3, 1.0, 'Wooden Sword', 'sword'); if (r) return r;

        // Axes [mat, mat, empty, stick]
        const axeRecipe = (matType, mineSpeed, name) => {
            if (s[0] === matType && s[1] === matType && !s[2] && s[3] === 'stick')
                return equip('axe', { mineSpeed, damage: mineSpeed }, name, `Chops wood fast. Speed: ${mineSpeed}x`);
            return null;
        };
        r = axeRecipe('iron_ingot', 3.0, 'Iron Axe'); if (r) return r;
        r = axeRecipe('diamond', 5.0, 'Diamond Axe'); if (r) return r;
        r = axeRecipe(B.COBBLESTONE, 2.0, 'Stone Axe'); if (r) return r;
        r = axeRecipe(B.PLANKS, 1.5, 'Wooden Axe'); if (r) return r;

        // Armor — Iron
        r = armorRecipe2H('iron_ingot', 'Iron Helmet', 'head', 2); if (r) return r;
        r = armorRecipeFull('iron_ingot', 'Iron Chestplate', 'chest', 5); if (r) return r;
        r = armorRecipeLegs('iron_ingot', 'Iron Leggings', 'legs', 3); if (r) return r;
        r = armorRecipeBoots('iron_ingot', 'Iron Boots', 'boots', 2); if (r) return r;

        // Armor — Diamond
        r = armorRecipe2H('diamond', 'Diamond Helmet', 'head', 5); if (r) return r;
        r = armorRecipeFull('diamond', 'Diamond Chestplate', 'chest', 10); if (r) return r;
        r = armorRecipeLegs('diamond', 'Diamond Leggings', 'legs', 7); if (r) return r;
        r = armorRecipeBoots('diamond', 'Diamond Boots', 'boots', 5); if (r) return r;

        // Wands: [stick, iron_ingot, empty, empty] => Basic Wand
        if (s[0] === 'stick' && s[1] === 'iron_ingot' && !s[2] && !s[3])
            return equip('wand_basic', {}, 'Basic Wand', 'Channels raw magic.');
        // Fire Wand: [wand_basic, coal, empty, empty]
        if (s[0] === 'wand_basic' && s[1] === 'coal' && !s[2] && !s[3])
            return equip('wand_fire', { element: 'FIRE' }, 'Fire Wand', 'Shoots fireballs.');
        // Ice Wand: [wand_basic, snow, empty, empty]
        if (s[0] === 'wand_basic' && s[1] === B.SNOW && !s[2] && !s[3])
            return equip('wand_ice', { element: 'ICE' }, 'Ice Wand', 'Shoots ice blasts.');
        // Nature Wand: [wand_basic, leaves, empty, empty]
        if (s[0] === 'wand_basic' && (s[1] === B.LEAVES || s[1] === B.CHERRY_LEAVES || s[1] === B.AUTUMN_LEAVES) && !s[2] && !s[3])
            return equip('wand_nature', { element: 'HEAL' }, 'Nature Wand', 'Heals the wielder.');

        // --- NEW RECIPES ---
        // Building Blocks
        if (getCount(B.STONE) === 4) return block(B.STONE_BRICKS, 'Stone Bricks', 4);
        if (getCount(B.CLAY) === 4) return block(B.BRICKS, 'Bricks', 4);
        if (getCount(B.SAND) === 4) return block(B.GLASS, 'Glass', 1);
        if (getCount(B.COBBLESTONE) === 4) return block(B.FURNACE, 'Furnace', 1);
        if (getCount(B.PLANKS) === 4) return block(B.CHEST_BLOCK, 'Chest', 1);
        if (getCount(B.PLANKS) === 2 && getCount('stick') === 2 && totalItems === 4) return block(B.BOOKSHELF, 'Bookshelf', 1);
        if (getCount('stick') === 4 && totalItems === 4) return block(B.LADDER, 'Ladder', 3);

        // Storage Blocks
        if (getCount('iron_ingot') === 4) return block(B.IRON_BLOCK, 'Iron Block', 1);
        if (getCount('gold_ingot') === 4) return block(B.GOLD_BLOCK, 'Gold Block', 1);
        if (getCount('diamond') === 4) return block(B.DIAMOND_BLOCK, 'Diamond Block', 1);
        
        // Tools/Misc
        if (getCount('iron_ingot') === 1 && getCount(B.SAND) === 1 && totalItems === 2) return mat('flint_and_steel', 'Flint and Steel', 1);
        
        // Reverse Storage
        if (getCount(B.IRON_BLOCK) === 1 && totalItems === 1) return mat('iron_ingot', 'Iron Ingot', 4);
        if (getCount(B.GOLD_BLOCK) === 1 && totalItems === 1) return mat('gold_ingot', 'Gold Ingot', 4);
        if (getCount(B.DIAMOND_BLOCK) === 1 && totalItems === 1) return mat('diamond', 'Diamond', 4);

        // Gold Tools
        r = toolRecipe('gold_ingot', 2.5, 4, 2.5, 'Gold Pickaxe', 'pickaxe'); if (r) return r;
        r = toolRecipe('gold_ingot', 1.0, 7, 1.0, 'Gold Sword', 'sword'); if (r) return r;
        r = axeRecipe('gold_ingot', 2.5, 'Gold Axe'); if (r) return r;

        // Gold Armor
        r = armorRecipe2H('gold_ingot', 'Gold Helmet', 'head', 3); if (r) return r;
        r = armorRecipeFull('gold_ingot', 'Gold Chestplate', 'chest', 7); if (r) return r;
        r = armorRecipeLegs('gold_ingot', 'Gold Leggings', 'legs', 4); if (r) return r;
        r = armorRecipeBoots('gold_ingot', 'Gold Boots', 'boots', 3); if (r) return r;

        // Decorative
        if (getCount(B.SANDSTONE) === 4) return block(B.SANDSTONE, 'Smooth Sandstone', 4);
        if (getCount(B.COBBLESTONE) === 1 && (getCount(B.LEAVES) === 1 || getCount(B.CHERRY_LEAVES) === 1 || getCount(B.AUTUMN_LEAVES) === 1) && totalItems === 2) 
            return block(B.MOSSY_COBBLESTONE, 'Mossy Cobble', 1);

        return null;
    }

    _consumeCraftingSlots(result) {
        // Remove 1 from each crafting slot
        for (let i = 0; i < 4; i++) {
            if (this.craftingSlots[i]) {
                this.craftingSlots[i].count -= 1;
                if (this.craftingSlots[i].count <= 0) this.craftingSlots[i] = null;
            }
        }
    }

    _populateRecipeBook() {
        const list = document.getElementById('recipe-list');
        if (!list) return;
        // Hardcoded list of recipes for display
        const recipes = [
            { result: "Planks (4)", ingredients: "1 Wood (Shapeless)" },
            { result: "Stick (4)", ingredients: "2 Planks (Shapeless)" },
            { result: "Torch (4)", ingredients: "1 Coal, 1 Stick (Shapeless)" },
            { result: "Sword (Wood/Stone/Iron/Diamond)", ingredients: "1 Material (Top), 1 Stick (Bottom)" },
            { result: "Pickaxe (Wood/Stone/Iron/Gold/Diamond)", ingredients: "2 Material (Top row), 1 Stick (Bottom Left)" },
            { result: "Axe (Wood/Stone/Iron/Gold/Diamond)", ingredients: "2 Material (Top row), 1 Stick (Bottom Right)" },
            { result: "Helmet (Iron/Gold/Diamond)", ingredients: "2 Material (Top row)" },
            { result: "Chestplate (Iron/Gold/Diamond)", ingredients: "4 Material (Full Grid)" },
            { result: "Leggings (Iron/Gold/Diamond)", ingredients: "3 Material (U-shape)" },
            { result: "Boots (Iron/Gold/Diamond)", ingredients: "2 Material (Vertical)" },
            { result: "Basic Wand", ingredients: "1 Stick, 1 Iron Ingot" },
            { result: "Flint and Steel", ingredients: "1 Iron Ingot, 1 Flint" },
            { result: "Fire Wand", ingredients: "1 Basic Wand, 1 Coal" },
            { result: "Ice Wand", ingredients: "1 Basic Wand, 1 Snow" },
            { result: "Nature Wand", ingredients: "1 Basic Wand, 1 Leaves" },
            { result: "Stone Bricks (4)", ingredients: "4 Stone" },
            { result: "Bricks (4)", ingredients: "4 Clay" },
            { result: "Glass", ingredients: "4 Sand" },
            { result: "Furnace", ingredients: "4 Cobblestone" },
            { result: "Chest", ingredients: "4 Planks" },
            { result: "Bookshelf", ingredients: "2 Planks, 2 Sticks" },
            { result: "Ladder (2)", ingredients: "4 Sticks" },
            { result: "Iron/Gold/Diamond Block", ingredients: "4 Iron/Gold/Diamond" },
            { result: "Ingot/Diamond (4)", ingredients: "1 Resource Block" },
            { result: "Mossy Cobble", ingredients: "1 Cobblestone, 1 Leaves" }
        ];

        let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
        recipes.forEach(r => {
            html += `<li style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <div style="color: #fff; font-weight: bold; font-size: 1rem; margin-bottom: 4px;">${r.result}</div>
                <div style="color: #88aaff; font-size: 0.85rem;">Requires: ${r.ingredients}</div>
            </li>`;
        });
        html += '</ul>';
        list.innerHTML = html;
    }
}

export { UISystem };
export class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.clouds = new THREE.Group();
        this.scene.add(this.clouds);
        
        const geo = new THREE.BoxGeometry(8, 4, 8);
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        
        this.clusters = [];
        for(let i=0; i<30; i++) {
            const cluster = new THREE.Group();
            cluster.position.set((Math.random()-0.5)*400, 100 + Math.random()*20, (Math.random()-0.5)*400);
            const numBlocks = 5 + Math.floor(Math.random()*15);
            for(let j=0; j<numBlocks; j++) {
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(Math.floor((Math.random()-0.5)*4)*8, Math.floor((Math.random()-0.5)*2)*4, Math.floor((Math.random()-0.5)*4)*8);
                cluster.add(mesh);
            }
            this.clouds.add(cluster);
            this.clusters.push(cluster);
        }
    }

    update(dt, cameraPos) {
        for(let c of this.clusters) {
            c.position.x += dt * 2;
            if (c.position.x - cameraPos.x > 200) c.position.x -= 400;
            if (c.position.x - cameraPos.x < -200) c.position.x += 400;
            if (c.position.z - cameraPos.z > 200) c.position.z -= 400;
            if (c.position.z - cameraPos.z < -200) c.position.z += 400;
        }
    }
}

export class MeteorShowerSystem {
    constructor(scene, particles, audio, world) {
        this.scene = scene;
        this.particles = particles;
        this.audio = audio;
        this.world = world;
        this.meteors = [];
        this.isActive = false;
        this.timer = 0;
        
        this.geo = new THREE.DodecahedronGeometry(1.0);
        this.mat = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 0.8 });
    }

    startShower() {
        this.isActive = true;
        this.timer = 15.0; // lasts 15 seconds
    }

    update(dt, playerPos) {
        // Randomly start shower
        if (!this.isActive && Math.random() < dt * 0.005) { // 0.5% chance per second
            this.startShower();
        }

        if (this.isActive) {
            this.timer -= dt;
            if (this.timer <= 0) this.isActive = false;

            // Spawn meteors
            if (Math.random() < dt * 2.0) { // 2 meteors per second
                const mesh = new THREE.Mesh(this.geo, this.mat);
                const startPos = new THREE.Vector3(
                    playerPos.x + (Math.random() - 0.5) * 60,
                    playerPos.y + 80 + Math.random() * 20,
                    playerPos.z + (Math.random() - 0.5) * 60
                );
                mesh.position.copy(startPos);
                this.scene.add(mesh);
                
                // Add light
                const light = new THREE.PointLight(0xff4400, 2, 20);
                mesh.add(light);

                this.meteors.push({
                    mesh,
                    velocity: new THREE.Vector3((Math.random()-0.5)*10, -30 - Math.random()*20, (Math.random()-0.5)*10),
                    age: 0
                });
            }
        }

        // Update active meteors
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.age += dt;
            m.mesh.position.addScaledVector(m.velocity, dt);
            this.particles.emit(m.mesh.position, 'fire', 2, 0xffaa00);

            let hit = false;
            // Check world collision
            const bx = Math.floor(m.mesh.position.x);
            const by = Math.floor(m.mesh.position.y);
            const bz = Math.floor(m.mesh.position.z);
            if (by < 128 && by >= 0) {
                const type = this.world.getBlock(bx, by, bz);
                if (type !== BLOCKS.AIR && type !== BLOCKS.WATER && type !== BLOCKS.LAVA) {
                    hit = true;
                }
            }
            if (m.mesh.position.y < -10) hit = true;

            if (hit) {
                this.particles.emit(m.mesh.position, 'explosion', 30, 0xff4400);
                this.audio.playHit(); // pseudo explosion sound
                
                // Carve crater
                const radius = 2 + Math.floor(Math.random() * 2);
                for(let dx=-radius; dx<=radius; dx++) {
                    for(let dy=-radius; dy<=radius; dy++) {
                        for(let dz=-radius; dz<=radius; dz++) {
                            if (dx*dx + dy*dy + dz*dz <= radius*radius) {
                                if (this.world.getBlock(bx+dx, by+dy, bz+dz) !== BLOCKS.AIR) {
                                    this.world.setBlock(bx+dx, by+dy, bz+dz, BLOCKS.AIR);
                                }
                            }
                        }
                    }
                }
                
                // Drop something rare maybe
                if (Math.random() < 0.2) {
                    this.world.setBlock(bx, by-radius, bz, BLOCKS.GLOWSTONE);
                }

                this.scene.remove(m.mesh);
                m.mesh.geometry.dispose();
                m.mesh.material.dispose();
                this.meteors.splice(i, 1);
            }
        }
    }
}
