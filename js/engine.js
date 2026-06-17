// ============================================
// engine.js — Core Engine, Rendering, Chunks, Physics
// ============================================
import * as THREE from 'three';
import { BLOCKS, getBlockProperties, ATLAS_SIZE } from './textures.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;

// ============================================
// InputManager
// ============================================
export class InputManager {
    constructor() {
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false, crouch: false };
        this.mouse = { dx: 0, dy: 0, leftClick: false, rightClick: false, scrollDelta: 0 };
        this.menuKeys = { inventory: false, spellConfig: false, pause: false, planet: false, debug: false };
        this._menuKeysDown = { inventory: false, spellConfig: false, pause: false, planet: false, debug: false };
        this.hotbarIndex = -1;
        this.isLocked = false;
        this.canvas = null;
    }

    init(canvas) {
        this.canvas = canvas;

        document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this.onKeyUp(e), false);
        
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.mouse.dx += e.movementX || 0;
                this.mouse.dy += e.movementY || 0;
            }
        }, false);

        document.addEventListener('mousedown', (e) => {
            if (!this.isLocked) return;
            if (e.button === 0) this.mouse.leftClick = true;
            if (e.button === 2) this.mouse.rightClick = true;
        }, false);

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.leftClick = false;
            if (e.button === 2) this.mouse.rightClick = false;
        }, false);

        document.addEventListener('wheel', (e) => {
            if (this.isLocked) {
                this.mouse.scrollDelta = Math.sign(e.deltaY);
            }
        }, { passive: true });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
        }, false);

        // Prevent context menu
        document.addEventListener('contextmenu', e => e.preventDefault());
    }

    requestPointerLock() {
        if (!this.isLocked && this.canvas) {
            this.canvas.requestPointerLock();
        }
    }

    resetMouse() {
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        this.mouse.scrollDelta = 0;
        this.hotbarIndex = -1;
        // Edge triggered keys reset
        this.menuKeys.inventory = false;
        this.menuKeys.spellConfig = false;
        this.menuKeys.pause = false;
        this.menuKeys.planet = false;
    }

    isPointerLocked() {
        return this.isLocked;
    }

    onKeyDown(e) {
        if (e.code === 'Tab' || e.code === 'F3') e.preventDefault();
        if (!this.isLocked && !['Escape', 'KeyE', 'KeyF', 'KeyP', 'Tab', 'KeyI', 'F3'].includes(e.code)) return;

        switch(e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = true; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = true; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = true; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = true; break;
            case 'ControlLeft': case 'KeyC': this.keys.crouch = true; break;
            
            case 'Tab':
            case 'KeyI':
            case 'KeyE': 
                if (!this._menuKeysDown.inventory) { this.menuKeys.inventory = true; this._menuKeysDown.inventory = true; }
                break;
            case 'KeyF': 
                if (!this._menuKeysDown.spellConfig) { this.menuKeys.spellConfig = true; this._menuKeysDown.spellConfig = true; }
                break;
            case 'KeyP':
                if (!this._menuKeysDown.planet) { this.menuKeys.planet = true; this._menuKeysDown.planet = true; }
                break;
            case 'Escape': 
                if (!this._menuKeysDown.pause) { this.menuKeys.pause = true; this._menuKeysDown.pause = true; }
                break;
            case 'F3':
                if (!this._menuKeysDown.debug) { this.menuKeys.debug = true; this._menuKeysDown.debug = true; }
                break;
            
            case 'Digit1': this.hotbarIndex = 0; break;
            case 'Digit2': this.hotbarIndex = 1; break;
            case 'Digit3': this.hotbarIndex = 2; break;
            case 'Digit4': this.hotbarIndex = 3; break;
            case 'Digit5': this.hotbarIndex = 4; break;
            case 'Digit6': this.hotbarIndex = 5; break;
            case 'Digit7': this.hotbarIndex = 6; break;
            case 'Digit8': this.hotbarIndex = 7; break;
            case 'Digit9': this.hotbarIndex = 8; break;
        }
    }

    onKeyUp(e) {
        switch(e.code) {
            case 'KeyW': case 'ArrowUp': this.keys.forward = false; break;
            case 'KeyS': case 'ArrowDown': this.keys.backward = false; break;
            case 'KeyA': case 'ArrowLeft': this.keys.left = false; break;
            case 'KeyD': case 'ArrowRight': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': case 'ShiftRight': this.keys.sprint = false; break;
            case 'ControlLeft': case 'KeyC': this.keys.crouch = false; break;

            case 'Tab': case 'KeyI': case 'KeyE': this._menuKeysDown.inventory = false; break;
            case 'KeyF': this._menuKeysDown.spellConfig = false; break;
            case 'KeyP': this._menuKeysDown.planet = false; break;
            case 'Escape': this._menuKeysDown.pause = false; break;
            case 'F3': this._menuKeysDown.debug = false; break;
        }
    }
}

