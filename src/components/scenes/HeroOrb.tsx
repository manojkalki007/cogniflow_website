"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  // Simplex-like noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vNormal = normal;
    vPosition = position;

    float noise1 = snoise(position * 0.8 + uTime * 0.3) * 0.15;
    float noise2 = snoise(position * 1.6 + uTime * 0.5) * 0.08;
    float displacement = noise1 + noise2;
    vDisplacement = displacement;

    vec3 newPos = position + normal * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;

  void main() {
    vec3 silver = vec3(0.78, 0.78, 0.80);
    vec3 lime = vec3(0.784, 1.0, 0.0);

    // Noise-based color mixing for organic lime patches
    float patchNoise = sin(vPosition.x * 2.0 + uTime * 0.4) *
                       cos(vPosition.y * 2.5 + uTime * 0.3) *
                       sin(vPosition.z * 1.8 + uTime * 0.5);
    float patchMask = smoothstep(0.1, 0.5, patchNoise);

    vec3 baseColor = mix(silver, lime, patchMask * 0.7);

    // Fresnel for edge glow
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
    baseColor += lime * fresnel * 0.4;

    // Simple lighting
    vec3 lightDir = normalize(vec3(1.0, 1.0, 2.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 64.0);

    vec3 finalColor = baseColor * (0.3 + diffuse * 0.7) + vec3(1.0) * specular * 0.6;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export default function HeroOrb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;

    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.1;

      // Mouse interaction — tilt toward cursor
      const mouse = state.pointer;
      meshRef.current.rotation.x = mouse.y * 0.15;
      meshRef.current.rotation.z = -mouse.x * 0.1;
    }

    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.2;
    if (ring2Ref.current) ring2Ref.current.rotation.x = t * 0.15;
    if (ring3Ref.current) ring3Ref.current.rotation.y = t * 0.25;
  });

  return (
    <group>
      {/* Main orb */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[2.2, 48]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      {/* Orbital rings */}
      <mesh ref={ring1Ref} rotation={[0.3, 0, 0.5]}>
        <torusGeometry args={[3.2, 0.015, 16, 128]} />
        <meshBasicMaterial color="#C8FF00" transparent opacity={0.25} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[1.2, 0.8, 0]}>
        <torusGeometry args={[3.0, 0.012, 16, 128]} />
        <meshBasicMaterial color="#C8FF00" transparent opacity={0.15} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[0.6, 1.5, 0.3]}>
        <torusGeometry args={[3.5, 0.01, 16, 128]} />
        <meshBasicMaterial color="#C8FF00" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}
