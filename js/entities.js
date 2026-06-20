// ============================================
// entities.js — Player, Mobs, Bosses, Inventory
// ============================================
import * as THREE from 'three';
import { generateRandomWand, generateRandomSpell, generateRandomModifier } from './magic.js';
import { getBlockProperties, BLOCKS, generateItemTexture } from './textures.js';

// ============================================
// Inventory & Items
// ============================================
let itemIdCounter = 0;
export class Item {
    constructor(type, subtype, data = {}, name, desc) {
        this.type = type; // 'block' | 'wand' | 'spell' | 'modifier'
        this.subtype = subtype;
        this.data = data;
        this.name = name || 'Item';
        this.description = desc || '';
        this.stackable = type === 'block';
        this.maxStack = type === 'block' ? 64 : 1;
        this.id = `item_${itemIdCounter++}`;
    }

    static blockItem(blockType, name) { return new Item('block', blockType, {}, name); }
    static wandItem(wand) { return new Item('wand', 'wand', { wand }, wand.name); }
    static spellItem(spell) { return new Item('spell', spell.type, { spell }, spell.name); }
    static modifierItem(mod) { return new Item('modifier', mod.type, { mod }, mod.name, mod.rarity); }
    static equipmentItem(subType, equipData, name, desc) { return new Item('equipment', subType, { equipData }, name, desc); }
}

export class Inventory {
    constructor() {
        this.slots = new Array(36).fill(null); // 0-8 is hotbar, 9-35 is main grid
        this.armor = new Array(4).fill(null); // Head, Chest, Legs, Boots
        this.offhand = null;
    }
    
    addItem(item, count = 1) {
        // Stackable items (not unique like wands)
        if (item.stackable) {
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i] && this.slots[i].item.type === item.type && this.slots[i].item.subtype === item.subtype) {
                    if (this.slots[i].count < item.maxStack) {
                        const add = Math.min(count, item.maxStack - this.slots[i].count);
                        this.slots[i].count += add;
                        count -= add;
                        if (count <= 0) return true;
                    }
                }
            }
        }
        // Find empty slot
        for (let i = 0; i < this.slots.length; i++) {
            if (!this.slots[i]) {
                this.slots[i] = { item, count };
                return true;
            }
        }
        return false;
    }
}

// ============================================
// Player
// ============================================
export class Player {
    constructor() {
        this.position = new THREE.Vector3(0, 100, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = { yaw: 0, pitch: 0 };
        
        this.health = 100;
        this.maxHealth = 100;
        this.mana = 100;
        this.maxMana = 100;
        this.manaRegenRate = 5;

        this.inventory = new Inventory();
        this.selectedSlot = 0; // Index 0-8 in inventory
        this.equippedWand = null;

        this.grounded = false;
        this.sprinting = false;
        
        this.width = 0.6;
        this.height = 1.8;
        this.eyeHeight = 1.62;
        this.speedMult = 1.0;

        // Give starting items
        const starterWand = generateRandomWand();
        starterWand.name = "Archmage Wand";
        starterWand.maxSlots = 8;
        starterWand.spellSlots = new Array(8).fill(null);
        starterWand.cooldowns = new Array(8).fill(0);
        
        // Load it up with some cool spells and modifiers
        const spell1 = generateRandomSpell();
        spell1.addModifier(generateRandomModifier());
        starterWand.equipSpell(0, spell1);
        
        const spell2 = generateRandomSpell();
        spell2.addModifier(generateRandomModifier());
        spell2.addModifier(generateRandomModifier());
        starterWand.equipSpell(1, spell2);
        
        starterWand.equipSpell(2, generateRandomSpell());

        this.inventory.addItem(Item.wandItem(starterWand));
        this.inventory.addItem(Item.blockItem(BLOCKS.TORCH, 'Torch'), 64);
        this.equippedWand = starterWand;
    }

    update(dt, keys, mouse, world, sensitivity = 0.002) {
        // Mouse Look
        this.rotation.yaw -= mouse.dx * sensitivity;
        this.rotation.pitch -= mouse.dy * sensitivity;
        this.rotation.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this.rotation.pitch));

        // Direction vectors
        const forward = new THREE.Vector3(-Math.sin(this.rotation.yaw), 0, -Math.cos(this.rotation.yaw)).normalize();
        const right = new THREE.Vector3(Math.cos(this.rotation.yaw), 0, -Math.sin(this.rotation.yaw)).normalize();
        // Equipment Effects
        let speedMult = 1.0;
        let flying = false;
        
        // Boots
        const boots = this.inventory.armor[3];
        if (boots && boots.item.data.equipData) {
            if (boots.item.data.equipData.speedMult) speedMult = boots.item.data.equipData.speedMult;
            if (boots.item.data.equipData.flying) flying = true;
        }

        // Apply speed bonus
        speedMult *= this.speedMult;

        // Crouch logic
        const NORMAL_HEIGHT = 1.8;
        const NORMAL_EYE = 1.62;
        const CROUCH_HEIGHT = 0.9;
        const CROUCH_EYE = 0.72;

        let shouldCrouch = keys.crouch;

        if (!shouldCrouch && this.height < NORMAL_HEIGHT) {
            // Check if we have headroom to stand up
            // Check for solid blocks in the space between our current head and the normal head
            const minX = Math.floor(this.position.x - this.width/2 + 0.01);
            const maxX = Math.floor(this.position.x + this.width/2 - 0.01);
            const minZ = Math.floor(this.position.z - this.width/2 + 0.01);
            const maxZ = Math.floor(this.position.z + this.width/2 - 0.01);
            const minY = Math.floor(this.position.y + this.height);
            const maxY = Math.floor(this.position.y + NORMAL_HEIGHT - 0.01);
            
            let headroomBlocked = false;
            for(let y=minY; y<=maxY; y++) {
                for(let x=minX; x<=maxX; x++) {
                    for(let z=minZ; z<=maxZ; z++) {
                        const block = world.getBlock(x,y,z);
                        const props = getBlockProperties(block);
                        if (props && props.solid) headroomBlocked = true;
                    }
                }
            }

            if (headroomBlocked) shouldCrouch = true; // Forced to stay crouched
        }

        if (shouldCrouch) {
            this.height = CROUCH_HEIGHT;
            this.eyeHeight = CROUCH_EYE;
            speedMult *= 0.5;
        } else {
            this.height = NORMAL_HEIGHT;
            this.eyeHeight = NORMAL_EYE;
        }

        // Movement input
        const speed = (keys.sprint && !shouldCrouch ? 9.5 : 6.0) * speedMult;
        let moveDir = new THREE.Vector3(0,0,0);
        
        if (keys.forward) moveDir.add(forward);
        if (keys.backward) moveDir.sub(forward);
        if (keys.right) moveDir.add(right);
        if (keys.left) moveDir.sub(right);
        
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        const blockIn = world.getBlock(this.position.x, this.position.y + 0.1, this.position.z);
        const inWater = blockIn === BLOCKS.WATER || blockIn === BLOCKS.SWAMP_WATER;
        const inLava = blockIn === BLOCKS.LAVA;
        const onLadder = blockIn === BLOCKS.LADDER;

        if (inLava && Math.random() < dt * 4) {
            this.takeDamage(5);
            const d = document.getElementById('damage-flash');
            if(d) { d.classList.add('active'); setTimeout(() => d.classList.remove('active'), 200); }
        }

        // Physics variables
        // Make the player much more floaty in water (lower gravity)
        let gravity = (inWater || inLava) ? -1.5 : -25;
        let drag = (inWater || inLava) ? 6 : 10;
        let jumpForce = (inWater || inLava) ? 3.5 : 9;
        
        if (onLadder) {
            gravity = 0; // Cancel gravity on ladder
            drag = 15; // Higher drag so you stop quickly
        }

        // X/Z velocity update
        this.velocity.x += moveDir.x * speed * 10 * dt;
        this.velocity.z += moveDir.z * speed * 10 * dt;

        // Drag (friction)
        this.velocity.x -= this.velocity.x * drag * dt;
        this.velocity.z -= this.velocity.z * drag * dt;

        // Y velocity update (gravity)
        this.velocity.y += gravity * dt;

        // Jumping and Climbing
        if (onLadder) {
            if (keys.jump) {
                this.velocity.y = 3.5;
            } else if (keys.crouch) {
                this.velocity.y = -3.5;
            } else {
                this.velocity.y -= this.velocity.y * drag * dt; // Stop vertical movement if not climbing
            }
        } else if (keys.jump) {
            if (flying) {
                this.velocity.y += 35 * dt;
                if (this.velocity.y > 10) this.velocity.y = 10; // Cap fly speed
            } else if (this.grounded) {
                this.velocity.y = 9; // Normal jump force for regular ground
                this.grounded = false;
            } else if (inWater || inLava) {
                // Minecraft-style liquid swimming: apply upward acceleration instead of instant snap
                this.velocity.y += 18 * dt;
                // Cap upward velocity so we don't shoot out of the water like a rocket
                if (this.velocity.y > 4.5) this.velocity.y = 4.5;
            } else {
                const blockInProps = getBlockProperties(blockIn);
                if (blockInProps && blockInProps.solid) {
                    this.position.y += Math.max(1, dt * 10);
                }
            }
        }

        // Collision
        const velStep = this.velocity.clone().multiplyScalar(dt);
        const colResult = world.collide(this.position, velStep, this.width, this.height, keys.crouch && this.grounded);
        