// ============================================
// GameEngine
// ============================================
export class GameEngine {
    constructor() {
        this._scene = new THREE.Scene();
        this._camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this._renderer = null;
    }

    get scene() { return this._scene; }
    get camera() { return this._camera; }
    get renderer() { return this._renderer; }

    init(canvas) {
        this._renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Shadows
        this._renderer.shadowMap.enabled = true;
        this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Color management
        this._renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this._renderer || !this._camera) return;
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setFog(color, near, far) {
        this._scene.fog = new THREE.Fog(color, near, far);
    }
}

// ============================================
// Chunk
// ============================================

// Face definitions: normal, vertices (x,y,z), ambient occlusion vertex indices
const FACES = [
    { dir: [0, 1, 0], v: [[0,1,1], [1,1,1], [1,1,0], [0,1,0]], name: 'top' }, // top
    { dir: [0, -1, 0], v: [[0,0,0], [1,0,0], [1,0,1], [0,0,1]], name: 'bottom' }, // bottom
    { dir: [1, 0, 0], v: [[1,0,1], [1,0,0], [1,1,0], [1,1,1]], name: 'side' }, // right
    { dir: [-1, 0, 0], v: [[0,0,0], [0,0,1], [0,1,1], [0,1,0]], name: 'side' }, // left
    { dir: [0, 0, 1], v: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]], name: 'side' }, // front
    { dir: [0, 0, -1], v: [[1,0,0], [0,0,0], [0,1,0], [1,1,0]], name: 'side' }, // back
];

