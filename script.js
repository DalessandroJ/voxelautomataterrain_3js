import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/controls/OrbitControls.js';
import { initPostProcessing } from './postProcessing.js';

// ----- Simulation Parameters and Data Structures -----

// Universe scale: K = (1 << L) + 1; for L = 6, K = 65
let L = 8;
let K = (1 << L) + 1;

//post processing guy
let composer;

// 3D state: 0 = empty; 1 2 and 3 = filled types
let state = new Array(K)
    .fill(0)
    .map(() => new Array(K).fill(0).map(() => new Array(K).fill(0)));

// Rule arrays (for cube, face, and edge rules)
// In the Processing code these are 2D arrays with different dimensions.
let cubeRule = Array.from({ length: 9 }, () => new Array(9).fill(0));
let faceRule = Array.from({ length: 7 }, () => new Array(7).fill(0));
let edgeRule = Array.from({ length: 7 }, () => new Array(7).fill(0));

// Stochastic flip probability (0.0 means deterministic)
let flipP = 0.0;

// Define multiple palettes – add more as needed.
const palettes = [
    // twilight 5:
    ["#292831", "#333f58", "#4a7a96", "#ee8695", "#fbbbad"],
    // nicole punk 82:
    ["#21181b", "#cd5f2a", "#f2ab37", "#d8ae8b", "#faf5d8"],
    // slimy 5:
    ["#0a1a2f", "#04373b", "#1a644e", "#40985e", "#d1cb95"],
    // leopolds dreams:
    ["#372134", "#474476", "#4888b7", "#6dbcb9", "#8cefb6"],
    // 5 sheep:
    ["#480a30", "#b41360", "#ff327c", "#ff80ae", "#ffdae8"],
];

// Function to randomly select and shuffle a palette
function getRandomPalette() {
    const palette = palettes[Math.floor(Math.random() * palettes.length)].slice();
    const colorsToShuffle = palette.slice(1); // all colors except the first
    shuffle(colorsToShuffle);
    return [palette[0], ...colorsToShuffle];
}

// Use a selected palette.
const palette = getRandomPalette();

// ----- Helper Functions -----

// Helper function to shuffle an array in-place (Fisher-Yates shuffle)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// A helper random function (returns value in [min, max))
function rand(min, max) {
    return Math.random() * (max - min) + min;
}

// -- Evaluation functions for the automata --

// Evaluate a cube given its corner indices and width (w)
// This function inspects the 8 corner voxels, counts how many are filled with type 1 and type 2,
// then uses the cubeRule lookup to set the center voxel.
// --- Cube Evaluation (already provided) ---
function evalCube(i, j, k, w) {
    if (i < 0 || j < 0 || k < 0 || i + w >= K || j + w >= K || k + w >= K) return;
    let idx1 = 0, idx2 = 0;
    // Sum over the 8 corners:
    for (let di of [0, w]) {
        for (let dj of [0, w]) {
            for (let dk of [0, w]) {
                if (state[i + di][j + dj][k + dk] === 1) idx1++;
                if (state[i + di][j + dj][k + dk] === 2) idx2++;
            }
        }
    }
    let newVal = cubeRule[idx1][idx2];
    if (Math.random() < flipP && newVal !== 0) {
        newVal = 3 - newVal;
    }
    state[i + Math.floor(w / 2)][j + Math.floor(w / 2)][k + Math.floor(w / 2)] = newVal;
}

// --- Face Functions ---
function f1(i, j, k, w) {
    const half = Math.floor(w / 2);
    if (i < 0 || j < 0 || (k - half) < 0 || (i + w >= K) || (j + w >= K) || (k + half >= K)) return;
    let idx1 = (state[i][j][k] === 1 ? 1 : 0) +
        (state[i + w][j][k] === 1 ? 1 : 0) +
        (state[i][j + w][k] === 1 ? 1 : 0) +
        (state[i + w][j + w][k] === 1 ? 1 : 0) +
        (state[i + half][j + half][k - half] === 1 ? 1 : 0) +
        (state[i + half][j + half][k + half] === 1 ? 1 : 0);
    let idx2 = (state[i][j][k] === 2 ? 1 : 0) +
        (state[i + w][j][k] === 2 ? 1 : 0) +
        (state[i][j + w][k] === 2 ? 1 : 0) +
        (state[i + w][j + w][k] === 2 ? 1 : 0) +
        (state[i + half][j + half][k - half] === 2 ? 1 : 0) +
        (state[i + half][j + half][k + half] === 2 ? 1 : 0);
    state[i + half][j + half][k] = faceRule[idx1][idx2];
    if (Math.random() < flipP && state[i + half][j + half][k] !== 0) {
        state[i + half][j + half][k] = 3 - state[i + half][j + half][k];
    }
}

