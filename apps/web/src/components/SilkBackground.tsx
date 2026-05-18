import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, ShaderMaterial } from 'three';

// Mihrab-toned animated silk. Renders a single fragment-shader plane sized to
// the canvas; cheap (one draw call) and decorative.
//
// DESIGN-SYSTEM.md §5 — only mounted on entry-point routes (login, signup, /).
// App-shell pages stay flat mihrab.9.

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uBase;
  uniform vec3 uHighlight;

  // 2D simplex-ish noise — quick + good enough for silk shimmer.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.04;

    // Layered diagonal waves give the silk its drape.
    float wave =
      sin((uv.x + uv.y) * 6.0 + t * 1.7) * 0.5 +
      sin((uv.x - uv.y) * 4.0 - t * 1.1) * 0.5;
    float n = noise(uv * 3.0 + t);

    float shimmer = smoothstep(0.45, 0.95, 0.5 + wave * 0.25 + n * 0.25);

    // Vignette toward the corners so the cream card pops in the center.
    float r = distance(uv, vec2(0.5));
    float vignette = smoothstep(0.85, 0.2, r);

    vec3 col = mix(uBase, uHighlight, shimmer * 0.6 * vignette);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function SilkPlane() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBase: { value: new Color('#15351E') },       // mihrab.9
      uHighlight: { value: new Color('#3d6b4c') }, // sage.7
    }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) {
      (matRef.current.uniforms.uTime as { value: number }).value =
        state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export function SilkBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
      >
        <SilkPlane />
      </Canvas>
    </div>
  );
}