export class Chunk {
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.mesh = null;
        this.dirty = false;
    }

    getBlock(lx, ly, lz) {
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return BLOCKS.AIR;
        return this.blocks[(ly * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx];
    }

    setBlock(lx, ly, lz, type) {
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return;
        this.blocks[(ly * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx] = type;
        this.dirty = true;
    }

    buildMesh(atlas, getNeighborBlock) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const colors = [];

        const opaqueIndices = [];
        const crossIndices = [];
        const glowCrossIndices = [];
        const waterIndices = [];
        const transparentIndices = [];
        
        let vertexCount = 0;

        const wxBase = this.cx * CHUNK_SIZE;
        const wzBase = this.cz * CHUNK_SIZE;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType === BLOCKS.AIR) continue;

                    const wx = wxBase + x;
                    const wz = wzBase + z;
                    const props = getBlockProperties(blockType);

                    if (props.isCross) {
                        const uvInfo = atlas.getUV(blockType, 'side');
                        // Diagonal 1
                        positions.push(x, y, z,   x+1, y, z+1,   x+1, y+1, z+1,   x, y+1, z);
                        normals.push(0.7, 0, -0.7,  0.7, 0, -0.7,  0.7, 0, -0.7,  0.7, 0, -0.7);
                        uvs.push(uvInfo.u, uvInfo.v,  uvInfo.u + uvInfo.uSize, uvInfo.v,  uvInfo.u + uvInfo.uSize, uvInfo.v + uvInfo.vSize,  uvInfo.u, uvInfo.v + uvInfo.vSize);
                        colors.push(1,1,1, 1,1,1, 1,1,1, 1,1,1);
                        
                        // Diagonal 2
                        positions.push(x, y, z+1,   x+1, y, z,   x+1, y+1, z,   x, y+1, z+1);
                        normals.push(0.7, 0, 0.7,  0.7, 0, 0.7,  0.7, 0, 0.7,  0.7, 0, 0.7);
                        uvs.push(uvInfo.u, uvInfo.v,  uvInfo.u + uvInfo.uSize, uvInfo.v,  uvInfo.u + uvInfo.uSize, uvInfo.v + uvInfo.vSize,  uvInfo.u, uvInfo.v + uvInfo.vSize);
                        colors.push(1,1,1, 1,1,1, 1,1,1, 1,1,1);
                        
                        const indicesArray = blockType === BLOCKS.TORCH ? glowCrossIndices : crossIndices;
                        indicesArray.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
                        indicesArray.push(vertexCount+4, vertexCount+5, vertexCount+6, vertexCount+4, vertexCount+6, vertexCount+7);
                        vertexCount += 8;
                        continue;
                    }

                    for (const face of FACES) {
                        const nx = x + face.dir[0];
                        const ny = y + face.dir[1];
                        const nz = z + face.dir[2];

                        let neighborType;
                        if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT) {
                            neighborType = getNeighborBlock(wx + face.dir[0], ny, wz + face.dir[2]);
                        } else {
                            neighborType = this.getBlock(nx, ny, nz);
                        }

                        const neighborProps = getBlockProperties(neighborType);

                        const bothLiquids = props.isLiquid && neighborProps.isLiquid;

                        // Render face if neighbor is transparent (and not the same transparent block, like water)
                        if (neighborType === BLOCKS.AIR || (neighborProps.transparent && blockType !== neighborType && !bothLiquids)) {
                            
                            const uvInfo = atlas.getUV(blockType, face.name);
                            
                            // 4 vertices per face
                            for (let i = 0; i < 4; i++) {
                                const v = face.v[i];
                                positions.push(x + v[0], y + v[1], z + v[2]);
                                normals.push(face.dir[0], face.dir[1], face.dir[2]);
                            }

                            // UVs mapping
                            uvs.push(uvInfo.u, uvInfo.v); // bottom left
                            uvs.push(uvInfo.u + uvInfo.uSize, uvInfo.v); // bottom right
                            uvs.push(uvInfo.u + uvInfo.uSize, uvInfo.v + uvInfo.vSize); // top right
                            uvs.push(uvInfo.u, uvInfo.v + uvInfo.vSize); // top left

                            // Calculate ambient occlusion
                            const aoColor = calculateVertexAO(wx, y, wz, face, getNeighborBlock, blockType);
                            for(let i=0; i<4; i++) {
                                colors.push(aoColor[i], aoColor[i], aoColor[i]);
                            }

                            // Add indices
                            let indicesArray = opaqueIndices;
                            if (props.transparent) {
                                if (blockType === BLOCKS.WATER || blockType === BLOCKS.SWAMP_WATER || blockType === BLOCKS.LAVA) {
                                    indicesArray = waterIndices;
                                } else {
                                    indicesArray = transparentIndices;
                                }
                            }
                            indicesArray.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
                            vertexCount += 4;
                        }
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const allIndices = [...opaqueIndices, ...crossIndices, ...glowCrossIndices, ...waterIndices, ...transparentIndices];
        geometry.setIndex(allIndices);
        
        geometry.addGroup(0, opaqueIndices.length, 0);
        geometry.addGroup(opaqueIndices.length, crossIndices.length, 1);
        geometry.addGroup(opaqueIndices.length + crossIndices.length, glowCrossIndices.length, 2);
        geometry.addGroup(opaqueIndices.length + crossIndices.length + glowCrossIndices.length, waterIndices.length, 3);
        geometry.addGroup(opaqueIndices.length + crossIndices.length + glowCrossIndices.length + waterIndices.length, transparentIndices.length, 4);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Use MeshLambertMaterial for classic Minecraft voxel shading style
        const matOpaque = new THREE.MeshLambertMaterial({ 
            map: atlas.texture, 
            vertexColors: true,
            transparent: false,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });

        const matCross = new THREE.MeshLambertMaterial({
            map: atlas.texture,
            vertexColors: true,
            transparent: false,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });

        const matGlowCross = new THREE.MeshLambertMaterial({
            map: atlas.texture,
            vertexColors: true,
            transparent: false,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(0xffffff),
            emissiveMap: atlas.texture,
            emissiveIntensity: 1.0
        });

        const matWater = new THREE.MeshLambertMaterial({
            map: atlas.texture,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const matTransparent = new THREE.MeshLambertMaterial({
            map: atlas.texture,
            vertexColors: true,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });
        
        const materials = [matOpaque, matCross, matGlowCross, matWater, matTransparent];

        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh.geometry = geometry;
            this.mesh.material = materials;
        } else {
            this.mesh = new THREE.Mesh(geometry, materials);
            this.mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
        }
        this.dirty = false;
        return this.mesh;
    }

    dispose() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
    }
}

