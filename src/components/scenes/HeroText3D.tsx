"use client";

import { Text } from "@react-three/drei";

export default function HeroText3D() {
  return (
    <group position={[0, 0, -2]}>
      <Text
        fontSize={3.2}
        letterSpacing={-0.04}
        anchorX="center"
        anchorY="middle"
        maxWidth={20}
        fontWeight={800}
      >
        COGNIFLOW.
        <meshStandardMaterial color="#0A0A0A" metalness={0.3} roughness={0.6} />
      </Text>
    </group>
  );
}
