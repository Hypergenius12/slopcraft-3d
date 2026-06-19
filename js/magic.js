// ============================================
// magic.js — Spells, Modifiers, Wands, Projectiles
// ============================================
import * as THREE from 'three';

let MAGIC_ID_COUNTER = 0;
function getUniqueId() { return `magic_${MAGIC_ID_COUNTER++}`; }

export const SPELL_TYPES = {
    BOLT: { name: 'Arcane Bolt', baseDamage: 15, baseManaCost: 5, baseCooldown: 0.5, projectileSpeed: 20, projectileCount: 1, element: 'ICE', color: 0x0088ff, description: 'Fires a fast moving magical bolt.' },
    BURST: { name: 'Fire Burst', baseDamage: 25, baseManaCost: 15, baseCooldown: 1.5, projectileSpeed: 10, projectileCount: 5, element: 'FIRE', color: 0xff4422, description: 'Fires a spread of burning projectiles.' },
    HEAL: { name: 'Nature Grace', baseDamage: -20, baseManaCost: 30, baseCooldown: 5.0, projectileSpeed: 5, projectileCount: 1, element: 'HEAL', color: 0xadff2f, description: 'Heals the caster instantly.' },
    MISSILE: { name: 'Magic Missile', baseDamage: 30, baseManaCost: 20, baseCooldown: 2.0, projectileSpeed: 8, projectileCount: 1, element: 'arcane', color: 0x4488ff, description: 'A slow but powerful homing missile.' },
    METEOR: { name: 'Meteor Strike', baseDamage: 100, baseManaCost: 50, baseCooldown: 4.0, projectileSpeed: 15, projectileCount: 1, element: 'FIRE', color: 0xffaa00, description: 'Calls down a massive meteor.' }
};

export const MODIFIER_TYPES = {
    DAMAGE_UP: { name: 'Damage +25%', rarity: 'common', stackable: true, maxStacks: 5, effect: (s) => { s.damageMult += 0.25; } },
    SPEED_UP: { name: 'Speed +50%', rarity: 'common', stackable: true, maxStacks: 3, effect: (s) => { s.speedMult += 0.50; } },
    MANA_EFF: { name: 'Mana Cost -20%', rarity: 'common', stackable: true, maxStacks: 3, effect: (s) => { s.manaMult *= 0.8; } },
    PIERCE: { name: 'Pierce', rarity: 'uncommon', stackable: false, maxStacks: 1, effect: (s) => { s.pierce = true; } },
    HOMING: { name: 'Homing', rarity: 'uncommon', stackable: false, maxStacks: 1, effect: (s) => { s.homing = true; } },
    BURN: { name: 'Burn', rarity: 'uncommon', stackable: false, maxStacks: 1, effect: (s) => { s.statusEffects.push('burn'); } },
    MULTIPLY: { name: 'Multiply', rarity: 'rare', stackable: true, maxStacks: 2, effect: (s) => { s.projCountMult += 1; } },
    CAST_TWO: { name: 'Cast Two', rarity: 'epic', stackable: false, maxStacks: 1, effect: (s) => { s.castTwo = true; } }
};

export class Modifier {
    constructor(typeKey) {
        const config = MODIFIER_TYPES[typeKey];
        this.type = typeKey;
        this.name = config.name;
        this.rarity = config.rarity;
        this.config = config;
        this.id = getUniqueId();
    }
}

export class Spell {
    constructor(typeKey) {
        this.type = typeKey;
        const config = SPELL_TYPES[typeKey];
        this.name = config.name;
        this.baseDamage = config.baseDamage;
        this.baseManaCost = config.baseManaCost;
        this.baseCooldown = config.baseCooldown;
        this.baseProjSpeed = config.projectileSpeed;
        this.baseProjCount = config.projectileCount;
        this.element = config.element;
        this.color = config.color;
        
        this.modifiers = [];
        this.id = getUniqueId();
    }

    addModifier(mod) {
        if (!mod.config.stackable && this.modifiers.some(m => m.type === mod.type)) return false;
        if (mod.config.stackable && this.modifiers.filter(m => m.type === mod.type).length >= mod.config.maxStacks) return false;
        this.modifiers.push(mod);
        return true;
    }

