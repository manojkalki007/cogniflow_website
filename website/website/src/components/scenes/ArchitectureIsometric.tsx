"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const MODULES = [
  { name: "COGNIFLOW", pos: [0, 0.5, 0] as [number, number, number], size: [2, 1, 2] as [number, number, number], isHub: true },
  { name: "TELEPHONY", pos: [-4, 0.3, 0] as [number, number, number], size: [1.4, 0.6, 1.4] as [number, number, number], isHub: false },
  { name: "INTELLIGENCE", pos: [0, 0.3, -4] as [number, number, number], size: [1.4, 0.6, 1.4] as [number, number, number], isHub: false },
  { name: "CRM & TOOLS", pos: [4, 0.3, 0] as [number, number, number], size: [1.4, 0.6, 1.4] as [number, number, number], isHub: false },
  { name: "KNOWLEDGE", pos: [-3, 0.3, 3] as [number, number, number], size: [1.4, 0.6, 1.4] as [number, number, number], isHub: false },
  { name: "ANALYTICS", pos: [3, 0.3, 3] as [number, number, number], size: [1.4, 0.6, 1.4] as [number, number, number], isHub: false },
];

function ModuleBlock({
  name,
  position,
  size,
  isHub,
  index,
  time,
  sceneProgress,
}: {
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  isHub: boolean;
  index: number;
  time: number;
  sceneProgress: number;
}) {
  const nodeProgress = Math.max(0, Math.min(1, (sceneProgress - index * 0.1) / 0.25));
  const pulsePhase = (time * 0.6 + index * 1.2) % (Math.PI * 2);
  const pulse = isHub ? Math.max(0, Math.sin(pulsePhase)) * 0.15 : 0;

  return (
    <group position={position} scale={nodeProgress}>
      {/* Module body */}
      <RoundedBox args={size} radius={0.05}>
        <meshStandardMaterial
          color={isHub ? "#1a1a2e" : "#151520"}
          emissive="#C8FF00"
          emissiveIntensity={isHub ? 0.1 + pulse : 0.03}
          metalness={0.4}
          roughness={0.5}
        />
      </RoundedBox>

      {/* Top platform glow */}
      <mesh position={[0, size[1] / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0] * 0.9, size[2] * 0.9]} />
        <meshBasicMaterial
          color="#C8FF00"
          transparent
          opacity={isHub ? 0.12 + pulse * 0.15 : 0.06}
        />
      </mesh>

      {/* Edge wireframe */}
      <RoundedBox args={[size[0] + 0.02, size[1] + 0.02, size[2] + 0.02]} radius={0.05}>
        <meshBasicMaterial
          color="#C8FF00"
          wireframe
          transparent
          opacity={0.08}
        />
      </RoundedBox>

      {/* Small UI detail on top */}
      {!isHub && (
        <RoundedBox args={[size[0] * 0.5, 0.08, size[2] * 0.3]} radius={0.02} position={[0, size[1] / 2 + 0.06, 0]}>
          <meshBasicMaterial color="#222238" transparent opacity={0.8} />
        </RoundedBox>
      )}

      {/* Label */}
      <Billboard position={[0, size[1] / 2 + 0.6, 0]}>
        <Text fontSize={isHub ? 0.22 : 0.15} anchorX="center">
          {name}
          <meshBasicMaterial color={isHub ? "#C8FF00" : "#ffffff"} />
        </Text>
      </Billboard>
    </group>
  );
}

const PIPE_PARTICLE_COUNT = 15;

function DataPipe({
  from,
  to,
  index,
  sceneProgress,
}: {
  from: [number, number, number];
  to: [number, number, number];
  index: number;
  sceneProgress: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);
  const pipeProgress = Math.max(0, Math.min(1, (sceneProgress - 0.4 - index * 0.05) / 0.2));

  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + 0.8,
      (from[2] + to[2]) / 2
    );
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...from),
      mid,
      new THREE.Vector3(...to)
    );
  }, [from, to]);

  const tubeGeo = useMemo(() => {
    return new THREE.TubeGeometry(curve, 20, 0.025, 8, false);
  }, [curve]);

  const particlePositions = useMemo(() => {
    return new Float32Array(PIPE_PARTICLE_COUNT * 3);
  }, []);

  useFrame((state) => {
    if (!particlesRef.current || pipeProgress < 0.5) return;
    const t = state.clock.elapsedTime;
    const arr = particlesRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < PIPE_PARTICLE_COUNT; i++) {
      const pt = curve.getPointAt(((i / PIPE_PARTICLE_COUNT + t * 0.3) % 1));
      arr[i * 3] = pt.x;
      arr[i * 3 + 1] = pt.y;
      arr[i * 3 + 2] = pt.z;
    }
    (particlesRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <group>
      {/* Pipe */}
      <mesh geometry={tubeGeo}>
        <meshBasicMaterial
          color="#333350"
          transparent
          opacity={pipeProgress * 0.4}
        />
      </mesh>

      {/* Lime stripe on pipe */}
      <mesh geometry={tubeGeo} scale={1.02}>
        <meshBasicMaterial
          color="#C8FF00"
          transparent
          opacity={pipeProgress * 0.08}
          wireframe
        />
      </mesh>

      {/* Data particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          color="#C8FF00"
          transparent
          opacity={pipeProgress > 0.5 ? 0.9 : 0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

export default function ArchitectureIsometric({ progress }: { progress: number }) {
  const visible = progress > 0.5 && progress < 0.75;
  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.52) / 0.18));
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  if (!visible) return null;

  return (
    <group rotation={[0.3, 0, 0]}>
      {/* Floor grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[16, 16, 16, 16]} />
        <meshBasicMaterial
          color="#C8FF00"
          wireframe
          transparent
          opacity={sceneProgress * 0.04}
        />
      </mesh>

      {/* Modules */}
      {MODULES.map((m, i) => (
        <ModuleBlock
          key={m.name}
          name={m.name}
          position={m.pos}
          size={m.size}
          isHub={m.isHub}
          index={i}
          time={timeRef.current}
          sceneProgress={sceneProgress}
        />
      ))}

      {/* Pipes from each module to hub */}
      {MODULES.slice(1).map((m, i) => (
        <DataPipe
          key={`pipe-${i}`}
          from={m.pos}
          to={MODULES[0].pos}
          index={i}
          sceneProgress={sceneProgress}
        />
      ))}
    </group>
  );
}
