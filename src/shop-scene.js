import * as THREE from '/assets/vendor/three/three.module.js';
import { GLTFLoader } from '/assets/vendor/three/addons/loaders/GLTFLoader.js';

// Model coordinates: staff aisle z=-1.22..-.46, display z=-.46..1.10,
// customer side z>1.10. The camera stays in the staff aisle, looking outward.
export const SHOP_CAMERA = { position: [1.25, 2.45, -1.05], target: [1.25, 1.0, 3.8] };
let ready;
let renderer;
let scene;
let camera;
let layer;
let visible = false;
let environmentTarget;

function box(width, height, depth, colour, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: colour, roughness: .82 }));
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}
function surroundings() {
  // A calm customer-side courtyard fills the open front of the supplied shop.
  box(28, .12, 24, '#e2d9c5', 1.25, -.09, 9);
  box(26, 2.2, .2, '#e9eee0', 1.25, 1.1, 9);
  for (let x = -12; x <= 14; x += 2) box(.022, .012, 22, '#c9c9b6', x, -.019, 8);
  for (let z = 3; z <= 18; z += 2) box(27, .012, .022, '#c9c9b6', 1.25, -.018, z);
  // Slender porch columns and a striped canopy frame the service opening.
  for (const x of [-4.6, 7.1]) box(.16, 4, .16, '#d1b797', x, 2, 3.1);
  for (let i = 0; i < 20; i++) box(.59, .12, 3.5, i % 2 ? '#f9ecd9' : '#c3d3b2', -4.35 + i * .59, 4.0, 3.8);
  box(12, .18, .12, '#e9dac5', 1.25, 3.88, 2.0);
  const leaf = new THREE.MeshStandardMaterial({ color: '#9bbd90', roughness: .95 });
  const leafLight = new THREE.MeshStandardMaterial({ color: '#b3cd9a', roughness: .95 });
  for (const [x, z] of [[-3.6, 5], [6.2, 5], [-1.8, 8], [4.6, 8]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.42, .30, .7, 20), new THREE.MeshStandardMaterial({ color: '#dcab97', roughness: .9 }));
    pot.position.set(x, .35, z); scene.add(pot);
    box(.1, 1.6, .1, '#ad926f', x, 1.1, z);
    for (const [dx, dy, dz, scale] of [[0, 2, 0, .8], [-.32, 1.55, .12, .55], [.32, 1.65, -.08, .6]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 2), dy === 2 ? leafLight : leaf);
      crown.position.set(x + dx, dy, z + dz); scene.add(crown);
    }
  }
}
function resize() {
  if (!renderer || !camera) return;
  const width = innerWidth, height = innerHeight;
  camera.aspect = width / height;
  // Keep a comfortable eye-level counter view in both orientations.
  camera.fov = width < 700 ? 78 : 70;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(width, height, false);
  if (visible && !document.hidden) renderer.render(scene, camera);
}
export function setShopVisible(value) {
  visible = value;
  if (layer) layer.hidden = !value || layer.dataset.state !== 'ready';
  document.querySelector('.landing').classList.toggle('has-shop-world', value && layer?.dataset.state === 'ready');
  if (value) resize();
}
export function prepareShop() {
  if (ready) return ready;
  ready = (async () => {
    layer = document.createElement('div');
    layer.className = 'shop-world'; layer.hidden = true;
    layer.setAttribute('aria-hidden', 'true');
    document.querySelector('.landing').prepend(layer);
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = .9;
      layer.append(renderer.domElement);
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#e6efd9');
      scene.fog = new THREE.Fog('#e6efd9', 10, 25);
      camera = new THREE.PerspectiveCamera(70, 1, .05, 70);
      camera.position.set(...SHOP_CAMERA.position);
      camera.lookAt(...SHOP_CAMERA.target);
      scene.add(new THREE.HemisphereLight('#fff8e8', '#b9c3ab', 1.6));
      const sun = new THREE.DirectionalLight('#fff4d9', 1.7);
      sun.position.set(-4, 9, 6); scene.add(sun);
      const envScene = new THREE.Scene(); envScene.background = new THREE.Color('#e5eadf');
      const generator = new THREE.PMREMGenerator(renderer);
      environmentTarget = generator.fromScene(envScene, .04, .1, 30);
      scene.environment = environmentTarget.texture; scene.environmentIntensity = .65;
      generator.dispose();
      const model = await new GLTFLoader().loadAsync('/assets/models/gelato-shop.glb');
      scene.add(model.scene);
      model.scene.traverse(object => {
        if (!object.isMesh) return;
        // Glass remains transparent from the staff side too.
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (material.transparent) material.depthWrite = false;
        }
      });
      surroundings();
      resize();
      // compileAsync can remain pending on some graphics drivers. Rendering
      // compiles the static scene synchronously without an unbounded GPU promise.
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      layer.dataset.state = 'ready';
      setShopVisible(visible);
      renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault(); layer.dataset.state = 'unavailable';
        document.querySelector('.landing').classList.remove('has-shop-world');
        layer.hidden = true;
      });
      renderer.domElement.addEventListener('webglcontextrestored', () => { layer.dataset.state = 'ready'; setShopVisible(visible); });
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) resize(); });
      return true;
    } catch (error) {
      console.warn('Shop scenery unavailable; keeping the playable background.', error);
      layer.dataset.state = 'unavailable'; layer.hidden = true;
      renderer?.dispose(); renderer = null;
      return false;
    }
  })();
  return ready;
}