        // Update state based on collision
        this.position.copy(colResult.position);
        if (colResult.velocity.y === 0 && this.velocity.y < 0) this.grounded = true;
        else this.grounded = false;

        if (colResult.velocity.x === 0) this.velocity.x = 0;
        if (colResult.velocity.z === 0) this.velocity.z = 0;
        if (colResult.velocity.y === 0) this.velocity.y = 0;

        // Fall clamp
        if (this.velocity.y < -50) this.velocity.y = -50;

        // Void damage
        if (this.position.y < -10) {
            this.takeDamage(1000);
        }

        // Mana regen
        if (this.mana < this.maxMana) {
            this.mana += this.manaRegenRate * dt;
            if (this.mana > this.maxMana) this.mana = this.maxMana;
        }

        // Update wand cooldowns
        const activeItem = this.inventory.slots[this.selectedSlot];
        if (activeItem && activeItem.item.type === 'wand') {
            activeItem.item.data.wand.updateCooldowns(dt);
        }
    }

    getEyePosition() {
        return new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    }

    getLookDirection() {
        return new THREE.Vector3(
            -Math.sin(this.rotation.yaw) * Math.cos(this.rotation.pitch),
            Math.sin(this.rotation.pitch),
            -Math.cos(this.rotation.yaw) * Math.cos(this.rotation.pitch)
        ).normalize();
    }

    takeDamage(amt) {
        if (this.health <= 0) return true;
        
        let protection = 0;
        // Sum protection from armor slots
        for (let i = 0; i < 4; i++) {
            const piece = this.inventory.armor[i];
            if (piece && piece.item.data.equipData && piece.item.data.equipData.protection) {
                protection += piece.item.data.equipData.protection;
            }
        }
        
        const damageTaken = Math.max(0.5, amt - protection);
        this.health -= damageTaken;
        return this.health <= 0;
    }

    useMana(amt) {
        if (this.mana >= amt) {
            this.mana -= amt;
            return true;
        }
        return false;
    }
}

// ============================================
// Helper: Build mob body parts
// ============================================

function createMobMaterial(color, emissive = 0x000000, emissiveIntensity = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    // Fill base
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 16, 16);
    
    // Add noise
    const imgData = ctx.getImageData(0, 0, 16, 16);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() - 0.5) * 40;
        d[i] = Math.max(0, Math.min(255, d[i] + v));
        d[i+1] = Math.max(0, Math.min(255, d[i+1] + v));
        d[i+2] = Math.max(0, Math.min(255, d[i+2] + v));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    return new THREE.MeshLambertMaterial({ map: texture, emissive, emissiveIntensity });
}

function createBodyPart(geo, color, emissive = 0x000000, emissiveIntensity = 0) {
    const mat = createMobMaterial(color, emissive, emissiveIntensity);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
}

// ============================================
// Mob Type Definitions (Enhanced)
// ============================================

