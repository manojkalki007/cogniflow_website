"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef } from "react";

const WAYPOINTS = [
  new THREE.Vector3(0, 0, 20),
  new THREE.Vector3(0, -1, 10),
  new THREE.Vector3(0, -5, 0),
  new THREE.Vector3(5, -3, -5),
  new THREE.Vector3(0, -15, -10),
  new THREE.Vector3(0, -10, -20),
  new THREE.Vector3(0, 0, -25),
];

const LOOK_AT_POINTS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, -2, 5),
  new THREE.Vector3(0, -5, -5),
  new THREE.Vector3(3, -3, -10),
  new THREE.Vector3(0, -16, -12),
  new THREE.Vector3(0, -10, -25),
  new THREE.Vector3(0, 5, -30),
];

const cameraPath = new THREE.CatmullRomCurve3(WAYPOINTS);
const lookAtPath = new THREE.CatmullRomCurve3(LOOK_AT_POINTS);

const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3();

export default function CameraRail({
  scrollProgress,
}: {
  scrollProgress: number;
}) {
  const { camera } = useThree();
  const initialized = useRef(false);

  useFrame(() => {
    const t = Math.max(0, Math.min(1, scrollProgress));
    cameraPath.getPointAt(t, _targetPos);
    lookAtPath.getPointAt(t, _targetLook);

    if (!initialized.current) {
      camera.position.copy(_targetPos);
      initialized.current = true;
    } else {
      camera.position.lerp(_targetPos, 0.06);
    }

    camera.getWorldDirection(_currentLook);
    _currentLook.multiplyScalar(10).add(camera.position);
    _currentLook.lerp(_targetLook, 0.06);
    camera.lookAt(_currentLook);
  });

  return null;
}
