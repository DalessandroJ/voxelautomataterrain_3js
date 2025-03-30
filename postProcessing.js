// postProcessing.js
import * as THREE from 'three';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/shaders/FXAAShader.js';
import { AfterimagePass } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/AfterimagePass.js';
import { BokehPass } from 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/postprocessing/BokehPass.js';
import { ChromaticAberrationShader } from './chromaticAberrationShader.js';

export function initPostProcessing(renderer, scene, camera, L) {
    const composer = new EffectComposer(renderer);

    // RenderPass: renders the scene normally.
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // UnrealBloomPass: adds a bloom effect.
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.25, 0.1, 0.95 //strength, radius, threshold
    );
    bloomPass.renderToScreen = false;
    composer.addPass(bloomPass);

    // AfterimagePass parameter controls strength (0 = none, 1 = infinite blur)
    //const afterimagePass = new AfterimagePass(0.5);
    //afterimagePass.renderToScreen = false;
    //composer.addPass(afterimagePass);

    // Example intensity (adjust as desired)
    const chromaticPass = new ShaderPass(ChromaticAberrationShader);
    // Control overall intensity (try values between 0.002 - 0.02)
    chromaticPass.uniforms.strength.value = 0.002;
    chromaticPass.renderToScreen = false;
    composer.addPass(chromaticPass);

    // ShaderPass with FXAA: applies anti-aliasing.
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    fxaaPass.renderToScreen = false;
    composer.addPass(fxaaPass);

    // BokehPass parameters:
    const bokehParams = {
        focus: 15 * L * L - 165 * L + 470,     // distance to focus point
        
        aperture: 0.000015, // controls blur strength (smaller = less blur)
        maxblur: 0.01,   // max blur amount
    };
    console.log(bokehParams.focus);
    // Set aspect ratio:
    const aspect = window.innerWidth / window.innerHeight;
    // Create the BokehPass
    const bokehPass = new BokehPass(scene, camera, bokehParams);
    bokehPass.renderToScreen = true;
    composer.addPass(bokehPass);


    return composer;
}