export const MOB_TYPES = {
    SHEEP: {
        name: 'Sheep', health: 15, damage: 0, speed: 2.5, hostile: false, color: 0xffffff,
        size: 0.8, xpDrop: 2, lootChance: 1.0,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body (wool)
            const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
            const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.5;
            group.add(body);
            // Head
            const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const headMat = new THREE.MeshLambertMaterial({ color: 0xeebb99 });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.set(0, 0.7, -0.7);
            group.add(head);
            // Legs
            const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
            const legMat = new THREE.MeshLambertMaterial({ color: 0xeebb99 });
            for(let i=0; i<4; i++) {
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set((i%2===0?-0.3:0.3), 0.2, (i<2?-0.4:0.4));
                group.add(leg);
            }
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (!isMoving) {
                // Reset legs
                for(let i=2; i<6; i++) mesh.children[i].rotation.x = 0;
            } else {
                // Walk cycle
                const swing = Math.sin(age * 8) * 0.4;
                mesh.children[2].rotation.x = swing;
                mesh.children[3].rotation.x = -swing;
                mesh.children[4].rotation.x = -swing;
                mesh.children[5].rotation.x = swing;
            }
        }
    },
    SLIME: {
        name: 'Slime', health: 20, damage: 5, speed: 2, hostile: true, color: 0x44cc44,
        size: 0.6, xpDrop: 5, lootChance: 0.3,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body — squished sphere for jelly look
            const body = createBodyPart(new THREE.SphereGeometry(0.35, 10, 8), 0x44cc44, 0x22aa22, 0.15);
            body.scale.set(1, 0.75, 1);
            body.position.y = 0.3;
            body.material.transparent = true;
            body.material.opacity = 0.75;
            group.add(body);
            // Eyes
            const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            leftEye.position.set(-0.12, 0.35, 0.28);
            group.add(leftEye);
            const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
            rightEye.position.set(0.12, 0.35, 0.28);
            group.add(rightEye);
            // Inner core (darker)
            const core = createBodyPart(new THREE.SphereGeometry(0.18, 8, 6), 0x228822, 0x44ff44, 0.2);
            core.position.y = 0.25;
            core.material.transparent = true;
            core.material.opacity = 0.5;
            group.add(core);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            // Bounce/squish animation
            const bounce = Math.sin(age * 6) * 0.15;
            const squish = 1 + Math.sin(age * 6) * 0.15;
            mesh.children[0].scale.set(squish, 1.0 / squish * 0.75, squish);
            mesh.children[0].position.y = 0.3 + Math.max(0, bounce);
            mesh.children[1].position.y = 0.35 + Math.max(0, bounce);
            mesh.children[2].position.y = 0.35 + Math.max(0, bounce);
            mesh.children[3].position.y = 0.25 + Math.max(0, bounce);
        }
    },
    LAVASLIME: {
        name: 'Lava Slime', health: 30, damage: 8, speed: 2, hostile: true, color: 0xcc4400,
        size: 0.7, xpDrop: 8, lootChance: 0.4,
        buildMesh: () => {
            const group = new THREE.Group();
            const body = createBodyPart(new THREE.BoxGeometry(0.7, 0.7, 0.7), 0xcc4400, 0xff8800, 0.1);
            body.position.y = 0.35;
            body.material.transparent = true;
            body.material.opacity = 0.8;
            group.add(body);
            // Core
            const core = createBodyPart(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xffff00);
            core.position.y = 0.35;
            group.add(core);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const bounce = Math.sin(age * 6) * 0.15;
            const squish = 1 + Math.sin(age * 6) * 0.15;
            mesh.children[0].scale.set(squish, 1.0 / squish, squish);
            mesh.children[0].position.y = 0.35 + Math.max(0, bounce);
            mesh.children[1].position.y = 0.35 + Math.max(0, bounce);
        }
    },
    PIGLIN_BRUISER: {
        name: 'Piglin Bruiser', health: 50, damage: 12, speed: 3.5, hostile: true, color: 0xffaaaa,
        size: 0.9, xpDrop: 15, lootChance: 0.6,
        buildMesh: () => {
            const group = new THREE.Group();
            const body = createBodyPart(new THREE.BoxGeometry(0.5, 0.6, 0.3), 0x442222); // Dark armor
            body.position.y = 0.7;
            group.add(body);
            const head = createBodyPart(new THREE.BoxGeometry(0.4, 0.4, 0.4), 0xffaaaa);
            head.position.y = 1.2;
            head.position.z = 0.1;
            group.add(head);
            // Snout
            const snout = createBodyPart(new THREE.BoxGeometry(0.2, 0.15, 0.1), 0xff8888);
            snout.position.set(0, 1.1, 0.35);
            group.add(snout);
            const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
            const lArm = createBodyPart(armGeo, 0xffaaaa);
            lArm.position.set(-0.35, 0.7, 0);
            group.add(lArm);
            const rArm = createBodyPart(armGeo, 0xffaaaa);
            rArm.position.set(0.35, 0.7, 0);
            group.add(rArm);
            const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
            const lLeg = createBodyPart(legGeo, 0x221111);
            lLeg.position.set(-0.15, 0.2, 0);
            group.add(lLeg);
            const rLeg = createBodyPart(legGeo, 0x221111);
            rLeg.position.set(0.15, 0.2, 0);
            group.add(rLeg);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (!isMoving) {
                mesh.children[3].rotation.x = 0;
                mesh.children[4].rotation.x = 0;
                mesh.children[5].rotation.x = 0;
                mesh.children[6].rotation.x = 0;
            } else {
                const swing = Math.sin(age * 10) * 0.5;
                mesh.children[3].rotation.x = swing;
                mesh.children[4].rotation.x = -swing;
                mesh.children[5].rotation.x = -swing;
                mesh.children[6].rotation.x = swing;
            }
        }
    },
    GOBLIN: {
        name: 'Goblin', health: 25, damage: 6, speed: 4, hostile: true, color: 0x448844,
        size: 0.8, xpDrop: 10, lootChance: 0.5,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body
            const body = createBodyPart(new THREE.BoxGeometry(0.4, 0.5, 0.3), 0x448844);
            body.position.y = 0.55;
            group.add(body);
            // Head
            const head = createBodyPart(new THREE.BoxGeometry(0.35, 0.3, 0.3), 0x55aa55);
            head.position.y = 0.95;
            group.add(head);
            // Eyes
            const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.02);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            leftEye.position.set(-0.1, 0.97, 0.16);
            group.add(leftEye);
            const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
            rightEye.position.set(0.1, 0.97, 0.16);
            group.add(rightEye);
            // Pointy ears
            const earGeo = new THREE.ConeGeometry(0.06, 0.15, 4);
            const earMat = new THREE.MeshLambertMaterial({ color: 0x55aa55 });
            const leftEar = new THREE.Mesh(earGeo, earMat);
            leftEar.position.set(-0.22, 1.0, 0);
            leftEar.rotation.z = Math.PI / 3;
            group.add(leftEar);
            const rightEar = new THREE.Mesh(earGeo, earMat);
            rightEar.position.set(0.22, 1.0, 0);
            rightEar.rotation.z = -Math.PI / 3;
            group.add(rightEar);
            // Arms
            const armGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
            const leftArm = createBodyPart(armGeo, 0x55aa55);
            leftArm.position.set(-0.32, 0.5, 0);
            leftArm.name = 'leftArm';
            group.add(leftArm);
            const rightArm = createBodyPart(armGeo, 0x55aa55);
            rightArm.position.set(0.32, 0.5, 0);
            rightArm.name = 'rightArm';
            group.add(rightArm);
            // Legs
            const legGeo = new THREE.BoxGeometry(0.13, 0.3, 0.13);
            const leftLeg = createBodyPart(legGeo, 0x336633);
            leftLeg.position.set(-0.1, 0.15, 0);
            leftLeg.name = 'leftLeg';
            group.add(leftLeg);
            const rightLeg = createBodyPart(legGeo, 0x336633);
            rightLeg.position.set(0.1, 0.15, 0);
            rightLeg.name = 'rightLeg';
            group.add(rightLeg);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (isMoving) {
                const swing = Math.sin(age * 10) * 0.6;
                mesh.getObjectByName('leftArm').rotation.x = swing;
                mesh.getObjectByName('rightArm').rotation.x = -swing;
                mesh.getObjectByName('leftLeg').rotation.x = -swing;
                mesh.getObjectByName('rightLeg').rotation.x = swing;
            } else {
                // Idle breathing
                mesh.children[0].scale.y = 1 + Math.sin(age * 2) * 0.03;
                mesh.getObjectByName('leftArm').rotation.x *= 0.9;
                mesh.getObjectByName('rightArm').rotation.x *= 0.9;
                mesh.getObjectByName('leftLeg').rotation.x *= 0.9;
                mesh.getObjectByName('rightLeg').rotation.x *= 0.9;
            }
        }
    },
    SKELETON: {
        name: 'Skeleton', health: 30, damage: 8, speed: 3, hostile: true, color: 0xddddcc,
        size: 0.8, xpDrop: 15, lootChance: 0.6,
        buildMesh: () => {
            const group = new THREE.Group();
            const boneColor = 0xddddcc;
            // Ribcage/body
            const body = createBodyPart(new THREE.BoxGeometry(0.35, 0.45, 0.2), boneColor);
            body.position.y = 0.8;
            group.add(body);
            // Dark inside
            const inner = createBodyPart(new THREE.BoxGeometry(0.25, 0.35, 0.15), 0x222222);
            inner.position.y = 0.8;
            inner.position.z = 0.01;
            group.add(inner);
            // Skull
            const skull = createBodyPart(new THREE.BoxGeometry(0.3, 0.3, 0.25), boneColor);
            skull.position.y = 1.2;
            group.add(skull);
            // Eye sockets
            const socketGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
            const socketMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
            const ls = new THREE.Mesh(socketGeo, socketMat);
            ls.position.set(-0.08, 1.23, 0.13);
            group.add(ls);
            const rs = new THREE.Mesh(socketGeo, socketMat);
            rs.position.set(0.08, 1.23, 0.13);
            group.add(rs);
            // Jaw
            const jaw = createBodyPart(new THREE.BoxGeometry(0.2, 0.06, 0.15), boneColor);
            jaw.position.set(0, 1.03, 0.03);
            group.add(jaw);
            // Arms (thin bones)
            const armGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
            const la = createBodyPart(armGeo, boneColor);
            la.position.set(-0.28, 0.65, 0);
            la.name = 'leftArm';
            group.add(la);
            const ra = createBodyPart(armGeo, boneColor);
            ra.position.set(0.28, 0.65, 0);
            ra.name = 'rightArm';
            group.add(ra);
            // Legs (thin bones)
            const legGeo = new THREE.BoxGeometry(0.08, 0.45, 0.08);
            const ll = createBodyPart(legGeo, boneColor);
            ll.position.set(-0.1, 0.25, 0);
            ll.name = 'leftLeg';
            group.add(ll);
            const rl = createBodyPart(legGeo, boneColor);
            rl.position.set(0.1, 0.25, 0);
            rl.name = 'rightLeg';
            group.add(rl);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (isMoving) {
                const swing = Math.sin(age * 8) * 0.5;
                mesh.getObjectByName('leftArm').rotation.x = swing;
                mesh.getObjectByName('rightArm').rotation.x = -swing;
                mesh.getObjectByName('leftLeg').rotation.x = -swing * 0.7;
                mesh.getObjectByName('rightLeg').rotation.x = swing * 0.7;
            } else {
                // Idle sway
                mesh.rotation.z = Math.sin(age * 1.5) * 0.02;
                mesh.getObjectByName('leftArm').rotation.x *= 0.9;
                mesh.getObjectByName('rightArm').rotation.x *= 0.9;
                mesh.getObjectByName('leftLeg').rotation.x *= 0.9;
                mesh.getObjectByName('rightLeg').rotation.x *= 0.9;
            }
        }
    },
    SPIDER: {
        name: 'Spider', health: 18, damage: 4, speed: 5, hostile: true, color: 0x332222,
        size: 0.7, xpDrop: 8, lootChance: 0.35,
        buildMesh: () => {
            const group = new THREE.Group();
            const spiderColor = 0x332222;
            // Abdomen
            const abdomen = createBodyPart(new THREE.SphereGeometry(0.25, 8, 6), 0x221111);
            abdomen.position.set(0, 0.3, -0.25);
            abdomen.scale.set(1, 0.8, 1.2);
            group.add(abdomen);
            // Thorax
            const thorax = createBodyPart(new THREE.SphereGeometry(0.18, 8, 6), spiderColor);
            thorax.position.set(0, 0.3, 0.1);
            group.add(thorax);
            // Eyes (8 red dots)
            const eyeGeo = new THREE.SphereGeometry(0.03, 4, 4);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const eyePositions = [
                [-0.08, 0.38, 0.25], [0.08, 0.38, 0.25],
                [-0.05, 0.35, 0.27], [0.05, 0.35, 0.27],
                [-0.12, 0.34, 0.22], [0.12, 0.34, 0.22],
                [-0.04, 0.42, 0.23], [0.04, 0.42, 0.23]
            ];
            for (const [ex, ey, ez] of eyePositions) {
                const eye = new THREE.Mesh(eyeGeo, eyeMat);
                eye.position.set(ex, ey, ez);
                group.add(eye);
            }
            // 8 legs
            const legGeo = new THREE.BoxGeometry(0.04, 0.04, 0.35);
            for (let side = -1; side <= 1; side += 2) {
                for (let i = 0; i < 4; i++) {
                    const leg = createBodyPart(legGeo, spiderColor);
                    const zOff = -0.15 + i * 0.12;
                    leg.position.set(side * 0.3, 0.2, zOff);
                    leg.rotation.y = side * 0.3;
                    leg.rotation.z = side * -0.8;
                    leg.name = `leg_${side > 0 ? 'r' : 'l'}_${i}`;
                    group.add(leg);
                }
            }
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (isMoving) {
                for (let s = 0; s < 2; s++) {
                    const side = s === 0 ? 'l' : 'r';
                    for (let i = 0; i < 4; i++) {
                        const leg = mesh.getObjectByName(`leg_${side}_${i}`);
                        if (leg) {
                            const phase = (i + s * 2) * Math.PI / 4;
                            leg.rotation.x = Math.sin(age * 15 + phase) * 0.4;
                        }
                    }
                }
            }
            // Body bob
            mesh.children[0].position.y = 0.3 + Math.sin(age * 4) * 0.03;
            mesh.children[1].position.y = 0.3 + Math.sin(age * 4 + 0.5) * 0.03;
        }
    },
    ZOMBIE: {
        name: 'Zombie', health: 40, damage: 7, speed: 2, hostile: true, color: 0x557744,
        size: 0.9, xpDrop: 12, lootChance: 0.4,
        buildMesh: () => {
            const group = new THREE.Group();
            const skinColor = 0x557744;
            const darkSkin = 0x445533;
            // Body (slightly hunched)
            const body = createBodyPart(new THREE.BoxGeometry(0.45, 0.55, 0.3), skinColor);
            body.position.y = 0.75;
            body.rotation.x = 0.15;
            group.add(body);
            // Head
            const head = createBodyPart(new THREE.BoxGeometry(0.35, 0.35, 0.3), skinColor);
            head.position.y = 1.2;
            head.position.z = 0.05;
            group.add(head);
            // Eyes (one normal, one droopy)
            const eyeGeo = new THREE.BoxGeometry(0.09, 0.06, 0.02);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xccff00 }); // sickly yellow-green
            const le = new THREE.Mesh(eyeGeo, eyeMat);
            le.position.set(-0.09, 1.22, 0.16);
            group.add(le);
            const re = new THREE.Mesh(eyeGeo, eyeMat);
            re.position.set(0.09, 1.19, 0.16); // droopy
            group.add(re);
            // Arms (stretched forward zombie-style)
            const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
            const la = createBodyPart(armGeo, darkSkin);
            la.position.set(-0.35, 0.8, -0.2);
            la.rotation.x = -Math.PI / 3; // arms stretched forward
            la.name = 'leftArm';
            group.add(la);
            const ra = createBodyPart(armGeo, darkSkin);
            ra.position.set(0.35, 0.8, -0.2);
            ra.rotation.x = -Math.PI / 3;
            ra.name = 'rightArm';
            group.add(ra);
            // Legs
            const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
            const ll = createBodyPart(legGeo, darkSkin);
            ll.position.set(-0.12, 0.2, 0);
            ll.name = 'leftLeg';
            group.add(ll);
            const rl = createBodyPart(legGeo, darkSkin);
            rl.position.set(0.12, 0.2, 0);
            rl.name = 'rightLeg';
            group.add(rl);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (isMoving) {
                // Slow shamble
                const swing = Math.sin(age * 4) * 0.3;
                mesh.getObjectByName('leftLeg').rotation.x = -swing;
                mesh.getObjectByName('rightLeg').rotation.x = swing;
                // Arms wobble slightly
                mesh.getObjectByName('leftArm').rotation.x = -Math.PI / 3 + Math.sin(age * 4 + 1) * 0.15;
                mesh.getObjectByName('rightArm').rotation.x = -Math.PI / 3 + Math.sin(age * 4) * 0.15;
                // Body sway
                mesh.children[0].rotation.z = Math.sin(age * 4) * 0.05;
            } else {
                mesh.getObjectByName('leftLeg').rotation.x *= 0.9;
                mesh.getObjectByName('rightLeg').rotation.x *= 0.9;
            }
        }
    },
    BAT: {
        name: 'Bat', health: 10, damage: 3, speed: 6, hostile: true, color: 0x333333,
        size: 0.4, xpDrop: 4, lootChance: 0.2, flying: true,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body (small oval)
            const body = createBodyPart(new THREE.SphereGeometry(0.12, 8, 6), 0x333333);
            body.scale.set(1, 0.8, 1.2);
            body.position.y = 0.2;
            group.add(body);
            // Head
            const head = createBodyPart(new THREE.SphereGeometry(0.08, 6, 6), 0x444444);
            head.position.set(0, 0.3, 0.1);
            group.add(head);
            // Eyes (tiny red)
            const eyeGeo = new THREE.SphereGeometry(0.025, 4, 4);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const le = new THREE.Mesh(eyeGeo, eyeMat);
            le.position.set(-0.04, 0.32, 0.17);
            group.add(le);
            const re = new THREE.Mesh(eyeGeo, eyeMat);
            re.position.set(0.04, 0.32, 0.17);
            group.add(re);
            // Wings (flat boxes)
            const wingGeo = new THREE.BoxGeometry(0.35, 0.01, 0.2);
            const wingMat = new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide });
            const lw = new THREE.Mesh(wingGeo, wingMat);
            lw.position.set(-0.22, 0.22, 0);
            lw.name = 'leftWing';
            group.add(lw);
            const rw = new THREE.Mesh(wingGeo, wingMat);
            rw.position.set(0.22, 0.22, 0);
            rw.name = 'rightWing';
            group.add(rw);
            // Ears
            const earGeo = new THREE.ConeGeometry(0.03, 0.08, 3);
            const earMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            const lear = new THREE.Mesh(earGeo, earMat);
            lear.position.set(-0.04, 0.4, 0.08);
            group.add(lear);
            const rear = new THREE.Mesh(earGeo, earMat);
            rear.position.set(0.04, 0.4, 0.08);
            group.add(rear);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            // Wing flapping
            const flapSpeed = isMoving ? 20 : 12;
            const flapAmt = 0.8;
            const lw = mesh.getObjectByName('leftWing');
            const rw = mesh.getObjectByName('rightWing');
            if (lw) lw.rotation.z = Math.sin(age * flapSpeed) * flapAmt;
            if (rw) rw.rotation.z = -Math.sin(age * flapSpeed) * flapAmt;
            // Hover bob
            mesh.position.y += Math.sin(age * 3) * 0.003;
        }
    },
    GOLEM: {
        name: 'Stone Golem', health: 80, damage: 15, speed: 1.5, hostile: true, color: 0x888888,
        size: 1.2, xpDrop: 25, lootChance: 0.7,
        buildMesh: () => {
            const group = new THREE.Group();
            const stoneColor = 0x888888;
            const darkStone = 0x666666;
            // Body (large)
            const body = createBodyPart(new THREE.BoxGeometry(0.7, 0.8, 0.5), stoneColor);
            body.position.y = 0.9;
            group.add(body);
            // Head (small for body)
            const head = createBodyPart(new THREE.BoxGeometry(0.4, 0.35, 0.35), darkStone);
            head.position.y = 1.5;
            group.add(head);
            // Eyes (glowing yellow)
            const eyeGeo = new THREE.BoxGeometry(0.1, 0.06, 0.02);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            const le = new THREE.Mesh(eyeGeo, eyeMat);
            le.position.set(-0.1, 1.52, 0.18);
            group.add(le);
            const re = new THREE.Mesh(eyeGeo, eyeMat);
            re.position.set(0.1, 1.52, 0.18);
            group.add(re);
            // Massive arms
            const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
            const la = createBodyPart(armGeo, stoneColor);
            la.position.set(-0.55, 0.75, 0);
            la.name = 'leftArm';
            group.add(la);
            const ra = createBodyPart(armGeo, stoneColor);
            ra.position.set(0.55, 0.75, 0);
            ra.name = 'rightArm';
            group.add(ra);
            // Legs (thick)
            const legGeo = new THREE.BoxGeometry(0.25, 0.5, 0.25);
            const ll = createBodyPart(legGeo, darkStone);
            ll.position.set(-0.2, 0.25, 0);
            ll.name = 'leftLeg';
            group.add(ll);
            const rl = createBodyPart(legGeo, darkStone);
            rl.position.set(0.2, 0.25, 0);
            rl.name = 'rightLeg';
            group.add(rl);
            // Mossy patches
            const mossGeo = new THREE.BoxGeometry(0.15, 0.1, 0.01);
            const mossMat = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
            const m1 = new THREE.Mesh(mossGeo, mossMat);
            m1.position.set(0.2, 1.1, 0.26);
            group.add(m1);
            const m2 = new THREE.Mesh(mossGeo, mossMat);
            m2.position.set(-0.15, 0.7, 0.26);
            group.add(m2);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            if (isMoving) {
                const swing = Math.sin(age * 4) * 0.25; // slow heavy steps
                mesh.getObjectByName('leftArm').rotation.x = swing;
                mesh.getObjectByName('rightArm').rotation.x = -swing;
                mesh.getObjectByName('leftLeg').rotation.x = -swing;
                mesh.getObjectByName('rightLeg').rotation.x = swing;
                // Heavy stomp shake
                mesh.position.y += Math.abs(Math.sin(age * 4)) * 0.02;
            } else {
                mesh.getObjectByName('leftArm').rotation.x *= 0.95;
                mesh.getObjectByName('rightArm').rotation.x *= 0.95;
                mesh.getObjectByName('leftLeg').rotation.x *= 0.95;
                mesh.getObjectByName('rightLeg').rotation.x *= 0.95;
            }
        }
    },
    WISP: {
        name: 'Wisp', health: 12, damage: 4, speed: 3, hostile: true, color: 0x88aaff,
        size: 0.3, xpDrop: 6, lootChance: 0.45, flying: true,
        buildMesh: () => {
            const group = new THREE.Group();
            // Glowing core
            const core = createBodyPart(new THREE.SphereGeometry(0.15, 10, 10), 0x88aaff, 0x88aaff, 1.0);
            core.material.transparent = true;
            core.material.opacity = 0.9;
            core.position.y = 0.3;
            group.add(core);
            // Outer glow
            const glow = createBodyPart(new THREE.SphereGeometry(0.25, 10, 10), 0x4466ff, 0x4466ff, 0.5);
            glow.material.transparent = true;
            glow.material.opacity = 0.25;
            glow.position.y = 0.3;
            group.add(glow);
            // Point light
            const light = new THREE.PointLight(0x88aaff, 1.5, 8);
            light.position.y = 0.3;
            group.add(light);
            // Orbiting particles (small spheres)
            const particleGeo = new THREE.SphereGeometry(0.03, 4, 4);
            const particleMat = new THREE.MeshBasicMaterial({ color: 0xaaccff });
            for (let i = 0; i < 4; i++) {
                const p = new THREE.Mesh(particleGeo, particleMat);
                p.name = `particle_${i}`;
                p.position.y = 0.3;
                group.add(p);
            }
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            // Pulsing glow
            if (mesh.children[0]) mesh.children[0].scale.setScalar(1 + Math.sin(age * 5) * 0.15);
            if (mesh.children[1]) mesh.children[1].scale.setScalar(1 + Math.sin(age * 3) * 0.2);
            // Orbiting particles
            for (let i = 0; i < 4; i++) {
                const p = mesh.getObjectByName(`particle_${i}`);
                if (p) {
                    const angle = age * 3 + i * Math.PI / 2;
                    const r = 0.3 + Math.sin(age * 2 + i) * 0.05;
                    p.position.x = Math.cos(angle) * r;
                    p.position.z = Math.sin(angle) * r;
                    p.position.y = 0.3 + Math.sin(age * 4 + i) * 0.1;
                }
            }
            // Float bob
            mesh.position.y += Math.sin(age * 2) * 0.004;
        }
    },
    TROPICAL_FISH: {
        name: 'Tropical Fish', health: 3, damage: 0, speed: 2.5, hostile: false, color: 0xff8800,
        size: 0.25, xpDrop: 1, lootChance: 0.1, waterOnly: true,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body (Orange and White)
            const body = createBodyPart(new THREE.BoxGeometry(0.08, 0.15, 0.25), 0xff8800);
            body.position.y = 0.15;
            group.add(body);
            // White stripe
            const stripe = createBodyPart(new THREE.BoxGeometry(0.085, 0.16, 0.05), 0xffffff);
            stripe.position.set(0, 0.15, 0);
            group.add(stripe);
            // Tail
            const tailGeo = new THREE.BoxGeometry(0.02, 0.1, 0.1);
            const tail = createBodyPart(tailGeo, 0xffffff);
            tail.position.set(0, 0.15, -0.15);
            tail.name = 'tail';
            group.add(tail);
            // Fins
            const finGeo = new THREE.BoxGeometry(0.1, 0.02, 0.08);
            const lf = createBodyPart(finGeo, 0xffaa00);
            lf.position.set(-0.06, 0.1, 0);
            lf.rotation.z = -0.3;
            lf.name = 'leftFin';
            group.add(lf);
            const rf = createBodyPart(finGeo, 0xffaa00);
            rf.position.set(0.06, 0.1, 0);
            rf.rotation.z = 0.3;
            rf.name = 'rightFin';
            group.add(rf);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const speed = isMoving ? 25 : 8;
            const tail = mesh.getObjectByName('tail');
            if (tail) tail.rotation.y = Math.sin(age * speed) * 0.4;
            const lf = mesh.getObjectByName('leftFin');
            const rf = mesh.getObjectByName('rightFin');
            if (lf) lf.rotation.x = Math.sin(age * speed) * 0.2;
            if (rf) rf.rotation.x = Math.sin(age * speed) * 0.2;
        }
    },
    CLOWNFISH: {
        name: 'Clownfish', health: 3, damage: 0, speed: 2.2, hostile: false, color: 0xff6600,
        size: 0.25, xpDrop: 1, lootChance: 0.1, waterOnly: true,
        buildMesh: () => {
            const group = new THREE.Group();
            const body = createBodyPart(new THREE.BoxGeometry(0.08, 0.15, 0.25), 0xff6600);
            body.position.y = 0.15; group.add(body);
            const s1 = createBodyPart(new THREE.BoxGeometry(0.085, 0.16, 0.04), 0xffffff);
            s1.position.set(0, 0.15, 0.08); group.add(s1);
            const s2 = createBodyPart(new THREE.BoxGeometry(0.085, 0.16, 0.04), 0xffffff);
            s2.position.set(0, 0.15, -0.02); group.add(s2);
            const s3 = createBodyPart(new THREE.BoxGeometry(0.085, 0.13, 0.03), 0xffffff);
            s3.position.set(0, 0.15, -0.10); group.add(s3);
            const tailGeo = new THREE.BoxGeometry(0.02, 0.1, 0.1);
            const tail = createBodyPart(tailGeo, 0xffffff); tail.position.set(0, 0.15, -0.15); tail.name = 'tail'; group.add(tail);
            const finGeo = new THREE.BoxGeometry(0.1, 0.02, 0.08);
            const lf = createBodyPart(finGeo, 0xff8800); lf.position.set(-0.06, 0.1, 0); lf.rotation.z = -0.3; lf.name = 'leftFin'; group.add(lf);
            const rf = createBodyPart(finGeo, 0xff8800); rf.position.set(0.06, 0.1, 0); rf.rotation.z = 0.3; rf.name = 'rightFin'; group.add(rf);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const speed = isMoving ? 30 : 10;
            const tail = mesh.getObjectByName('tail');
            if (tail) tail.rotation.y = Math.sin(age * speed) * 0.4;
            const lf = mesh.getObjectByName('leftFin');
            const rf = mesh.getObjectByName('rightFin');
            if (lf) lf.rotation.x = Math.sin(age * speed) * 0.3;
            if (rf) rf.rotation.x = Math.sin(age * speed + Math.PI) * 0.3;
        }
    },
    BLUE_TANG: {
        name: 'Blue Tang', health: 3, damage: 0, speed: 2.8, hostile: false, color: 0x0055ff,
        size: 0.3, xpDrop: 1, lootChance: 0.1, waterOnly: true,
        buildMesh: () => {
            const group = new THREE.Group();
            const body = createBodyPart(new THREE.BoxGeometry(0.05, 0.22, 0.25), 0x0055ff);
            body.position.y = 0.15; group.add(body);
            const tailGeo = new THREE.BoxGeometry(0.02, 0.12, 0.12);
            const tail = createBodyPart(tailGeo, 0xffff00); tail.position.set(0, 0.15, -0.16); tail.name = 'tail'; group.add(tail);
            const finGeo = new THREE.BoxGeometry(0.08, 0.02, 0.06);
            const lf = createBodyPart(finGeo, 0xffff00); lf.position.set(-0.04, 0.1, 0); lf.rotation.z = -0.3; lf.name = 'leftFin'; group.add(lf);
            const rf = createBodyPart(finGeo, 0xffff00); rf.position.set(0.04, 0.1, 0); rf.rotation.z = 0.3; rf.name = 'rightFin'; group.add(rf);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const speed = isMoving ? 30 : 10;
            const tail = mesh.getObjectByName('tail');
            if (tail) tail.rotation.y = Math.sin(age * speed) * 0.4;
            const lf = mesh.getObjectByName('leftFin');
            const rf = mesh.getObjectByName('rightFin');
            if (lf) lf.rotation.x = Math.sin(age * speed) * 0.3;
            if (rf) rf.rotation.x = Math.sin(age * speed + Math.PI) * 0.3;
        }
    },
    SALMON: {
        name: 'Salmon', health: 6, damage: 0, speed: 3.5, hostile: false, color: 0xff5555,
        size: 0.4, xpDrop: 3, lootChance: 0.15, waterOnly: true,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body
            const body = createBodyPart(new THREE.BoxGeometry(0.12, 0.25, 0.45), 0xdd4444);
            body.position.y = 0.2;
            group.add(body);
            // Greenish back
            const back = createBodyPart(new THREE.BoxGeometry(0.125, 0.1, 0.45), 0x335533);
            back.position.set(0, 0.28, 0);
            group.add(back);
            // Tail
            const tailGeo = new THREE.BoxGeometry(0.02, 0.2, 0.15);
            const tail = createBodyPart(tailGeo, 0x335533);
            tail.position.set(0, 0.2, -0.28);
            tail.name = 'tail';
            group.add(tail);
            // Fins
            const finGeo = new THREE.BoxGeometry(0.15, 0.02, 0.15);
            const lf = createBodyPart(finGeo, 0xcc3333);
            lf.position.set(-0.08, 0.1, 0);
            lf.rotation.z = -0.2;
            lf.name = 'leftFin';
            group.add(lf);
            const rf = createBodyPart(finGeo, 0xcc3333);
            rf.position.set(0.08, 0.1, 0);
            rf.rotation.z = 0.2;
            rf.name = 'rightFin';
            group.add(rf);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const speed = isMoving ? 18 : 5;
            const tail = mesh.getObjectByName('tail');
            if (tail) tail.rotation.y = Math.sin(age * speed) * 0.5;
            const lf = mesh.getObjectByName('leftFin');
            const rf = mesh.getObjectByName('rightFin');
            if (lf) lf.rotation.x = Math.sin(age * speed) * 0.2;
            if (rf) rf.rotation.x = Math.sin(age * speed) * 0.2;
        }
    },
    PUFFERFISH: {
        name: 'Pufferfish', health: 4, damage: 2, speed: 1.5, hostile: true, color: 0xffee00,
        size: 0.35, xpDrop: 4, lootChance: 0.2, waterOnly: true,
        buildMesh: () => {
            const group = new THREE.Group();
            // Boxy Body
            const body = createBodyPart(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xffee00);
            body.position.y = 0.2;
            body.name = 'body';
            group.add(body);
            // Eyes
            const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const le = new THREE.Mesh(eyeGeo, eyeMat);
            le.position.set(-0.16, 0.25, 0.1);
            group.add(le);
            const re = new THREE.Mesh(eyeGeo, eyeMat);
            re.position.set(0.16, 0.25, 0.1);
            group.add(re);
            // Tail
            const tailGeo = new THREE.BoxGeometry(0.05, 0.1, 0.1);
            const tail = createBodyPart(tailGeo, 0xeecc00);
            tail.position.set(0, 0.2, -0.2);
            tail.name = 'tail';
            group.add(tail);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const speed = isMoving ? 15 : 4;
            const tail = mesh.getObjectByName('tail');
            if (tail) tail.rotation.y = Math.sin(age * speed) * 0.4;
            // Puffs up rhythmically when moving
            const body = mesh.getObjectByName('body');
            if (body) {
                const puff = isMoving ? 1.0 + Math.abs(Math.sin(age * 5)) * 0.4 : 1.0;
                body.scale.set(puff, puff, puff);
            }
        }
    },
    TURTLE: {
        name: 'Turtle', health: 30, damage: 0, speed: 1.2, hostile: false, color: 0x228822,
        size: 0.6, xpDrop: 5, lootChance: 0.5,
        buildMesh: () => {
            const group = new THREE.Group();
            // Shell
            const shell = createBodyPart(new THREE.BoxGeometry(0.6, 0.25, 0.7), 0x115511);
            shell.position.y = 0.3;
            group.add(shell);
            // Body (under shell)
            const body = createBodyPart(new THREE.BoxGeometry(0.5, 0.15, 0.6), 0x88cc88);
            body.position.y = 0.2;
            group.add(body);
            // Head
            const head = createBodyPart(new THREE.BoxGeometry(0.2, 0.15, 0.2), 0x88cc88);
            head.position.set(0, 0.25, 0.4);
            head.name = 'head';
            group.add(head);
            // Flippers
            const flipperGeo = new THREE.BoxGeometry(0.3, 0.05, 0.2);
            const fl1 = createBodyPart(flipperGeo, 0x88cc88);
            fl1.position.set(-0.35, 0.15, 0.2);
            fl1.name = 'fl1';
            group.add(fl1);
            const fl2 = createBodyPart(flipperGeo, 0x88cc88);
            fl2.position.set(0.35, 0.15, 0.2);
            fl2.name = 'fl2';
            group.add(fl2);
            const fl3 = createBodyPart(flipperGeo, 0x88cc88);
            fl3.position.set(-0.3, 0.15, -0.2);
            fl3.name = 'fl3';
            group.add(fl3);
            const fl4 = createBodyPart(flipperGeo, 0x88cc88);
            fl4.position.set(0.3, 0.15, -0.2);
            fl4.name = 'fl4';
            group.add(fl4);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const speed = isMoving ? 5 : 1;
            const swing = Math.sin(age * speed) * 0.3;
            const fl1 = mesh.getObjectByName('fl1');
            const fl2 = mesh.getObjectByName('fl2');
            const fl3 = mesh.getObjectByName('fl3');
            const fl4 = mesh.getObjectByName('fl4');
            const head = mesh.getObjectByName('head');
            
            if (fl1) fl1.rotation.y = swing;
            if (fl2) fl2.rotation.y = -swing;
            if (fl3) fl3.rotation.y = -swing;
            if (fl4) fl4.rotation.y = swing;
            if (head) head.rotation.y = Math.sin(age * 2) * 0.1;
        }
    },
    BIRD: {
        name: 'Bird', health: 5, damage: 0, speed: 4, hostile: false, color: 0x33aaee,
        size: 0.3, xpDrop: 2, lootChance: 0.1, flying: true,
        buildMesh: () => {
            const group = new THREE.Group();
            // Body
            const body = createBodyPart(new THREE.BoxGeometry(0.15, 0.15, 0.25), 0x33aaee);
            body.position.y = 0.2;
            group.add(body);
            // Head
            const head = createBodyPart(new THREE.BoxGeometry(0.12, 0.12, 0.12), 0x33aaee);
            head.position.set(0, 0.25, 0.15);
            group.add(head);
            // Beak
            const beak = createBodyPart(new THREE.ConeGeometry(0.03, 0.1, 4), 0xffcc00);
            beak.rotation.x = Math.PI / 2;
            beak.position.set(0, 0.25, 0.25);
            group.add(beak);
            // Wings
            const wingGeo = new THREE.BoxGeometry(0.3, 0.02, 0.15);
            const lw = createBodyPart(wingGeo, 0x2288cc);
            lw.position.set(-0.2, 0.22, 0);
            lw.name = 'leftWing';
            group.add(lw);
            const rw = createBodyPart(wingGeo, 0x2288cc);
            rw.position.set(0.2, 0.22, 0);
            rw.name = 'rightWing';
            group.add(rw);
            return group;
        },
        animate: (mesh, dt, age, isMoving) => {
            const flapSpeed = isMoving ? 25 : 5;
            const flapAmt = isMoving ? 1.0 : 0.2;
            const lw = mesh.getObjectByName('leftWing');
            const rw = mesh.getObjectByName('rightWing');
            if (lw) lw.rotation.z = Math.sin(age * flapSpeed) * flapAmt;
            if (rw) rw.rotation.z = -Math.sin(age * flapSpeed) * flapAmt;
            mesh.position.y += Math.sin(age * 4) * 0.005;
        }
    }
};