function calculateVertexAO(wx, wy, wz, face, getNeighborBlock, blockType) {
    if (blockType === BLOCKS.WATER || blockType === BLOCKS.LAVA || blockType === BLOCKS.GLASS || blockType === BLOCKS.TORCH) return [1, 1, 1, 1];

    const isSolid = (dx, dy, dz) => {
        const type = getNeighborBlock(wx + dx, wy + dy, wz + dz);
        if (type === BLOCKS.AIR || type === BLOCKS.WATER || type === BLOCKS.LAVA || type === BLOCKS.GLASS || type === BLOCKS.LEAVES || type === BLOCKS.TORCH) return false;
        return true;
    };

    const vertexAO = (vx, vy, vz) => {
        let dx1 = 0, dy1 = 0, dz1 = 0;
        let dx2 = 0, dy2 = 0, dz2 = 0;
        
        if (face.dir[0] !== 0) { // X face
            dy1 = vy === 1 ? 1 : -1;
            dz2 = vz === 1 ? 1 : -1;
        } else if (face.dir[1] !== 0) { // Y face
            dx1 = vx === 1 ? 1 : -1;
            dz2 = vz === 1 ? 1 : -1;
        } else { // Z face
            dx1 = vx === 1 ? 1 : -1;
            dy2 = vy === 1 ? 1 : -1;
        }

        const side1 = isSolid(face.dir[0] + dx1, face.dir[1] + dy1, face.dir[2] + dz1);
        const side2 = isSolid(face.dir[0] + dx2, face.dir[1] + dy2, face.dir[2] + dz2);
        const corner = isSolid(face.dir[0] + dx1 + dx2, face.dir[1] + dy1 + dy2, face.dir[2] + dz1 + dz2);

        if (side1 && side2) return 0.2;
        return 1.0 - (side1 + side2 + corner) * 0.25;
    };

    return [
        vertexAO(face.v[0][0], face.v[0][1], face.v[0][2]),
        vertexAO(face.v[1][0], face.v[1][1], face.v[1][2]),
        vertexAO(face.v[2][0], face.v[2][1], face.v[2][2]),
        vertexAO(face.v[3][0], face.v[3][1], face.v[3][2])
    ];
}

// ============================================
// World
// ============================================
export class World {
    constructor(scene, atlas) {
        this.scene = scene;
        this.atlas = atlas;
        this.chunks = new Map();
        this.renderDistance = 8;
        
        // Chunk queues to avoid stuttering
        this.chunksToGenerate = [];
        this.chunksToBuild = [];
        
        // Fluid tick queue
        this.liquidUpdates = new Set(); // Stores strings of "x,y,z"
        this.tickTimer = 0;
    }