function f2(i, j, k, w) {
    const half = Math.floor(w / 2);
    if (i < 0 || (j - half) < 0 || k < 0 || (i + w >= K) || (j + half >= K) || (k + w >= K)) return;
    let idx1 = (state[i][j][k] === 1 ? 1 : 0) +
        (state[i + w][j][k] === 1 ? 1 : 0) +
        (state[i][j][k + w] === 1 ? 1 : 0) +
        (state[i + w][j][k + w] === 1 ? 1 : 0) +
        (state[i + half][j - half][k + half] === 1 ? 1 : 0) +
        (state[i + half][j + half][k + half] === 1 ? 1 : 0);
    let idx2 = (state[i][j][k] === 2 ? 1 : 0) +
        (state[i + w][j][k] === 2 ? 1 : 0) +
        (state[i][j][k + w] === 2 ? 1 : 0) +
        (state[i + w][j][k + w] === 2 ? 1 : 0) +
        (state[i + half][j - half][k + half] === 2 ? 1 : 0) +
        (state[i + half][j + half][k + half] === 2 ? 1 : 0);
    state[i + half][j][k + half] = faceRule[idx1][idx2];
    if (Math.random() < flipP && state[i + half][j][k + half] !== 0) {
        state[i + half][j][k + half] = 3 - state[i + half][j][k + half];
    }
}

function f3(i, j, k, w) {
    const half = Math.floor(w / 2);
    if ((i - half) < 0 || j < 0 || k < 0 || (i + half >= K) || (j + w >= K) || (k + w >= K)) return;
    let idx1 = (state[i][j][k] === 1 ? 1 : 0) +
        (state[i][j][k + w] === 1 ? 1 : 0) +
        (state[i][j + w][k] === 1 ? 1 : 0) +
        (state[i][j + w][k + w] === 1 ? 1 : 0) +
        (state[i - half][j + half][k + half] === 1 ? 1 : 0) +
        (state[i + half][j + half][k + half] === 1 ? 1 : 0);
    let idx2 = (state[i][j][k] === 2 ? 1 : 0) +
        (state[i][j][k + w] === 2 ? 1 : 0) +
        (state[i][j + w][k] === 2 ? 1 : 0) +
        (state[i][j + w][k + w] === 2 ? 1 : 0) +
        (state[i - half][j + half][k + half] === 2 ? 1 : 0) +
        (state[i + half][j + half][k + half] === 2 ? 1 : 0);
    state[i][j + half][k + half] = faceRule[idx1][idx2];
    if (Math.random() < flipP && state[i][j + half][k + half] !== 0) {
        state[i][j + half][k + half] = 3 - state[i][j + half][k + half];
    }
}

// f4, f5, f6 simply reuse f1 with shifted indices.
function f4(i, j, k, w) {
    f1(i, j, k + w, w);
}

function f5(i, j, k, w) {
    f1(i, j + w, k, w);
}

function f6(i, j, k, w) {
    f1(i + w, j, k, w);
}

// Bundle face evaluations.
function evalFaces(i, j, k, w) {
    f1(i, j, k, w);
    f2(i, j, k, w);
    f3(i, j, k, w);
    f4(i, j, k, w);
    f5(i, j, k, w);
    f6(i, j, k, w);
}