// Weighted mob type table for spawning
const MOB_SPAWN_WEIGHTS = [
    { type: 'SHEEP', weight: 20 },
    { type: 'SLIME', weight: 20 },
    { type: 'GOBLIN', weight: 15 },
    { type: 'ZOMBIE', weight: 15 },
    { type: 'SKELETON', weight: 15 },
    { type: 'SPIDER', weight: 10 },
    { type: 'BAT', weight: 5 },
    { type: 'WISP', weight: 5 },
    { type: 'BIRD', weight: 15 },
    { type: 'TROPICAL_FISH', weight: 25 }, // High spawn rate for aquatic life
    { type: 'SALMON', weight: 20 },
    { type: 'PUFFERFISH', weight: 10 },
    { type: 'TURTLE', weight: 10 },
];
const TOTAL_MOB_WEIGHT = MOB_SPAWN_WEIGHTS.reduce((s, e) => s + e.weight, 0);

function pickRandomMobType(isNether = false) {
    if (isNether) {
        return Math.random() < 0.5 ? 'LAVASLIME' : 'PIGLIN_BRUISER';
    }

    let r = Math.random() * TOTAL_MOB_WEIGHT;
    for (const entry of MOB_SPAWN_WEIGHTS) {
        r -= entry.weight;
        if (r <= 0) return entry.type;
    }
    return 'SLIME';
}