    setRenderDistance(d) {
        this.renderDistance = d;
        if (this.scene.fog && this.scene.fog.isFog) {
            const blocks = d * 16;
            this.scene.fog.near = blocks * 0.75;
            this.scene.fog.far = blocks;
        }
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    getBlock(wx, wy, wz) {
        wx = Math.floor(wx); wy = Math.floor(wy); wz = Math.floor(wz);
        if (wy < 0 || wy >= CHUNK_HEIGHT) return BLOCKS.AIR;
        
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        const chunk = this.chunks.get(this.getChunkKey(cx, cz));
        if (chunk) return chunk.getBlock(lx, wy, lz);
        return BLOCKS.AIR;
    }

    setBlock(wx, wy, wz, type) {
        wx = Math.floor(wx); wy = Math.floor(wy); wz = Math.floor(wz);
        if (wy < 0 || wy >= CHUNK_HEIGHT) return;

        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        const chunk = this.getChunkAt(wx, wz);
        if (chunk) {
            chunk.setBlock(lx, wy, lz, type);
            if (!this.chunksToBuild.includes(chunk)) {
                this.chunksToBuild.push(chunk);
            }
            // Trigger neighbor fluid updates
            this.queueLiquidUpdate(wx, wy+1, wz);
            this.queueLiquidUpdate(wx, wy, wz+1);
            this.queueLiquidUpdate(wx, wy, wz-1);
            this.queueLiquidUpdate(wx+1, wy, wz);
            this.queueLiquidUpdate(wx-1, wy, wz);
            if (type === BLOCKS.WATER || type === BLOCKS.LAVA) this.queueLiquidUpdate(wx, wy, wz);
            // Check neighbors if block is on border
            if (lx === 0) this._markChunkDirty(cx - 1, cz);
            if (lx === CHUNK_SIZE - 1) this._markChunkDirty(cx + 1, cz);
            if (lz === 0) this._markChunkDirty(cx, cz - 1);
            if (lz === CHUNK_SIZE - 1) this._markChunkDirty(cx, cz + 1);
        }
    }

    _markChunkDirty(cx, cz) {
        const chunk = this.chunks.get(this.getChunkKey(cx, cz));
        if (chunk) {
            chunk.dirty = true;
            if (!this.chunksToBuild.includes(chunk)) {
                this.chunksToBuild.push(chunk);
            }
        }
    }

    getChunkAt(wx, wz) {
        const cx = Math.floor(Math.floor(wx) / CHUNK_SIZE);
        const cz = Math.floor(Math.floor(wz) / CHUNK_SIZE);
        return this.chunks.get(this.getChunkKey(cx, cz));
    }

    queueLiquidUpdate(x, y, z) {
        const t = this.getBlock(x, y, z);
        const props = getBlockProperties(t);
        if (props.isLiquid) {
            this.liquidUpdates.add(`${x},${y},${z}`);
        }
    }

    tickFluids() {
        const updates = Array.from(this.liquidUpdates);
        this.liquidUpdates.clear();
        
        for (const key of updates) {
            const [x, y, z] = key.split(',').map(Number);
            const type = this.getBlock(x, y, z);
            const props = getBlockProperties(type);
            
            if (!props.isLiquid) continue;

            const bBelow = this.getBlock(x, y-1, z);
            const belowProps = getBlockProperties(bBelow);
            
            if (bBelow === BLOCKS.AIR) {
                this.setBlock(x, y-1, z, type);
            } else if (!belowProps.isLiquid) {
                // Spread sideways if blocked below
                const sides = [
                    [1,0], [-1,0], [0,1], [0,-1]
                ];
                for (const [dx, dz] of sides) {
                    const sideBlock = this.getBlock(x+dx, y, z+dz);
                    const sideProps = getBlockProperties(sideBlock);
                    
                    if (sideBlock === BLOCKS.AIR) {
                        this.setBlock(x+dx, y, z+dz, type);
                    } else if (sideProps.isLiquid && sideBlock !== type) {
                        // Liquid mixing!
                        const isWater = type === BLOCKS.WATER || type === BLOCKS.SWAMP_WATER;
                        const isLava = type === BLOCKS.LAVA;
                        const sideIsWater = sideBlock === BLOCKS.WATER || sideBlock === BLOCKS.SWAMP_WATER;
                        const sideIsLava = sideBlock === BLOCKS.LAVA;
                        
                        if (isWater && sideIsLava) {
                            this.setBlock(x+dx, y, z+dz, BLOCKS.OBSIDIAN);
                        } else if (isLava && sideIsWater) {
                            this.setBlock(x, y, z, BLOCKS.COBBLESTONE);
                        }
                    }
                }
            } else if (belowProps.isLiquid && bBelow !== type) {
                // If water is above lava, turn lava into obsidian
                const isWater = type === BLOCKS.WATER || type === BLOCKS.SWAMP_WATER;
                if (isWater && bBelow === BLOCKS.LAVA) {
                    this.setBlock(x, y-1, z, BLOCKS.OBSIDIAN);
                }
            }
        }
    }

    update(playerPos, terrainGenerator, dt) {
        const px = Math.floor(playerPos.x / CHUNK_SIZE);
        const pz = Math.floor(playerPos.z / CHUNK_SIZE);

        const chunksToKeep = new Set();

        // Find chunks that should be loaded
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                if (x*x + z*z <= this.renderDistance*this.renderDistance) {
                    const cx = px + x;
                    const cz = pz + z;
                    const key = this.getChunkKey(cx, cz);
                    chunksToKeep.add(key);

                    if (!this.chunks.has(key)) {
                        const chunk = new Chunk(cx, cz);
                        this.chunks.set(key, chunk);
                        this.chunksToGenerate.push(chunk);
                    }
                }
            }
        }

