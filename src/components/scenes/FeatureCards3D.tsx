"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Text, Line } from "@react-three/drei";
import * as THREE from "three";

const FEATURES = [
  { icon: "⚡", title: "Sub-500ms", subtitle: "Pipeline", pos: [-2.5, 1.5, 0] as [number, number, number], rot: [0, 0.1, 0.03] as [number, number, number] },
  { icon: "🌍", title: "30+", subtitle: "Languages", pos: [2, 2, -1] as [number, number, number], rot: [0, -0.15, -0.02] as [number, number, number] },
  { icon: "💬", title: "WhatsApp", subtitle: "Handoff", pos: [-3, -0.5, 1] as [number, number, number], rot: [0.03, 0.2, 0] as [number, number, number] },
  { icon: "🔌", title: "CRM", subtitle: "Integration", pos: [2.5, -0.3, 0.5] as [number, number, number], rot: [-0.02, -0.1, 0.04] as [number, number, number] },
  { icon: "📊", title: "Revenue", subtitle: "Attribution", pos: [-1.5, -2, -0.5] as [number, number, number], rot: [0, 0.05, -0.03] as [number, number, number] },
  { icon: "🛡️", title: "Compliance", subtitle: "Guardrails", pos: [1.5, -1.8, 1.5] as [number, number, number], rot: [0.02, -0.12, 0.01] as [number, number, number] },
];

function FeatureCard({
  icon,
  title,
  subtitle,
  position,
  rotation,
  index,
  sceneProgress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  position: [number, number, number];
  rotation: [number, number, number];
  index: number;
  sceneProgress: number;
}) {
  const cardProgress = Math.max(0, Math.min(1, (sceneProgress - index * 0.08) / 0.25));
  const opacity = cardProgress;

  return (
    <Float
      speed={1.5 + index * 0.2}
      rotationIntensity={0.08}
      floatIntensity={0.15}
      floatingRange={[-0.08, 0.08]}
    >
      <group position={position} rotation={rotation} scale={cardProgress}>
        {/* Card body */}
        <RoundedBox args={[1.8, 1.2, 0.02]} radius={0.06}>
          <meshPhysicalMaterial
            color="#1a1a2e"
            transparent
            opacity={opacity * 0.65}
            roughness={0.1}
            metalness={0.2}
            transmission={0.5}
          />
        </RoundedBox>

        {/* Lime border */}
        <RoundedBox args={[1.82, 1.22, 0.005]} radius={0.06} position={[0, 0, -0.015]}>
          <meshBasicMaterial color="#C8FF00" transparent opacity={opacity * 0.12} />
        </RoundedBox>

        {/* Title text */}
        <Text
          fontSize={0.22}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.15, 0.02]}
          maxWidth={1.5}
        >
          {title}
          <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
        </Text>

        {/* Subtitle */}
        <Text
          fontSize={0.12}
          anchorX="center"
          anchorY="middle"
          position={[0, -0.15, 0.02]}
          maxWidth={1.5}
        >
          {subtitle}
          <meshBasicMaterial color="#C8FF00" transparent opacity={opacity * 0.8} />
        </Text>
      </group>
    </Float>
  );
}

function ConnectingThreads({ sceneProgress }: { sceneProgress: number }) {
  const opacity = Math.max(0, (sceneProgress - 0.5) * 0.3);

  const connections: [number, number][] = [
    [0, 1], [1, 3], [2, 4], [3, 5], [0, 2],
  ];

  return (
    <group>
      {connections.map(([a, b], i) => {
        const from = FEATURES[a].pos;
        const to = FEATURES[b].pos;
        return (
          <Line
            key={i}
            points={[from, to]}
            color="#C8FF00"
            lineWidth={1}
            transparent
            opacity={opacity}
          />
        );
      })}
    </group>
  );
}

export default function FeatureCards3D({ progress }: { progress: number }) {
  const visible = progress > 0.35 && progress < 0.6;
  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.38) / 0.15));

  if (!visible) return null;

  return (
    <group>
      {FEATURES.map((f, i) => (
        <FeatureCard
          key={f.title}
          icon={f.icon}
          title={f.title}
          subtitle={f.subtitle}
          position={f.pos}
          rotation={f.rot}
          index={i}
          sceneProgress={sceneProgress}
        />
      ))}
      <ConnectingThreads sceneProgress={sceneProgress} />
    </group>
  );
}