// ============================================
// Mobs & Entities
// ============================================
export class ItemEntity {
    constructor(item, count, position, atlas, velocity = null) {
        this.item = item;
        this.count = count;
        this.position = position.clone();
        if (velocity) {
            this.velocity = velocity.clone();
        } else {
            this.velocity = new THREE.Vector3((Math.random()-0.5)*5, 3, (Math.random()-0.5)*5);
        }
        this.alive = true;
        this.mesh = null;
        this.atlas = atlas;
        this.age = 0;
    }

    getMesh() {
        if (!this.mesh) {
            if (this.item.type === 'block') {
                const iconCanvas = this.atlas.getBlockIcon(this.item.subtype);
                const tex = new THREE.CanvasTexture(iconCanvas);
                tex.magFilter = THREE.NearestFilter;
                tex.colorSpace = THREE.SRGBColorSpace;
                const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
                this.mesh = new THREE.Sprite(mat);
                this.mesh.scale.set(0.4, 0.4, 0.4);
            } else if (this.item.type === 'material' || this.item.type === 'equipment' || this.item.type === 'wand' || this.item.type === 'spell') {
                let cvs;
                if (this.item.type === 'material' || this.item.type === 'equipment') {
                    cvs = generateItemTexture(this.item.type, this.item.subtype);
                } else if (this.item.type === 'wand') {
                    cvs = generateItemTexture('wand', this.item.subtype || 'wand_basic');
                } else if (this.item.type === 'spell') {
                    cvs = generateItemTexture('spell', this.item.data.spell.element || 'spell_basic');
                }
                const tex = new THREE.CanvasTexture(cvs);
                tex.magFilter = THREE.NearestFilter;
                tex.colorSpace = THREE.SRGBColorSpace;
                const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
                this.mesh = new THREE.Sprite(mat);
                this.mesh.scale.set(0.4, 0.4, 0.4);
            } else {
                const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
                const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // generic item color
                this.mesh = new THREE.Mesh(geo, mat);
            }
            this.mesh.position.copy(this.position);
        }
        return this.mesh;
    }