// --- Edge Functions ---
function e1(i, j, k, w) {
    const half = Math.floor(w / 2);
    if (i < 0 || (j - half) < 0 || (k - half) < 0 || (i + w >= K) || (j + half >= K) || (k + half >= K)) return;
    let idx1 = (state[i][j][k] === 1 ? 1 : 0) +
        (state[i + w][j][k] === 1 ? 1 : 0) +
        (state[i + half][j - half][k] === 1 ? 1 : 0) +
        (state[i + half][j + half][k] === 1 ? 1 : 0) +
        (state[i + half][j][k + half] === 1 ? 1 : 0) +
        (state[i + half][j][k - half] === 1 ? 1 : 0);
    let idx2 = (state[i][j][k] === 2 ? 1 : 0) +
        (state[i + w][j][k] === 2 ? 1 : 0) +
        (state[i + half][j - half][k] === 2 ? 1 : 0) +
        (state[i + half][j + half][k] === 2 ? 1 : 0) +
        (state[i + half][j][k + half] === 2 ? 1 : 0) +
        (state[i + half][j][k - half] === 2 ? 1 : 0);
    state[i + half][j][k] = edgeRule[idx1][idx2];
    if (Math.random() < flipP && state[i + half][j][k] !== 0) {
        state[i + half][j][k] = 3 - state[i + half][j][k];
    }
}

function e2(i, j, k, w) {
    e1(i, j + w, k, w);
}

function e3(i, j, k, w) {
    e1(i, j, k + w, w);
}

function e4(i, j, k, w) {
    e1(i, j + w, k + w, w);
}

function e5(i, j, k, w) {
    const half = Math.floor(w / 2);
    e1(i - half, j + half, k, w);
}

function e6(i, j, k, w) {
    const half = Math.floor(w / 2);
    e1(i + half, j + half, k, w);
}

function e7(i, j, k, w) {
    const half = Math.floor(w / 2);
    e1(i - half, j + half, k + w, w);
}

function e8(i, j, k, w) {
    const half = Math.floor(w / 2);
    e1(i + half, j + half, k + w, w);
}

// Bundle edge evaluations.
function evalEdges(i, j, k, w) {
    e1(i, j, k, w);
    e2(i, j, k, w);
    e3(i, j, k, w);
    e4(i, j, k, w);
    e5(i, j, k, w);
    e6(i, j, k, w);
    e7(i, j, k, w);
    e8(i, j, k, w);
}

function evalState() {
    // Iterate over scales from largest block (w = K-1) down to 2, halving each time
    for (let w = K - 1; w >= 2; w = Math.floor(w / 2)) {
        for (let i = 0; i < K - 1; i += w) {
            for (let j = 0; j < K - 1; j += w) {
                for (let k = 0; k < K - 1; k += w) {
                    evalCube(i, j, k, w);
                    evalFaces(i, j, k, w);
                    evalEdges(i, j, k, w);
                }
            }
        }
    }
}


// Initialize state by filling only the bottom layer with random bits
function initState() {
    for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
            // For example, assign either type 1 or type 2 at random on the bottom (k = K-1)
            state[i][j][K - 1] = Math.floor(rand(1, 4)); // gives 1 to 3
        }
    }
}

// Set up random rules (here we simply fill the rule arrays with nonzero entries with a given probability)
function initRules(lambda = 0.35) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9 - i; j++) {
            cubeRule[i][j] = (Math.random() < lambda) ? Math.floor(rand(1, 4)) : 0;
        }
    }
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7 - i; j++) {
            faceRule[i][j] = (Math.random() < lambda) ? Math.floor(rand(1, 4)) : 0;
            edgeRule[i][j] = (Math.random() < lambda) ? Math.floor(rand(1, 4)) : 0;
        }
    }
}


// ----- Three.js Scene Setup -----

