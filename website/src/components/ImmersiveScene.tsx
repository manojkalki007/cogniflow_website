"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import * as THREE from "three";
import CameraRail from "./CameraRail";
import HeroOrb from "./scenes/HeroOrb";
import HeroText3D from "./scenes/HeroText3D";
import HeroParticles from "./scenes/HeroParticles";
import ProductShowcase3D from "./scenes/ProductShowcase3D";
import PipelineViz from "./scenes/PipelineViz";
import FeatureCards3D from "./scenes/FeatureCards3D";
import ArchitectureIsometric from "./scenes/ArchitectureIsometric";
import Stats3D from "./scenes/Stats3D";
import { useScrollProgress } from "@/hooks/useScrollProgress";

const _lightFog = new THREE.Color("#f0f0ec");
const _darkFog = new THREE.Color("#111114");
const _fogColor = new THREE.Color();

function FogTransition({ progress }: { progress: number }) {
  const { scene } = useThree();

  useFrame(() => {
    if (progress < 0.25) {
      _fogColor.copy(_lightFog);
    } else if (progress < 0.4) {
      const t = (progress - 0.25) / 0.15;
      _fogColor.copy(_lightFog).lerp(_darkFog, t);
    } else {
      _fogColor.copy(_darkFog);
    }

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(_fogColor);
    }
    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).copy(_fogColor);
    }
  });

  return null;
}

function SceneContent() {
  const progress = useScrollProgress();

  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      <fog attach="fog" args={["#f0f0ec", 15, 80]} />
      <color attach="background" args={["#f0f0ec"]} />

      <FogTransition progress={progress} />
      <CameraRail scrollProgress={progress} />

      {/* Scene 1: Hero */}
      <group position={[0, 0, 0]}>
        <HeroText3D />
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <HeroOrb />
        </Float>
        <HeroParticles />
      </group>

      {/* Scene 2: Product Showcase */}
      <group position={[0, -2, 5]}>
        <ProductShowcase3D progress={progress} />
      </group>

      {/* Scene 3: Pipeline */}
      <group position={[0, -5, -5]}>
        <PipelineViz progress={progress} />
      </group>

      {/* Scene 4: Features */}
      <group position={[3, -3, -10]}>
        <FeatureCards3D progress={progress} />
      </group>

      {/* Scene 5: Architecture */}
      <group position={[0, -16, -12]}>
        <ArchitectureIsometric progress={progress} />
      </group>

      {/* Scene 6: Stats */}
      <group position={[0, -10, -25]}>
        <Stats3D progress={progress} />
      </group>
    </>
  );
}

export default function ImmersiveScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 2]}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