    update(dt, world, playerPos) {
        if (!this.alive) return;
        this.age += dt;
        
        this.velocity.y -= 15 * dt; // gravity
        
        const velStep = this.velocity.clone().multiplyScalar(dt);
        const col = world.collide(this.position, velStep, 0.3, 0.3);
        this.position.copy(col.position);
        
        if (col.velocity.x === 0) this.velocity.x = 0;
        if (col.velocity.y === 0) this.velocity.y = 0;
        if (col.velocity.z === 0) this.velocity.z = 0;
        
        if (col.grounded) {
            this.velocity.x *= 0.5;
            this.velocity.z *= 0.5;
        }

        if (this.mesh) {
            this.mesh.position.copy(this.position);
            // Floating animation
            this.mesh.position.y += Math.sin(this.age * 3) * 0.1 + 0.15;
            if (this.mesh.rotation) {
                this.mesh.rotation.y += dt;
            }
        }

        // Pickup range
        if (this.age > 0.5 && this.position.distanceTo(playerPos) < 1.5) {
            this.alive = false;
        }
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                this.mesh.material.dispose();
                if (this.mesh.material.map) this.mesh.material.map.dispose();
            }
        }
    }
}

export class Mob {
    constructor(typeKey, position) {
        this.type = typeKey;
        const config = MOB_TYPES[typeKey] || MOB_TYPES.SLIME;
        this.config = config;
        this.position = position.clone();
        this.velocity = new THREE.Vector3(0,0,0);
        this.health = config.health;
        this.maxHealth = config.health;
        this.damage = config.damage;
        this.speed = config.speed;
        this.hostile = config.hostile;
        this.color = config.color;
        this.size = config.size;
        this.flying = config.flying || false;
        this.mesh = null;
        this.alive = true;
        this.grounded = false;
        this.age = 0;
        this.isMoving = false;
        
        this.target = null;
        this.attackCooldown = 0;
        this.tintTimer = 0;
        this.freezeTimer = 0;
        this.originalSpeed = config.speed;
        
        // Health bar
        this.healthBar = null;
    }

