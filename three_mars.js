(() => {
  const canvas = document.getElementById('mars-globe');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();

  // Ambient & directional light
  scene.add(new THREE.AmbientLight(0x777777));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 3);

  // Orbit controls
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.2;
  controls.maxDistance = 5;

  // Load texture (8K mars)
  const loader = new THREE.TextureLoader();
  const marsTex = loader.load('mars_texture_8k.jpg');

  // PBR material
  const material = new THREE.MeshStandardMaterial({
    map: marsTex,
    metalness: 0,
    roughness: 0.8,
  });

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    material,
  );
  scene.add(sphere);

  // Resize handling
  window.addEventListener('resize', () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    sphere.rotation.y += 0.0004;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
})();