let scene, camera, renderer, controls;
let voxelMesh;

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(palette[0]);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Compute the center of the voxel grid.
    const center = new THREE.Vector3(K / 2, K / 2, K / 2);

    // Create an isometric offset.
    const offset = new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(K * 1.6);
    camera.position.copy(center).add(offset);

    // Point the camera toward the center of the grid.
    camera.lookAt(center);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Enable shadows in the renderer.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.update();

    // Optional ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    // Create a directional light with stronger intensity.
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(K * 1.5, K * 2, -K * 1.5);
    dirLight.castShadow = true;

    // Configure shadow camera for the directional light.
    const d = K * 1.5; // Reduced from K * 3 to tighter fit the grid
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = K * 5; // Reduced from K * 6
    dirLight.shadow.mapSize.width = 2048; // Reduced from 4096
    dirLight.shadow.mapSize.height = 2048; // Reduced from 4096

    // Set the light's target to the center of the grid.
    dirLight.target.position.copy(center);
    scene.add(dirLight.target);
    scene.add(dirLight);

    // Add a point light near the camera.
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.castShadow = false;
    camera.add(pointLight);
    scene.add(camera);

    const groundGeometry = new THREE.PlaneGeometry(K * 3, K * 3);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette[1]) });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.x += K / 2;
    ground.position.z += K / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    renderer.shadowMap.needsUpdate = true;
}



// Create an InstancedMesh for all nonempty voxels
function createVoxelMeshes() {
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

    // Count total non-empty voxels
    let totalCount = 0;
    for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
            for (let k = 0; k < K; k++) {
                if (state[i][j][k] !== 0) totalCount++;
            }
        }
    }
    console.log("Total voxel count:", totalCount);

    // Create per-instance color attribute
    const colors = new Float32Array(totalCount * 3); // RGB for each instance

    // Use MeshStandardMaterial and extend it for instance colors
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Base color (will be modulated by instance color)
        //specular: 0x111111,
        //shininess: 30
    });

    // Modify the material's shaders to use instance colors
    material.onBeforeCompile = (shader) => {
        // Inject instanceColor attribute into vertex shader
        shader.vertexShader = `
            attribute vec3 instanceColor;
            varying vec3 vInstanceColor;
            ${shader.vertexShader}
        `.replace(
            `#include <color_vertex>`,
            `#include <color_vertex>
             vInstanceColor = instanceColor;`
        );

        // Pass instance color to fragment shader and use it
        shader.fragmentShader = `
            varying vec3 vInstanceColor;
            ${shader.fragmentShader}
        `.replace(
            `#include <color_fragment>`,
            `#include <color_fragment>
             diffuseColor.rgb *= vInstanceColor;`
        );
    };

    // Create single InstancedMesh
    const mesh = new THREE.InstancedMesh(cubeGeometry, material, totalCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Depth material for shadows
    const depthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
    });
    depthMaterial.defines = { USE_INSTANCING: '' };
    mesh.customDepthMaterial = depthMaterial;

    // Populate positions and colors
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
            for (let k = 0; k < K; k++) {
                if (state[i][j][k] !== 0) {
                    // Set position
                    dummy.position.set(i, K - 1 - k, j);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(index, dummy.matrix);

                    // Set color based on state
                    let color;
                    if (state[i][j][k] === 1) color = new THREE.Color(palette[2]);
                    else if (state[i][j][k] === 2) color = new THREE.Color(palette[3]);
                    else if (state[i][j][k] === 3) color = new THREE.Color(palette[4]);
                    colors[index * 3] = color.r;
                    colors[index * 3 + 1] = color.g;
                    colors[index * 3 + 2] = color.b;
                    index++;
                }
            }
        }
    }

    // Attach color attribute to geometry
    cubeGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));

    // Flag instance matrix for update
    mesh.instanceMatrix.needsUpdate = true;

    // Return the single mesh
    return mesh;
}



// Define render function
function render() {
    composer.render();
}

// Modified animate function to tie rendering directly to controls updates
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (controls.hasChanged) { // Custom flag to check if controls need rendering
        render();
    }
}

// Initialization Sequence
function init() {
    initRules(0.35);
    initState();
    evalState();
    initThree();
    voxelMesh = createVoxelMeshes();
    scene.add(voxelMesh);
    composer = initPostProcessing(renderer, scene, camera, L);

    // Add a custom flag to track control changes
    controls.hasChanged = false;
    controls.addEventListener('start', () => {
        controls.hasChanged = true;
    });
    controls.addEventListener('change', () => {
        controls.hasChanged = true;
    });
    controls.addEventListener('end', () => {
        controls.hasChanged = false;
        render(); // Ensure one final render when movement stops
    });

    // Start animation loop
    animate();

    // Initial render
    render();
}

init();