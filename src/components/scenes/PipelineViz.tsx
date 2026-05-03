"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

const NODES = [
  { name: "STT", latency: "80ms", geo: "octahedron", pos: [-6, 0, 0] as [number, number, number] },
  { name: "EOT", latency: "50ms", geo: "sphere", pos: [-3, 0, 0] as [number, number, number] },
  { name: "LLM", latency: "120ms", geo: "dodecahedron", pos: [0, 0, 0] as [number, number, number] },
  { name: "TTS", latency: "70ms", geo: "cone", pos: [3, 0, 0] as [number, number, number] },
  { name: "CALLER", latency: "30ms", geo: "torus", pos: [6, 0, 0] as [number, number, number] },
];

function PipelineNode({
  name,
  latency,
  geo,
  position,
  index,
  time,
  sceneProgress,
}: {
  name: string;
  latency: string;
  geo: string;
  position: [number, number, number];
  index: number;
  time: number;
  sceneProgress: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const nodeProgress = Math.max(0, Math.min(1, (sceneProgress - index * 0.12) / 0.2));
  const scale = nodeProgress;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.3 + index;
      meshRef.current.rotation.x = Math.sin(time * 0.5 + index) * 0.2;
    }
  });

  const Geometry = () => {
    switch (geo) {
      case "octahedron": return <octahedronGeometry args={[0.5, 0]} />;
      case "sphere": return <sphereGeometry args={[0.45, 32, 32]} />;
      case "dodecahedron": return <dodecahedronGeometry args={[0.55, 0]} />;
      case "cone": return <coneGeometry args={[0.4, 0.8, 6]} />;
      case "torus": return <torusGeometry args={[0.4, 0.15, 16, 32]} />;
      default: return <sphereGeometry args={[0.45, 32, 32]} />;
    }
  };

  // Pulse glow when particle passes through
  const pulsePhase = (time * 0.8 + index * 1.5) % (Math.PI * 2);
  const pulse = Math.max(0, Math.sin(pulsePhase)) * 0.3;

  return (
    <group position={position} scale={scale}>
      <mesh ref={meshRef}>
        <Geometry />
        <meshStandardMaterial
          color="#1a1a2e"
          emissive="#C8FF00"
          emissiveIntensity={0.2 + pulse}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Glow shell */}
      <mesh scale={1.15}>
        <Geometry />
        <meshBasicMaterial color="#C8FF00" transparent opacity={0.04 + pulse * 0.08} wireframe />
      </mesh>

      {/* Label */}
      <Billboard position={[0, 1, 0]}>
        <Text fontSize={0.2} anchorX="center" anchorY="bottom">
          {name}
          <meshBasicMaterial color="#ffffff" />
        </Text>
        <Text fontSize={0.13} anchorX="center" anchorY="top" position={[0, -0.05, 0]}>
          {latency}
          <meshBasicMaterial color="#C8FF00" />
        </Text>
      </Billboard>
    </group>
  );
}

const PARTICLE_COUNT = 30;

function PipelineParticles({ sceneProgress }: { sceneProgress: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = -6 + (i / PARTICLE_COUNT) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current || sceneProgress < 0.5) return;
    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = -6 + (((i / PARTICLE_COUNT) * 12 + t * 2.5) % 12);
      arr[i * 3 + 1] = Math.sin(t * 3 + i * 0.5) * 0.15;
      arr[i * 3 + 2] = Math.cos(t * 2 + i * 0.7) * 0.15;
    }
    posAttr.needsUpdate = true;
  });

  const opacity = sceneProgress > 0.5 ? Math.min(1, (sceneProgress - 0.5) * 3) : 0;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#C8FF00"
        transparent
        opacity={opacity * 0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function ConnectionPipe({
  from,
  to,
  sceneProgress,
}: {
  from: [number, number, number];
  to: [number, number, number];
  sceneProgress: number;
}) {
  const points = useMemo(() => {
    return [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  }, [from, to]);

  const geometry = useMemo(() => {
    const curve = new THREE.LineCurve3(points[0], points[1]);
    return new THREE.TubeGeometry(curve, 8, 0.02, 8, false);
  }, [points]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#C8FF00"
        transparent
        opacity={Math.min(0.2, sceneProgress * 0.3)}
      />
    </mesh>
  );
}

export default function PipelineViz({ progress }: { progress: number }) {
  const visible = progress > 0.2 && progress < 0.5;
  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.25) / 0.15));
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  if (!visible) return null;

  return (
    <group>
      {NODES.map((node, i) => (
        <PipelineNode
          key={node.name}
          name={node.name}
          latency={node.latency}
          geo={node.geo}
          position={node.pos}
          index={i}
          time={timeRef.current}
          sceneProgress={sceneProgress}
        />
      ))}

      {/* Connection pipes between nodes */}
      {NODES.slice(0, -1).map((node, i) => (
        <ConnectionPipe
          key={`pipe-${i}`}
          from={node.pos}
          to={NODES[i + 1].pos}
          sceneProgress={sceneProgress}
        />
      ))}

      <PipelineParticles sceneProgress={sceneProgress} />
    </group>
  );
}
