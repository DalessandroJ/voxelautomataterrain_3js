// chromaticAberrationShader.js
import * as THREE from 'three';

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.005 }, // Overall intensity
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Compute offset from center (0.5, 0.5)
      vec2 offsetFromCenter = uv - 0.5;

      // Determine the distance (0.0 at center, ~0.707 at corners)
      float dist = length(offsetFromCenter);

      // Remap dist to a smooth gradient (0 in center to 1 at corners)
      float vignette = smoothstep(0.0, 0.5, dist);

      // Scale the chromatic aberration by vignette amount
      vec2 offset = normalize(offsetFromCenter) * strength * vignette;

      // Offset channels separately
      float r = texture2D(tDiffuse, uv + offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - offset).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

export { ChromaticAberrationShader };