        // Process a few chunks per frame for generating blocks
        let gensThisFrame = 0;
        this.chunksToGenerate.sort((a, b) => {
            const distA = Math.abs(a.cx - px) + Math.abs(a.cz - pz);
            const distB = Math.abs(b.cx - px) + Math.abs(b.cz - pz);
            return distB - distA;
        });

        while (this.chunksToGenerate.length > 0 && gensThisFrame < 1) {
            const chunk = this.chunksToGenerate.pop();
            // Don't generate if it was removed
            if (!this.chunks.has(this.getChunkKey(chunk.cx, chunk.cz))) continue;
            
            chunk.blocks = terrainGenerator(chunk.cx, chunk.cz);
            chunk.dirty = true;
            this.chunksToBuild.push(chunk);
            
            // Mark neighbors dirty
            const neighbors = [[-1,0], [1,0], [0,-1], [0,1]];
            for (const [dx, dz] of neighbors) {
                const nKey = this.getChunkKey(chunk.cx + dx, chunk.cz + dz);
                const nChunk = this.chunks.get(nKey);
                if (nChunk && nChunk.blocks[0] !== undefined) { // Check if neighbor is generated
                    nChunk.dirty = true;
                    if (!this.chunksToBuild.includes(nChunk)) {
                        this.chunksToBuild.push(nChunk);
                    }
                }
            }
            gensThisFrame++;
        }

        // Unload far chunks
        for (const [key, chunk] of this.chunks.entries()) {
            if (!chunksToKeep.has(key)) {
                chunk.dispose();
                this.chunks.delete(key);
                // Remove from build queues
                const index = this.chunksToBuild.indexOf(chunk);
                if (index > -1) this.chunksToBuild.splice(index, 1);
                const gIndex = this.chunksToGenerate.indexOf(chunk);
                if (gIndex > -1) this.chunksToGenerate.splice(gIndex, 1);
            }
        }

        // Process a few chunks per frame
        let buildsThisFrame = 0;
        // Prioritize chunks closer to player
        this.chunksToBuild.sort((a, b) => {
            const distA = Math.abs(a.cx - px) + Math.abs(a.cz - pz);
            const distB = Math.abs(b.cx - px) + Math.abs(b.cz - pz);
            return distB - distA; // pop from end
        });

        while (this.chunksToBuild.length > 0 && buildsThisFrame < 2) {
            const chunk = this.chunksToBuild.pop();
            if (chunk.dirty) {
                const mesh = chunk.buildMesh(this.atlas, (wx, wy, wz) => this.getBlock(wx, wy, wz));
                if (mesh && !mesh.parent) {
                    this.scene.add(mesh);
                }
                buildsThisFrame++;
            }
        }

