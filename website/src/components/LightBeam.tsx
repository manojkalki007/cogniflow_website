"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float cx = abs(vUv.x - 0.5) * 2.0;
    float bottomness = 1.0 - vUv.y;

    float fan = 1.0 + pow(max(bottomness - 0.6, 0.0) * 2.5, 2.0) * 3.0;
    float vFade = smoothstep(0.0, 0.25, bottomness) * (0.15 + 0.85 * pow(bottomness, 0.4));

    float core = exp(-cx * cx / (0.00015 * fan)) * 1.0;
    vec3 coreColor = vec3(0.9, 0.93, 1.0);

    float inner = exp(-cx * cx / (0.0015 * fan)) * 0.55;
    vec3 innerColor = vec3(0.55, 0.65, 1.0);

    float mid = exp(-cx * cx / (0.01 * fan)) * 0.22;
    vec3 midColor = vec3(0.3, 0.35, 0.9);

    float outer = exp(-cx * cx / (0.06 * fan)) * 0.14;
    vec3 outerColor = vec3(0.18, 0.2, 0.65);

    float atmo = exp(-cx * cx / (0.2 * fan)) * 0.07;
    vec3 atmoColor = vec3(0.12, 0.1, 0.45);

    float mist = exp(-cx * cx / (0.5 * fan)) * 0.025;
    vec3 mistColor = vec3(0.1, 0.08, 0.35);

    vec3 color = coreColor * core
               + innerColor * inner
               + midColor * mid
               + outerColor * outer
               + atmoColor * atmo
               + mistColor * mist;
    float total = core + inner + mid + outer + atmo + mist;
    float alpha = total * vFade;

    float breathe = 0.88 + 0.12 * sin(uTime * 0.5);
    float coreBreathe = 0.85 + 0.15 * sin(uTime * 0.8);
    alpha *= breathe;
    color *= mix(1.0, coreBreathe, core / max(total, 0.001));

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

function VolumetricBeam() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 } }),
    []
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh>
      <planeGeometry args={[16, 14]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={beamVertex}
        fragmentShader={beamFragment}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function BaseFlare() {
  const ref = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 128, 0, 256, 128, 256);
    g.addColorStop(0, "rgba(210,225,255,1)");
    g.addColorStop(0.08, "rgba(180,200,255,0.85)");
    g.addColorStop(0.2, "rgba(140,165,255,0.5)");
    g.addColorStop(0.4, "rgba(100,120,255,0.15)");
    g.addColorStop(0.65, "rgba(60,70,200,0.04)");
    g.addColorStop(1, "rgba(30,40,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + Math.sin(t * 0.6) * 0.12;
      ref.current.scale.x = 1 + Math.sin(t * 0.4) * 0.04;
    }
  });

  return (
    <mesh ref={ref} position={[0, -6.5, 0.01]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[12, 4]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function BeamParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 250;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel: number[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 2) * 2.0;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = Math.sin(angle) * radius * 0.2;
      vel.push(-0.003 - Math.random() * 0.007);
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame(() => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += velocities[i];
      if (pos[i * 3 + 1] < -7) pos[i * 3 + 1] = 7;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          args={[positions, 3]}
          attach="attributes-position"
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#b0c8ff"
        transparent
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function GodRays() {
  const groupRef = useRef<THREE.Group>(null);

  const rayTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, "rgba(80,100,200,0)");
    g.addColorStop(0.35, "rgba(80,100,200,0.3)");
    g.addColorStop(0.5, "rgba(100,120,220,0.5)");
    g.addColorStop(0.65, "rgba(80,100,200,0.3)");
    g.addColorStop(1, "rgba(80,100,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 512);

    const vg = ctx.createLinearGradient(0, 0, 0, 512);
    vg.addColorStop(0, "rgba(0,0,0,0.8)");
    vg.addColorStop(0.3, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 64, 512);

    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.z += 0.00015;
    }
  });

  const rays = [
    { rotZ: 0.04, opacity: 0.03, width: 0.35 },
    { rotZ: -0.03, opacity: 0.025, width: 0.28 },
    { rotZ: 0.065, opacity: 0.015, width: 0.2 },
  ];

  return (
    <group ref={groupRef}>
      {rays.map((ray, i) => (
        <mesh key={i} rotation={[0, 0, ray.rotZ]}>
          <planeGeometry args={[ray.width, 14]} />
          <meshBasicMaterial
            map={rayTexture}
            transparent
            opacity={ray.opacity}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function BeamScene() {
  return (
    <group position={[0, 0.5, 0]}>
      <VolumetricBeam />
      <GodRays />
      <BaseFlare />
      <BeamParticles />
    </group>
  );
}

export default function LightBeam() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "100%",
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45 }}
        gl={{ alpha: true, premultipliedAlpha: false, antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={{ background: "transparent" }}
      >
        <BeamScene />
      </Canvas>
    </div>
  );
}