    removeModifier(index) {
        this.modifiers.splice(index, 1);
    }

    getCalculatedStats() {
        const stats = {
            damageMult: 1.0, speedMult: 1.0, manaMult: 1.0, projCountMult: 1.0,
            pierce: false, homing: false, statusEffects: [], castTwo: false
        };
        for (const mod of this.modifiers) {
            mod.config.effect(stats);
        }
        return {
            damage: this.baseDamage * stats.damageMult,
            manaCost: this.baseManaCost * stats.manaMult,
            cooldown: this.baseCooldown, // simple for now
            speed: this.baseProjSpeed * stats.speedMult,
            count: Math.floor(this.baseProjCount * stats.projCountMult),
            pierce: stats.pierce, homing: stats.homing,
            effects: stats.statusEffects, castTwo: stats.castTwo,
            element: this.element
        };
    }
}

export class Wand {
    constructor(name, maxSlots) {
        this.name = name;
        this.maxSlots = maxSlots;
        this.spellSlots = new Array(maxSlots).fill(null);
        this.cooldowns = new Array(maxSlots).fill(0);
        this.id = getUniqueId();
    }

    equipSpell(index, spell) {
        if (index >= 0 && index < this.maxSlots) this.spellSlots[index] = spell;
    }

    updateCooldowns(dt) {
        for(let i=0; i<this.cooldowns.length; i++) {
            if (this.cooldowns[i] > 0) this.cooldowns[i] -= dt;
        }
    }

    cast(index, player) {
        if (index < 0 || index >= this.maxSlots) return null;
        let spellItem = this.spellSlots[index];
        if (!spellItem || this.cooldowns[index] > 0) return null;
        
        // Unwrap spell if it is an Item object
        let spell = spellItem;
        if (spellItem.type === 'spell' && spellItem.data && spellItem.data.spell) spell = spellItem.data.spell;
        else if (spellItem.item && spellItem.item.type === 'spell' && spellItem.item.data && spellItem.item.data.spell) spell = spellItem.item.data.spell;
        
        if (typeof spell.getCalculatedStats !== 'function') return null;

        const stats = spell.getCalculatedStats();
        if (!player.useMana(stats.manaCost)) return null;

        this.cooldowns[index] = stats.cooldown;
        return { spell, stats };
    }
}

export class SpellProjectile {
    constructor(origin, direction, stats, spellColor) {
        this.position = origin.clone();
        this.velocity = direction.clone().normalize().multiplyScalar(stats.speed);
        this.stats = stats;
        this.color = spellColor;
        this.element = stats.element;
        if (this.element === 'FIRE') this.color = 0xff0000;
        if (this.element === 'ICE') this.color = 0x0088ff;
        if (this.element === 'HEAL') this.color = 0xadff2f;
        this.alive = true;
        this.age = 0;
        this.maxAge = 5;
        this.mesh = null;
    }

    getMesh() {
        if (!this.mesh) {
            const geo = new THREE.SphereGeometry(0.2, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: this.color });
            this.mesh = new THREE.Mesh(geo, mat);
            
            const light = new THREE.PointLight(this.color, 1, 5);
            this.mesh.add(light);
            this.mesh.position.copy(this.position);
        }
        return this.mesh;
    }

    update(dt) {
        this.age += dt;
        if (this.age >= this.maxAge) {
            this.alive = false;
            return;
        }
        this.position.add(this.velocity.clone().multiplyScalar(dt));
        if (this.mesh) this.mesh.position.copy(this.position);
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}

export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
    }

    add(proj) {
        this.projectiles.push(proj);
        this.scene.add(proj.getMesh());
    }

    update(dt, checkHit) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            
            if (!p.alive) {
                p.dispose();
                this.projectiles.splice(i, 1);
                continue;
            }

            const hitResult = checkHit(p);
            if (hitResult) {
                // Apply damage/effects to hitResult.entity
                p.alive = false;
                p.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }
}

export function generateRandomWand() {
    return new Wand("Apprentice Wand", 3);
}

export function generateRandomSpell() {
    const keys = Object.keys(SPELL_TYPES);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return new Spell(key);
}

export function generateRandomModifier() {
    const keys = Object.keys(MODIFIER_TYPES);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return new Modifier(key);
}
