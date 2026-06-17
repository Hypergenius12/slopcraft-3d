// ============================================
// audio.js — SFX Synthesizer using Web Audio API
// ============================================

import { BLOCKS } from './textures.js';

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
    }

    _ensureContext() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(freq, type, duration, vol = 1.0, slide = 0) {
        this._ensureContext();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slide !== 0) {
            osc.frequency.exponentialRampToValueAtTime(freq + slide, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol = 1.0) {
        this._ensureContext();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        // Simple lowpass filter for noise
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        noiseSource.start();
    }

    playFootstep(blockType) {
        // Subtle noise
        this.playNoise(0.05, 0.1);
    }

    playWaterSplash() {
        this.playNoise(0.3, 0.4);
    }

    playBreak(blockType) {
        if ([BLOCKS.STONE, BLOCKS.COBBLESTONE, BLOCKS.IRON_ORE, BLOCKS.GOLD_ORE, BLOCKS.CRYSTAL_ORE, BLOCKS.MANA_ORE, BLOCKS.OBSIDIAN, BLOCKS.DUNGEON_BRICK, BLOCKS.BEDROCK, BLOCKS.ALIEN_STONE].includes(blockType)) {
            // Deep rocky crunch
            this.playNoise(0.2, 0.4);
            this.playTone(80, 'triangle', 0.1, 0.5, -40);
        } else if ([BLOCKS.WOOD, BLOCKS.PLANKS, BLOCKS.PORTAL_FRAME, BLOCKS.ACACIA_WOOD].includes(blockType)) {
            // Wood crack
            this.playNoise(0.1, 0.2);
            this.playTone(200, 'square', 0.05, 0.3, -50);
        } else if ([BLOCKS.SAND, BLOCKS.GRAVEL, BLOCKS.RED_SAND, BLOCKS.DIRT, BLOCKS.GRASS].includes(blockType)) {
            // Soft sandy dig
            this.playNoise(0.15, 0.2);
        } else if ([BLOCKS.GLASS, BLOCKS.ICE, BLOCKS.ALIEN_CRYSTAL].includes(blockType)) {
            // Glass shatter
            this.playNoise(0.1, 0.3);
            this.playTone(800, 'sine', 0.05, 0.4, -200);
        } else {
            // Default generic break
            this.playNoise(0.15, 0.3);
        }
    }

    playPlace(blockType) {
        if ([BLOCKS.STONE, BLOCKS.COBBLESTONE, BLOCKS.IRON_ORE, BLOCKS.GOLD_ORE, BLOCKS.CRYSTAL_ORE, BLOCKS.MANA_ORE, BLOCKS.OBSIDIAN, BLOCKS.DUNGEON_BRICK, BLOCKS.ALIEN_STONE].includes(blockType)) {
            this.playTone(100, 'triangle', 0.1, 0.4, -20);
        } else if ([BLOCKS.WOOD, BLOCKS.PLANKS, BLOCKS.PORTAL_FRAME, BLOCKS.ACACIA_WOOD].includes(blockType)) {
            this.playTone(180, 'square', 0.08, 0.3, -30);
        } else if ([BLOCKS.SAND, BLOCKS.GRAVEL, BLOCKS.RED_SAND, BLOCKS.DIRT, BLOCKS.GRASS].includes(blockType)) {
            this.playNoise(0.08, 0.15);
        } else {
            this.playTone(150, 'triangle', 0.1, 0.3, -50);
        }
    }

    playHit() {
        this.playNoise(0.12, 0.4);
        this.playTone(200, 'square', 0.1, 0.3, -100);
    }

    playClick() {
        this.playTone(800, 'sine', 0.05, 0.2);
    }

    playCast() {
        this.playTone(600, 'sine', 0.3, 0.3, 400);
    }

    playHurt() {
        this.playNoise(0.2, 0.6);
        this.playTone(100, 'sawtooth', 0.2, 0.4, -50);
    }
}