    getMesh() {
        if (!this.mesh) {
            if (this.config.buildMesh) {
                this.mesh = this.config.buildMesh();
            } else {
                // Fallback box
                this.mesh = new THREE.Group();
                const geo = new THREE.BoxGeometry(this.size, this.size, this.size);
                const mat = new THREE.MeshLambertMaterial({ color: this.color });
                const body = new THREE.Mesh(geo, mat);
                body.position.y = this.size/2;
                body.castShadow = true;
                this.mesh.add(body);
            }
            
            // Add health bar above mob
            const barGroup = new THREE.Group();
            const bgGeo = new THREE.PlaneGeometry(0.6, 0.06);
            const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
            const bg = new THREE.Mesh(bgGeo, bgMat);
            barGroup.add(bg);
            
            const fgGeo = new THREE.PlaneGeometry(0.58, 0.04);
            const fgMat = new THREE.MeshBasicMaterial({ color: 0xff2244, side: THREE.DoubleSide });
            const fg = new THREE.Mesh(fgGeo, fgMat);
            fg.position.z = 0.001;
            this.healthBar = fg;
            barGroup.add(fg);
            
            barGroup.position.y = this.size + 0.3;
            barGroup.name = 'healthBar';
            this.mesh.add(barGroup);
            
            this.mesh.position.copy(this.position);
        }
        return this.mesh;
    }

    update(dt, world, playerPos) {
        if (!this.alive) return;
        this.age += dt;
        
        let inWater = false;
        if (this.config.waterOnly) {
            // Need BLOCKS from some scope, but wait, BLOCKS is not imported here.
            // Actually, we can check if the block is liquid using getBlockProperties
            const currentBlock = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
            inWater = currentBlock === 2 || currentBlock === 16; // WATER=2, SWAMP_WATER=16
        }

        if (!this.flying) {
            if (this.config.waterOnly && inWater) {
                // Buoyancy/swimming
                this.velocity.y += (Math.sin(this.age * 3) * 2.0 - this.velocity.y) * dt * 2;
            } else {
                this.velocity.y -= 25 * dt; // gravity
            }
        }
        
        // Decrease tint timer
        if (this.tintTimer > 0) {
            this.tintTimer -= dt;
            if (this.tintTimer <= 0 && this.mesh) {
                // Reset all materials to original colors
                this.mesh.traverse(child => {
                    if (child.isMesh && child.userData.originalColor !== undefined) {
                        child.material.color.setHex(child.userData.originalColor);
                    }
                });
            }
        }

        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt;
            this.speed = this.originalSpeed * 0.3;
            if (this.freezeTimer <= 0) {
                this.speed = this.originalSpeed;
            }
        }

        // Simple AI
        const dist = this.position.distanceTo(playerPos);
        this.isMoving = false;
        
        if (!this.wanderTimer) this.wanderTimer = 0;
        if (!this.wanderDir) this.wanderDir = new THREE.Vector3(0, 0, 0);
        
        if (this.hostile && dist < 20) {
            const dir = playerPos.clone().sub(this.position);
            if (!this.flying) dir.y = 0;
            if (dir.length() > 0) dir.normalize();
            
            if (dist > 1.5) {
                this.isMoving = true;
                this.velocity.x = dir.x * this.speed;
                this.velocity.z = dir.z * this.speed;
                
                if (this.flying) {
                    const targetY = playerPos.y + 1;
                    this.velocity.y = (targetY - this.position.y) * 2;
                }
                
                // Face player
                if (this.mesh) {
                    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                }
                
                // Jump over obstacles (non-flying mobs)
                if (!this.flying && this.grounded && Math.random() < dt * 3) {
                    // Check if blocked ahead
                    const aheadX = Math.floor(this.position.x + dir.x);
                    const aheadY = Math.floor(this.position.y);
                    const aheadZ = Math.floor(this.position.z + dir.z);
                    const blockAhead = world.getBlock(aheadX, aheadY, aheadZ);
                    if (getBlockProperties(blockAhead).solid) {
                        this.velocity.y = 7;
                        this.grounded = false;
                    }
                }
            } else {
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                if (this.attackCooldown <= 0) {
                    this.attackCooldown = 1.0;
                    this.didAttack = true;
                }
            }
        } else {
            // Wander
            if (this.wanderTimer <= 0) {
                if (Math.random() < 0.6) {
                    this.wanderTimer = 2 + Math.random() * 3;
                    const angle = Math.random() * Math.PI * 2;
                    this.wanderDir.set(Math.cos(angle), 0, Math.sin(angle));
                } else {
                    this.wanderTimer = 1 + Math.random() * 3;
                    this.wanderDir.set(0, 0, 0); // stop
                }
            }
            this.wanderTimer -= dt;

            if (this.wanderDir.lengthSq() > 0) {
                this.isMoving = true;
                this.velocity.x = this.wanderDir.x * this.speed * 0.4;
                this.velocity.z = this.wanderDir.z * this.speed * 0.4;
                
                if (this.flying) {
                    // Slight bobbing
                    this.velocity.y = Math.sin(this.age * 2) * 1.5;
                }
                
                if (this.mesh) {
                    this.mesh.rotation.y = Math.atan2(this.wanderDir.x, this.wanderDir.z);
                }

                // Jump over obstacles
                if (!this.flying && this.grounded && Math.random() < dt * 2) {
                    const aheadX = Math.floor(this.position.x + this.wanderDir.x);
                    const aheadY = Math.floor(this.position.y);
                    const aheadZ = Math.floor(this.position.z + this.wanderDir.z);
                    const blockAhead = world.getBlock(aheadX, aheadY, aheadZ);
                    if (getBlockProperties(blockAhead).solid) {
                        this.velocity.y = 6;
                        this.grounded = false;
                    }
                }
            } else {
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                if (this.flying || this.config.waterOnly) this.velocity.y *= 0.9;
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        const velStep = this.velocity.clone().multiplyScalar(dt);
        const col = world.collide(this.position, velStep, this.size * 0.8, this.size);
        this.position.copy(col.position);
        
        if (col.velocity.x === 0) this.velocity.x = 0;
        if (col.velocity.z === 0) this.velocity.z = 0;
        if (col.velocity.y === 0) this.velocity.y = 0;

        if (!this.flying && !this.config.waterOnly) {
            this.grounded = col.grounded;
        } else {
            // Flying / swimming extra boundary checks
            if (this.position.y < 0) {
                this.position.y = 0;
                this.velocity.y *= -0.5;
            }
        }
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            
            // Animate
            if (this.config.animate) {
                this.config.animate(this.mesh, dt, this.age, this.isMoving);
            }
            
            // Update health bar
            if (this.healthBar) {
                const pct = this.health / this.maxHealth;
                this.healthBar.scale.x = Math.max(0, pct);
                this.healthBar.position.x = -(1 - pct) * 0.29;
                // Show only when damaged
                const barGroup = this.mesh.getObjectByName('healthBar');
                if (barGroup) barGroup.visible = this.health < this.maxHealth;
            }
        }
    }

    takeDamage(amt, dir) {
        this.health -= amt;
        
        // Damage tint — color all child meshes red
        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    if (child.userData.originalColor === undefined) {
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    child.material.color.setHex(0xff0000);
                }
            });
            this.tintTimer = 0.2;
        }

        if (dir) {
            this.velocity.add(dir.clone().multiplyScalar(5));
            this.velocity.y += 3;
        }
        if (this.health <= 0 && this.alive) {
            this.alive = false;
            this.justDied = true;
        }
    }

    freeze(duration) {
        this.freezeTimer = Math.max(this.freezeTimer || 0, duration);
        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    if (child.userData.originalColor === undefined) {
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    child.material.color.setHex(0x88ccff); // blue tint
                }
            });
            this.tintTimer = Math.max(this.tintTimer, duration);
        }
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
        }
    }
}

export class Boss extends Mob {
    constructor(typeKey, position) {
        super(typeKey, position);
        // Scale up stats
        this.health *= 3;
        this.maxHealth = this.health;
        this.damage *= 2;
        this.speed *= 0.8;
        this.isBoss = true;
        this.phase = 1;
        this.abilityTimer = 0;
        this.didSlam = false;
        this.wantsToSummon = false;
    }
    
    getMesh() {
        super.getMesh();
        // Scale boss mesh up significantly
        if (this.mesh) {
            this.mesh.scale.setScalar(2.0);
        }
        return this.mesh;
    }

    update(dt, world, playerPos) {
        super.update(dt, world, playerPos);
        if (!this.alive) return;

        const dist = this.position.distanceTo(playerPos);
        if (dist > 32) return; // Wait until player is near

        // Phase Transition (Enrage below 50% health)
        const pct = this.health / this.maxHealth;
        if (this.phase === 1 && pct <= 0.5) {
            this.phase = 2;
            this.speed *= 1.3;
            this.damage *= 1.3;
            // Visual enrage effect (Red Tint)
            if (this.mesh) {
                this.mesh.traverse(child => {
                    if (child.isMesh && child.material && child.material.emissive) {
                        child.material.emissive.setHex(0x550000);
                        child.material.emissiveIntensity = 1.5;
                    }
                });
            }
        }

        // Special Abilities
        this.abilityTimer += dt;
        const abilityInterval = this.phase === 1 ? 5.0 : 3.5;

        if (this.abilityTimer > abilityInterval) {
            this.abilityTimer = 0;
            const r = Math.random();
            if (r < 0.5) {
                // Ground Slam: Jump up, and trigger slam when hitting the ground
                this.velocity.y = 8;
                this.didSlam = true;
            } else {
                // Summon Minion
                this.wantsToSummon = true;
            }
        }
    }
}

