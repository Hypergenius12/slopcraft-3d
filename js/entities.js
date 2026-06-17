// ============================================
// entities.js — Player, Mobs, Bosses, Inventory
// ============================================
import * as THREE from 'three';
import { generateRandomWand, generateRandomSpell, generateRandomModifier } from './magic.js';
import { getBlockProperties, BLOCKS } from './textures.js';

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

        // Give starting items
        const starterWand = generateRandomWand();
        starterWand.equipSpell(0, generateRandomSpell());
        this.inventory.addItem(Item.wandItem(starterWand));
        this.inventory.addItem(Item.blockItem(BLOCKS.TORCH, 'Torch'), 32);
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

        // Movement input
        const speed = keys.sprint ? 8 : 5;
        let moveDir = new THREE.Vector3(0,0,0);
        
        if (keys.forward) moveDir.add(forward);
        if (keys.backward) moveDir.sub(forward);
        if (keys.right) moveDir.add(right);
        if (keys.left) moveDir.sub(right);
        
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        const blockIn = world.getBlock(this.position.x, this.position.y + 0.1, this.position.z);
        const inWater = blockIn === BLOCKS.WATER || blockIn === BLOCKS.SWAMP_WATER;
        const inLava = blockIn === BLOCKS.LAVA;

        if (inLava && Math.random() < dt * 4) {
            this.takeDamage(5);
            const d = document.getElementById('damage-flash');
            if(d) { d.classList.add('active'); setTimeout(() => d.classList.remove('active'), 200); }
        }

        // Physics variables
        const gravity = (inWater || inLava) ? -5 : -25;
        const drag = (inWater || inLava) ? 5 : 10;
        const jumpForce = (inWater || inLava) ? 4 : 9;

        // X/Z velocity update
        this.velocity.x += moveDir.x * speed * 10 * dt;
        this.velocity.z += moveDir.z * speed * 10 * dt;

        // Drag (friction)
        this.velocity.x -= this.velocity.x * drag * dt;
        this.velocity.z -= this.velocity.z * drag * dt;

        // Y velocity update (gravity)
        this.velocity.y += gravity * dt;

        // Jumping
        if (keys.jump) {
            if (this.grounded || inWater || inLava) {
                this.velocity.y = jumpForce;
                this.grounded = false;
            } else {
                const blockInProps = getBlockProperties(blockIn);
                if (blockInProps && blockInProps.solid) {
                    this.position.y += Math.max(1, dt * 10);
                }
            }
        }

        // Collision
        const velStep = this.velocity.clone().multiplyScalar(dt);
        const colResult = world.collide(this.position, velStep, this.width, this.height);
        
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
        if (this.equippedWand) this.equippedWand.updateCooldowns(dt);
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
        this.health -= amt;
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

function createBodyPart(geo, color, emissive = 0x000000, emissiveIntensity = 0) {
    const mat = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
}

// ============================================
// Mob Type Definitions (Enhanced)
// ============================================

export const MOB_TYPES = {
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
    }
};

// Weighted mob type table for spawning
const MOB_SPAWN_WEIGHTS = [
    { type: 'SLIME', weight: 25 },
    { type: 'GOBLIN', weight: 20 },
    { type: 'ZOMBIE', weight: 15 },
    { type: 'SKELETON', weight: 15 },
    { type: 'SPIDER', weight: 12 },
    { type: 'BAT', weight: 8 },
    { type: 'WISP', weight: 5 },
];
const TOTAL_MOB_WEIGHT = MOB_SPAWN_WEIGHTS.reduce((s, e) => s + e.weight, 0);

function pickRandomMobType() {
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
    constructor(item, count, position, atlas) {
        this.item = item;
        this.count = count;
        this.position = position.clone();
        this.velocity = new THREE.Vector3((Math.random()-0.5)*5, 3, (Math.random()-0.5)*5);
        this.alive = true;
        this.mesh = null;
        this.atlas = atlas;
        this.age = 0;
    }

    getMesh() {
        if (!this.mesh) {
            const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            let mat;
            if (this.item.type === 'block') {
                const iconCanvas = this.atlas.getBlockIcon(this.item.subtype);
                const tex = new THREE.CanvasTexture(iconCanvas);
                tex.magFilter = THREE.NearestFilter;
                tex.colorSpace = THREE.SRGBColorSpace;
                mat = new THREE.MeshBasicMaterial({ map: tex });
            } else {
                mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // generic item color
            }
            this.mesh = new THREE.Mesh(geo, mat);
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
            this.mesh.rotation.y += dt;
        }

        // Pickup range
        if (this.age > 0.5 && this.position.distanceTo(playerPos) < 1.5) {
            this.alive = false;
        }
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            if (this.mesh.material.map) this.mesh.material.map.dispose();
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
        
        if (!this.flying) {
            this.velocity.y -= 25 * dt; // gravity
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
                    if (world.getBlockProperties(blockAhead).solid) {
                        this.velocity.y = 6;
                        this.grounded = false;
                    }
                }
            } else {
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
                if (this.flying) this.velocity.y *= 0.9;
            }
        }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;

        // Collision
        if (!this.flying) {
            const velStep = this.velocity.clone().multiplyScalar(dt);
            const col = world.collide(this.position, velStep, this.size * 0.8, this.size);
            this.position.copy(col.position);
            this.grounded = col.grounded;
            if (col.velocity.x === 0) this.velocity.x = 0;
            if (col.velocity.z === 0) this.velocity.z = 0;
            if (col.velocity.y === 0) this.velocity.y = 0;
        } else {
            this.position.add(this.velocity.clone().multiplyScalar(dt));
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
    }
    
    getMesh() {
        super.getMesh();
        // Scale boss mesh up
        if (this.mesh) {
            this.mesh.scale.setScalar(1.8);
        }
        return this.mesh;
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

    spawnItem(item, count, position) {
        const iEntity = new ItemEntity(item, count, position, this.atlas);
        this.items.push(iEntity);
        this.scene.add(iEntity.getMesh());
    }

    update(dt, world, playerPos, playerInventory, player) {
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
                    if (b !== BLOCKS.AIR && b !== BLOCKS.WATER && b !== BLOCKS.LAVA) {
                        const type = pickRandomMobType();
                        const config = MOB_TYPES[type];
                        const spawnY = config.flying ? y + 5 + Math.random() * 10 : y + 2;
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
            
            if (mob.justDied) {
                // Drop spell or modifier
                if (Math.random() < (mob.config.lootChance || 0.3)) {
                    if (Math.random() < 0.7) {
                        this.spawnItem(
                            Item.spellItem(generateRandomSpell()),
                            1,
                            mob.position.clone()
                        );
                    } else {
                        this.spawnItem(
                            Item.modifierItem(generateRandomModifier()),
                            1,
                            mob.position.clone()
                        );
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
