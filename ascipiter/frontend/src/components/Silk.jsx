/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useRef, useMemo, useLayoutEffect } from 'react';
import { Color } from 'three';

const vertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  // --- CORRECTED LOGIC ---
  // 1. Create a smooth base gradient from top to bottom.
  vec3 baseGradient = mix(uColor1, uColor2, vUv.y);

  // 2. Modulate the brightness of that gradient using the animated pattern.
  vec3 finalColor = baseGradient * pattern;
  
  // 3. Apply noise for texture.
  vec4 col = vec4(finalColor, 1.0) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
}
`;

const SilkPlane = forwardRef(function SilkPlane({ uniforms }, ref) {
  const { viewport } = useThree();

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.scale.set(viewport.width, viewport.height, 1);
    }
  }, [ref, viewport]);

  useFrame((_, delta) => {
    ref.current.material.uniforms.uTime.value += 0.1 * delta;
  });

  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  );
});
SilkPlane.displayName = 'SilkPlane';

const Silk = ({ speed = 5, scale = 1, color1 = '#7B7481', color2 = '#ADD8E6', noiseIntensity = 1.5, rotation = 0 }) => {
  const meshRef = useRef();

  const uniforms = useMemo(
    () => ({
      uSpeed: { value: speed },
      uScale: { value: scale },
      uNoiseIntensity: { value: noiseIntensity },
      uColor1: { value: new Color(color1) },
      uColor2: { value: new Color(color2) },
      uRotation: { value: rotation },
      uTime: { value: 0 }
    }),
    // We only want this to run once on initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // This effect hook will run ONLY when the color props change
  useLayoutEffect(() => {
    if (meshRef.current) {
      // Imperatively update the shader's color uniforms
      meshRef.current.material.uniforms.uColor1.value.set(color1);
      meshRef.current.material.uniforms.uColor2.value.set(color2);
    }
  }, [color1, color2]);

  return (
    <Canvas
      dpr={[1, 1.5]} // Cap DPR to 1.5 to save memory on high-density screens
      frameloop="always"
      // Optimize WebGL context creation
      gl={{
        preserveDrawingBuffer: true, // Needed for html2canvas
        antialias: false, // Disable antialias for performance (shader is smooth anyway)
        stencil: false,   // No stencil buffer needed
        depth: false,     // No depth buffer needed for a 2D plane
        powerPreference: "high-performance" // Hint to use discrete GPU
      }}
    >
      <SilkPlane ref={meshRef} uniforms={uniforms} />
    </Canvas>
  );
};

export default Silk;