export class EntityManager {
    constructor(scene, atlas) {
        this.scene = scene;
        this.atlas = atlas;
        this.mobs = [];
        this.items = [];
        this.spawnTimer = 0;
    }

    addMob(mob) {
        this.mobs.push(mob);
        this.scene.add(mob.getMesh());
    }

    spawnItem(item, count, position, velocity = null) {
        const iEntity = new ItemEntity(item, count, position, this.atlas, velocity);
        this.items.push(iEntity);
        this.scene.add(iEntity.getMesh());
    }

    update(dt, world, playerPos, playerInventory, player, timeOfDay = 0.5, currentDimension = 'overworld') {
        // Day: 0.25 to 0.75. Night: 0.75-1.0 and 0.0-0.25
        const isDay = timeOfDay >= 0.25 && timeOfDay <= 0.75;
        // Boss spawner detection
        this.bossScanTimer = (this.bossScanTimer || 0) + dt;
        if (this.bossScanTimer > 2.0) {
            this.bossScanTimer = 0;
            const px = Math.floor(playerPos.x);
            const py = Math.floor(playerPos.y);
            const pz = Math.floor(playerPos.z);
            for (let x = -16; x <= 16; x++) {
                for (let y = -16; y <= 16; y++) {
                    for (let z = -16; z <= 16; z++) {
                        if (world.getBlock(px+x, py+y, pz+z) === BLOCKS.BOSS_SPAWNER) {
                            world.setBlock(px+x, py+y, pz+z, BLOCKS.AIR);
                            // Determine boss type based on surrounding blocks (theme)
                            let themeBlock = world.getBlock(px+x, py+y-1, pz+z);
                            let bossType = 'GOLEM';
                            if (themeBlock === BLOCKS.DUNGEON_FIRE_FLOOR) bossType = 'WISP'; // Or fire boss
                            else if (themeBlock === BLOCKS.DUNGEON_ICE_FLOOR) bossType = 'WISP';
                            // Spawn Boss!
                            const boss = new Boss(bossType, new THREE.Vector3(px+x, py+y, pz+z));
                            this.addMob(boss);
                        }
                    }
                }
            }
        }

        // Mob Spawning with timer
        this.spawnTimer += dt;
        if (this.spawnTimer > 2.0 && this.mobs.length < 20) {
            this.spawnTimer = 0;
            if (Math.random() < 0.4) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 18 + Math.random() * 20;
                const sx = playerPos.x + Math.cos(angle) * dist;
                const sz = playerPos.z + Math.sin(angle) * dist;
                
                // Find surface
                for (let y = 127; y > 0; y--) {
                    const b = world.getBlock(sx, y, sz);
                    if (b !== BLOCKS.AIR && b !== BLOCKS.LAVA) {
                        let type;
                        if (b === BLOCKS.WATER || b === BLOCKS.SWAMP_WATER) {
                            let isReef = false;
                            for (let cx = -2; cx <= 2; cx++) {
                                for (let cz = -2; cz <= 2; cz++) {
                                    const fb = world.getBlock(sx + cx, y - 1, sz + cz);
                                    if (fb >= BLOCKS.TUBE_CORAL && fb <= BLOCKS.HORN_CORAL) {
                                        isReef = true;
                                        break;
                                    }
                                }
                                if (isReef) break;
                            }
                            
                            if (isReef) {
                                const reefAquatic = ['CLOWNFISH', 'BLUE_TANG', 'TROPICAL_FISH', 'PUFFERFISH'];
                                type = reefAquatic[Math.floor(Math.random() * reefAquatic.length)];
                            } else {
                                const aquatic = ['SALMON', 'SALMON', 'TROPICAL_FISH', 'TURTLE'];
                                type = aquatic[Math.floor(Math.random() * aquatic.length)];
                            }
                        } else {
                            type = pickRandomMobType(currentDimension === 'nether');
                            while(MOB_TYPES[type].waterOnly) {
                                type = pickRandomMobType(currentDimension === 'nether');
                            }
                        }
                // Only allow hostile surface spawns at night (except in Nether)
                        const config = MOB_TYPES[type];
                        // Check if mob is hostile by checking if it has damage
                        const isHostile = (config.damage || 0) > 0;
                        if (isHostile && isDay && !config.flying && !config.waterOnly && currentDimension !== 'nether') break; // Skip surface hostiles during day

                        let spawnY = y + 2;
                        if (config.flying) spawnY = y + 5 + Math.random() * 10;
                        if (config.waterOnly) spawnY = y - 1 - Math.random() * 3;
                        
                        const mob = new Mob(type, new THREE.Vector3(sx, spawnY, sz));
                        this.addMob(mob);
                        break;
                    }
                }
            }
        }

        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const mob = this.mobs[i];
            mob.update(dt, world, playerPos);
            
            // Mob deals damage to player
            if (player && mob.alive && mob.didAttack && mob.position.distanceTo(playerPos) < 2.0) {
                player.takeDamage(mob.damage);
                mob.didAttack = false;
                // Damage flash
                const d = document.getElementById('damage-flash');
                if (d) { d.classList.add('active'); setTimeout(() => d.classList.remove('active'), 200); }
            }

            // Boss Abilities
            if (mob.isBoss && player && mob.alive) {
                if (mob.didSlam && mob.grounded && mob.velocity.y <= 0) {
                    mob.didSlam = false;
                    const dist = mob.position.distanceTo(playerPos);
                    if (dist < 10) {
                        player.takeDamage(mob.damage * 1.5);
                        player.velocity.y = 6; // Knockup effect
                        const d = document.getElementById('damage-flash');
                        if (d) { d.classList.add('active'); setTimeout(() => d.classList.remove('active'), 200); }
                    }
                }
                if (mob.wantsToSummon) {
                    mob.wantsToSummon = false;
                    // Summon a skeleton or zombie nearby
                    const sx = mob.position.x + (Math.random() - 0.5) * 6;
                    const sz = mob.position.z + (Math.random() - 0.5) * 6;
                    const minionTypes = ['SKELETON', 'ZOMBIE', 'SPIDER'];
                    const minion = new Mob(minionTypes[Math.floor(Math.random() * minionTypes.length)], new THREE.Vector3(sx, mob.position.y + 1, sz));
                    this.addMob(minion);
                }
            }
            
            if (mob.justDied) {
                // Drop spell or modifier
                if (mob.type === 'SHEEP') {
                    this.spawnItem(Item.blockItem(BLOCKS.WOOL, 'Wool'), 1 + Math.floor(Math.random() * 2), mob.position.clone());
                } else if (Math.random() < (mob.config.lootChance || 0.3)) {
                    if (Math.random() < 0.7) {
                        this.spawnItem(Item.spellItem(generateRandomSpell()), 1, mob.position.clone());
                    } else {
                        this.spawnItem(Item.modifierItem(generateRandomModifier()), 1, mob.position.clone());
                    }
                }
                
                // Boss Loot
                if (mob.isBoss) {
                    const r = Math.random();
                    if (r < 0.25) {
                        this.spawnItem(Item.equipmentItem('boss_chestplate', { protection: 5 }, 'Boss Armor', 'Wearable armor that reduces damage.'), 1, mob.position.clone());
                    } else if (r < 0.5) {
                        this.spawnItem(Item.equipmentItem('boss_boots', { flying: true }, 'Flying Boots', 'Allows you to fly.'), 1, mob.position.clone());
                    } else if (r < 0.75) {
                        this.spawnItem(Item.equipmentItem('boss_boots', { speedMult: 2.5 }, 'Speed Boots', 'Run super fast.'), 1, mob.position.clone());
                    } else {
                        this.spawnItem(Item.equipmentItem('boss_axe', { mineSpeed: 5.0 }, 'Super Mine Axe', 'Mines blocks instantly.'), 1, mob.position.clone());
                    }
                }

                mob.justDied = false;
            }

            // Despawn far mobs
            if (!mob.alive || mob.position.distanceTo(playerPos) > 60) {
                mob.dispose();
                this.mobs.splice(i, 1);
            }
        }

        for (let i = this.items.length - 1; i >= 0; i--) {
            const itemE = this.items[i];
            itemE.update(dt, world, playerPos);
            if (!itemE.alive) {
                // Was picked up
                playerInventory.addItem(itemE.item, itemE.count);
                itemE.dispose();
                this.items.splice(i, 1);
            }
        }
    }

    raycast(origin, direction, maxDist = 8) {
        let closestMob = null;
        let closestDist = maxDist;

        // Simple AABB ray intersection
        for (const mob of this.mobs) {
            if (!mob.alive) continue;
            
            // Mob AABB
            const min = mob.position.clone().sub(new THREE.Vector3(mob.size/2, 0, mob.size/2));
            const max = mob.position.clone().add(new THREE.Vector3(mob.size/2, mob.size, mob.size/2));
            const box = new THREE.Box3(min, max);
            const ray = new THREE.Ray(origin, direction);
            
            const hitPoint = new THREE.Vector3();
            if (ray.intersectBox(box, hitPoint)) {
                const dist = origin.distanceTo(hitPoint);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestMob = mob;
                }
            }
        }
        return { hit: closestMob !== null, mob: closestMob, distance: closestDist };
    }

    // Alias for backwards compatibility
    raycastEntities(origin, direction, maxDist) {
        return this.raycast(origin, direction, maxDist);
    }
}
