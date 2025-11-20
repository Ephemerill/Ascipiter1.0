/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
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

// --- Component to handle Event Listener Cleanup ---
const ContextLifecycle = ({ onContextLost }) => {
  const { gl } = useThree();

  useEffect(() => {
    const handleContextLost = (event) => {
      event.preventDefault();
      if (onContextLost) onContextLost(event);
    };

    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', handleContextLost, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
    };
  }, [gl, onContextLost]);

  return null;
};

// --- FIXED ManualDispose ---
// Safely checks for the extension before trying to use it.
const ManualDispose = () => {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      try {
        // We only attempt to lose context if the extension is explicitly supported
        // by the current browser/GPU context.
        const context = gl.getContext();
        if (context) {
          const ext = context.getExtension('WEBGL_lose_context');
          if (ext) {
            ext.loseContext();
          }
        }
      } catch (e) {
        // Silently fail if context access fails during unmount
      }

      // Always dispose the renderer to free CPU resources
      if (gl && typeof gl.dispose === 'function') {
        gl.dispose();
      }
    };
  }, [gl]);
  return null;
};

const Silk = ({ speed = 5, scale = 1, color1 = '#7B7481', color2 = '#ADD8E6', noiseIntensity = 1.5, rotation = 0, onContextLost }) => {
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
    []
  );

  useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uColor1.value.set(color1);
      meshRef.current.material.uniforms.uColor2.value.set(color2);
    }
  }, [color1, color2]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{
        preserveDrawingBuffer: true,
        antialias: false,
        stencil: false,
        depth: false,
        powerPreference: "high-performance"
      }}
    >
      <ContextLifecycle onContextLost={onContextLost} />
      <ManualDispose />
      <SilkPlane ref={meshRef} uniforms={uniforms} />
    </Canvas>
  );
};

export default Silk;