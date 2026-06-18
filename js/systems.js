// ============================================
// systems.js — Lighting, Particles, Audio, UI
// ============================================
import * as THREE from 'three';
import { BLOCKS } from './textures.js';

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
            tooltip: document.getElementById('item-tooltip')
        };
        this.isOpen = false;
        this.atlas = null;
        
        this.dragState = {
            isDragging: false,
            sourceType: null, // 'inventory' or 'wand'
            sourceIndex: -1,
            itemData: null, // {item, count}
            offsetX: 0, offsetY: 0
        };

        this.currentPlayer = null;

        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.elements.geometricUI.classList.remove('hidden');
        } else {
            this.elements.geometricUI.classList.add('hidden');
            this.elements.tooltip.classList.add('hidden');
            if (this.dragState.isDragging) this.cancelDrag();
        }
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
                inner = `<img src="${dataURL}" class="item-icon" />`;
            } else if (slot.item.type === 'wand') {
                inner = `<div style="text-align:center; line-height:100%; font-size:30px;">🪄</div>`;
            } else if (slot.item.type === 'spell') {
                const colorHex = '#' + slot.item.data.spell.color.toString(16).padStart(6, '0');
                inner = `<div style="width:100%; height:100%; background:${colorHex}; border-radius:50%; box-shadow: 0 0 10px ${colorHex} inset;">
                    <div style="text-align:center; line-height:100%; font-size:24px; padding-top:10px;">✨</div>
                </div>`;
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
        if (!this.isOpen || e.button !== 0) return;
        let slot = null;
        if (type === 'inventory') slot = this.currentPlayer.inventory.slots[index];
        else if (type === 'wand') {
            const w = this.currentPlayer.inventory.slots[this.currentPlayer.selectedSlot];
            if (w && w.item.type === 'wand') slot = w.item.data.wand.spellSlots[index] ? { item: w.item.data.wand.spellSlots[index], count: 1 } : null;
        }
        
        if (slot) {
            this.dragState.isDragging = true;
            this.dragState.sourceType = type;
            this.dragState.sourceIndex = index;
            this.dragState.itemData = slot;
            
            // Set up drag icon
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            this.dragState.offsetX = e.clientX - rect.left - rect.width/2;
            this.dragState.offsetY = e.clientY - rect.top - rect.height/2;
            
            this.elements.dragIcon.classList.remove('hidden');
            this.renderSlotItem(this.elements.dragIcon, slot);
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
        this.dragState.isDragging = false;
        this.elements.dragIcon.classList.add('hidden');
        this.dragState.itemData = null;
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
        if (srcType === 'inventory' && targetType === 'inventory') {
            const targetSlot = inv[targetIndex];
            if (targetSlot && targetSlot.item.type === itemData.item.type && targetSlot.item.subtype === itemData.item.subtype && targetSlot.item.stackable) {
                // Stack
                const add = Math.min(itemData.count, targetSlot.item.maxStack - targetSlot.count);
                targetSlot.count += add;
                inv[srcIndex].count -= add;
                if (inv[srcIndex].count <= 0) inv[srcIndex] = null;
            } else {
                // Swap
                inv[srcIndex] = targetSlot;
                inv[targetIndex] = itemData;
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
        }
        else if (srcType === 'wand' && targetType === 'inventory') {
            const targetSlot = inv[targetIndex];
            // Only swap if empty or also a spell
            if (!targetSlot) {
                inv[targetIndex] = { item: wand.spellSlots[srcIndex], count: 1 };
                wand.spellSlots[srcIndex] = null;
            } else if (targetSlot.item.type === 'spell') {
                wand.spellSlots[srcIndex] = targetSlot.item;
                inv[targetIndex] = { item: itemData.item, count: 1 };
            }
        }

        this.cancelDrag();
    }

    // --- Tooltips ---
    onSlotEnter(e, type, index) {
        if (this.dragState.isDragging || !this.isOpen) return;
        let slot = null;
        if (type === 'inventory') slot = this.currentPlayer.inventory.slots[index];
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
