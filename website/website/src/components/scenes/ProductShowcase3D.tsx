"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

function SatelliteCard({
  position,
  rotation,
  delay,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  delay: number;
}) {
  return (
    <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.3} floatingRange={[-0.1, 0.1]}>
      <group position={position} rotation={rotation}>
        <RoundedBox args={[1.2, 0.8, 0.02]} radius={0.04}>
          <meshPhysicalMaterial
            color="#1a1a2e"
            transparent
            opacity={0.6}
            roughness={0.1}
            metalness={0.2}
            transmission={0.4}
          />
        </RoundedBox>
        {/* Lime border glow */}
        <RoundedBox args={[1.22, 0.82, 0.005]} radius={0.04} position={[0, 0, -0.01]}>
          <meshBasicMaterial color="#C8FF00" transparent opacity={0.15} />
        </RoundedBox>
      </group>
    </Float>
  );
}

export default function ProductShowcase3D({
  progress,
}: {
  progress: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const visible = progress > 0.08 && progress < 0.35;

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
  });

  if (!visible) return null;

  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.1) / 0.15));
  const scale = 0.8 + sceneProgress * 0.2;

  return (
    <group ref={groupRef} scale={scale}>
      {/* Main dashboard plane */}
      <Float speed={1} rotationIntensity={0.05} floatIntensity={0.2}>
        <group rotation={[-0.17, 0.09, 0]}>
          <RoundedBox args={[4, 2.5, 0.03]} radius={0.08}>
            <meshPhysicalMaterial
              color="#0f0f1a"
              transparent
              opacity={0.7}
              roughness={0.1}
              metalness={0.3}
              transmission={0.3}
            />
          </RoundedBox>
          {/* Screen content simulation */}
          <RoundedBox args={[3.6, 2.1, 0.01]} radius={0.06} position={[0, 0, 0.02]}>
            <meshBasicMaterial color="#111128" transparent opacity={0.9} />
          </RoundedBox>
          {/* Edge glow */}
          <RoundedBox args={[4.04, 2.54, 0.005]} radius={0.08} position={[0, 0, -0.02]}>
            <meshBasicMaterial color="#C8FF00" transparent opacity={0.08} />
          </RoundedBox>
        </group>
      </Float>

      {/* Satellite cards */}
      <SatelliteCard position={[-2.8, 0.8, 0.5]} rotation={[0, 0.2, 0.05]} delay={0} />
      <SatelliteCard position={[2.6, 0.5, 0.8]} rotation={[0, -0.15, -0.03]} delay={0.2} />
      <SatelliteCard position={[-2.2, -1, 1]} rotation={[0.05, 0.1, -0.02]} delay={0.4} />
      <SatelliteCard position={[2.4, -0.8, 0.3]} rotation={[-0.05, -0.2, 0.03]} delay={0.6} />
    </group>
  );
}
