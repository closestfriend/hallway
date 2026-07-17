import * as THREE from 'three';

/** Recursively dispose geometries, materials and textures under an object. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}

function disposeMaterial(m: THREE.Material): void {
  for (const value of Object.values(m)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  m.dispose();
}
