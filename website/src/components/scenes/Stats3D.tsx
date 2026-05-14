"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Float } from "@react-three/drei";
import * as THREE from "three";

const STATS = [
  { value: "<500ms", label: "Response Latency", pos: [-4, 1.5, 0] as [number, number, number], depth: 0 },
  { value: "30+", label: "Languages Supported", pos: [3, 2, -2] as [number, number, number], depth: -2 },
  { value: "99.9%", label: "Uptime", pos: [-2, -1, 1] as [number, number, number], depth: 1 },
  { value: "10x", label: "Cost Reduction", pos: [4, -0.5, -1] as [number, number, number], depth: -1 },
];

function StatNumber({
  value,
  label,
  position,
  index,
  sceneProgress,
}: {
  value: string;
  label: string;
  position: [number, number, number];
  index: number;
  sceneProgress: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const entryProgress = Math.max(0, Math.min(1, (sceneProgress - index * 0.1) / 0.25));
  const scale = entryProgress;

  return (
    <Float speed={1.2} rotationIntensity={0.03} floatIntensity={0.1}>
      <group ref={groupRef} position={position} scale={scale}>
        {/* Main stat number */}
        <Text
          fontSize={1.2}
          letterSpacing={-0.02}
          anchorX="center"
          anchorY="middle"
        >
          {value}
          <meshStandardMaterial
            color="#C8FF00"
            emissive="#C8FF00"
            emissiveIntensity={0.3}
            metalness={0.8}
            roughness={0.2}
          />
        </Text>

        {/* Label below */}
        <Text
          fontSize={0.15}
          anchorX="center"
          anchorY="top"
          position={[0, -0.8, 0]}
          maxWidth={3}
        >
          {label}
          <meshBasicMaterial color="#888888" transparent opacity={0.7} />
        </Text>
      </group>
    </Float>
  );
}

function BackgroundParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 100;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#C8FF00"
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function Stats3D({ progress }: { progress: number }) {
  const visible = progress > 0.65 && progress < 0.88;
  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.68) / 0.15));

  if (!visible) return null;

  return (
    <group>
      {STATS.map((stat, i) => (
        <StatNumber
          key={stat.value}
          value={stat.value}
          label={stat.label}
          position={stat.pos}
          index={i}
          sceneProgress={sceneProgress}
        />
      ))}
      <BackgroundParticles />
    </group>
  );
}