        if (dt) {
            this.tickTimer += dt;
            if (this.tickTimer >= 0.2) { // tick every 200ms
                this.tickTimer = 0;
                this.tickFluids();
            }
        }
    }

    raycast(origin, direction, maxDist = 8) {
        // Fast voxel raycast algorithm (Amanatides & Woo)
        let t = 0;
        let ix = Math.floor(origin.x);
        let iy = Math.floor(origin.y);
        let iz = Math.floor(origin.z);

        const stepX = Math.sign(direction.x);
        const stepY = Math.sign(direction.y);
        const stepZ = Math.sign(direction.z);

        const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
        const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
        const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

        let tMaxX = stepX > 0 ? (ix + 1 - origin.x) * tDeltaX : (origin.x - ix) * tDeltaX;
        let tMaxY = stepY > 0 ? (iy + 1 - origin.y) * tDeltaY : (origin.y - iy) * tDeltaY;
        let tMaxZ = stepZ > 0 ? (iz + 1 - origin.z) * tDeltaZ : (origin.z - iz) * tDeltaZ;

        let steppedIndex = -1;

        while (t <= maxDist) {
            const blockType = this.getBlock(ix, iy, iz);
            const props = getBlockProperties(blockType);
            
            if (blockType !== BLOCKS.AIR && blockType !== BLOCKS.WATER && blockType !== BLOCKS.LAVA && (props.solid || props.isCross)) {
                const hitNormal = new THREE.Vector3(0, 0, 0);
                if (steppedIndex === 0) hitNormal.x = -stepX;
                if (steppedIndex === 1) hitNormal.y = -stepY;
                if (steppedIndex === 2) hitNormal.z = -stepZ;
                
                return {
                    hit: true,
                    position: origin.clone().add(direction.clone().multiplyScalar(t)),
                    normal: hitNormal,
                    blockPos: { x: ix, y: iy, z: iz },
                    blockType: blockType
                };
            }

            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    ix += stepX;
                    t = tMaxX;
                    tMaxX += tDeltaX;
                    steppedIndex = 0;
                } else {
                    iz += stepZ;
                    t = tMaxZ;
                    tMaxZ += tDeltaZ;
                    steppedIndex = 2;
                }
            } else {
                if (tMaxY < tMaxZ) {
                    iy += stepY;
                    t = tMaxY;
                    tMaxY += tDeltaY;
                    steppedIndex = 1;
                } else {
                    iz += stepZ;
                    t = tMaxZ;
                    tMaxZ += tDeltaZ;
                    steppedIndex = 2;
                }
            }
        }

        return { hit: false };
    }

    collide(position, velocity, entityWidth = 0.6, entityHeight = 1.8) {
        // AABB vs Voxel Grid collision
        const hw = entityWidth / 2;
        
        let targetX = position.x + velocity.x;
        let targetY = position.y + velocity.y;
        let targetZ = position.z + velocity.z;
        let grounded = false;

        // Function to check if an AABB overlaps solid blocks
        const checkCollision = (px, py, pz) => {
            const minX = Math.floor(px - hw + 0.01);
            const maxX = Math.floor(px + hw - 0.01);
            const minY = Math.floor(py);
            const maxY = Math.floor(py + entityHeight - 0.01);
            const minZ = Math.floor(pz - hw + 0.01);
            const maxZ = Math.floor(pz + hw - 0.01);

            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    for (let z = minZ; z <= maxZ; z++) {
                        const block = this.getBlock(x, y, z);
                        if (getBlockProperties(block).solid) return true;
                    }
                }
            }
            return false;
        };

        // Y-axis
        if (checkCollision(position.x, targetY, position.z)) {
            velocity.y = 0;
            if (targetY < position.y) { // Falling down
                grounded = true;
                targetY = Math.floor(targetY) + 1.0; 
            } else { // Jumping up and hitting ceiling
                targetY = Math.floor(targetY + entityHeight - 0.01) - entityHeight;
            }
        }
        
        // X-axis
        if (checkCollision(targetX, targetY, position.z)) {
            velocity.x = 0;
            targetX = position.x;
        }

        // Z-axis
        if (checkCollision(targetX, targetY, targetZ)) {
            velocity.z = 0;
            targetZ = position.z;
        }

        position.set(targetX, targetY, targetZ);
        return { position, velocity, grounded };
    }
}
