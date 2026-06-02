// 1. SYSTEM SETUP & CONFIGURATION
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x01010a, 0.012); // Deep volumetric war climate fog

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer with Shadow Map Enabled
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const floorY = -10;
let score = 0, hp = 100, isPlaying = false;
let enemies = [], lasers = [], obstacles = [];

// Movement & Camera Vectors
let pitch = 0, yaw = 0;
let touchStart = { x: 0, y: 0 };
let isTouchAiming = false;
let moveState = { forward: false, backward: false, left: false, right: false };

const playerSpeed = 0.45;
const attackRange = 45; 

// 2. ADVANCED LIGHTING SYSTEM (Three.js Lights & Shadows)
const ambientLight = new THREE.AmbientLight(0x1a243d, 0.6); // Subtle blue base fill
scene.add(ambientLight);

// Directional Tactical Sun for Real Shadows
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(40, 100, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 300;
const d = 100;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// Point Light for Weapon Muzzle Flash Impact
const flashLight = new THREE.PointLight(0x00ffcc, 0, 30);
scene.add(flashLight);

// 3. ENVIRONMENT GENERATION (Procedural Ground & 3D Cover Buildings)
const createGroundTexture = () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const cx = c.getContext('2d');
    cx.fillStyle = '#0f131c'; cx.fillRect(0,0,256,256);
    // Grid Lines
    cx.strokeStyle = '#1f2d42'; cx.lineWidth = 4;
    cx.strokeRect(0,0,256,256);
    // Darker inside panel pattern
    cx.fillStyle = '#121824'; cx.fillRect(10,10,236,236);
    return new THREE.CanvasTexture(c);
};

const groundTex = createGroundTexture();
groundTex.wrapS = THREE.RepeatWrapping; 
groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(100, 100);

const groundGeo = new THREE.PlaneGeometry(1500, 1500);
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.7, metalness: 0.2 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2; 
ground.position.y = floorY;
ground.receiveShadow = true;
scene.add(ground);

// 3D Buildings Generator for Cover Mechanism
function createBuilding(x, z, width, height, depth) {
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const boxMat = new THREE.MeshStandardMaterial({ 
        color: 0x1b2234, 
        roughness: 0.5,
        metalness: 0.5,
        wireframe: false 
    });
    const building = new THREE.Mesh(boxGeo, boxMat);
    building.position.set(x, floorY + height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    
    // Custom Hitbox Radius bounding check
    building.userData = { radius: Math.max(width, depth) / 1.4 };
    
    scene.add(building);
    obstacles.push(building);
}

// 4. CYBORG SOLDIER GENERATION UNIT
function spawnStaticSoldier(fixedZ, fixedX) {
    const group = new THREE.Group();

    // Heavy Torso Armor Mesh
    const bodyGeo = new THREE.CylinderGeometry(1.0, 0.8, 2.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3838, metalness: 0.6, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.4; 
    body.castShadow = true;
    group.add(body);

    // AI Core Sphere Head
    const headGeo = new THREE.SphereGeometry(0.6, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff4444 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 3.1; 
    head.castShadow = true;
    group.add(head);

    // Dynamic Gun Barrel Rail
    const armGeo = new THREE.BoxGeometry(0.35, 0.35, 1.6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x00f3ff, metalness: 0.8 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0.9, 1.8, -0.6); 
    arm.castShadow = true;
    group.add(arm);

    group.position.set(fixedX, floorY, fixedZ);
    group.userData = { isAlerted: false, baseX: fixedX, baseZ: fixedZ, radius: 1.5 };

    scene.add(group);
    enemies.push(group);
}

// Deploy Match Initiator
function startGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('controls-layer').style.display = 'block';
    
    camera.position.set(0, -5.5, 50); 
    isPlaying = true;
    
    // Spawning Tactical Pillars & Cover Units
    createBuilding(0, 10, 15, 30, 15);     // Center Large Core Building
    createBuilding(-25, -30, 12, 25, 12);  // Left Block
    createBuilding(30, -50, 10, 20, 25);   // Right Warehouse Cover
    createBuilding(-40, 15, 14, 35, 14);   // Outer Left Tower
    createBuilding(20, 35, 8, 18, 8);      // Small Right Pillar

    // Spawning Enemy Grid Points
    spawnStaticSoldier(-25, -10);
    spawnStaticSoldier(-65, -45);
    spawnStaticSoldier(-110, 30);
    spawnStaticSoldier(15, -85);
    spawnStaticSoldier(-140, -15);
    
    animate();
}

// 5. TOUCH CONTROLS INPUT MANAGEMENT
window.addEventListener('touchstart', (e) => {
    if (!isPlaying) return;
    if (e.target.id === 'shootBtn' || e.target.classList.contains('dpad-btn')) {
        if(e.target.id === 'shootBtn') fireWeaponTracer();
        return;
    }
    isTouchAiming = true;
    touchStart.x = e.touches[0].clientX;
    touchStart.y = e.touches[0].clientY;
});

window.addEventListener('touchmove', (e) => {
    if (!isPlaying || !isTouchAiming) return;

    let touch = e.touches[0];
    for(let i=0; i<e.touches.length; i++) {
        if(e.touches[i].target.id !== 'shootBtn' && !e.touches[i].target.classList.contains('dpad-btn')) {
            touch = e.touches[i];
            break;
        }
    }

    let deltaX = touch.clientX - touchStart.x;
    let deltaY = touch.clientY - touchStart.y;

    yaw -= deltaX * 0.0038;
    pitch -= deltaY * 0.0038;
    pitch = Math.max(-Math.PI/3.2, Math.min(Math.PI/3.2, pitch)); // Vertical looking limit

    camera.rotation.set(0, 0, 0);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    touchStart.x = touch.clientX;
    touchStart.y = touch.clientY;
}, { passive: false });

window.addEventListener('touchend', () => { isTouchAiming = false; });

// D-Pad Movement Binds
const bindMovement = (id, directionProperty) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[directionProperty] = true; });
    el.addEventListener('touchend', (e) => { e.preventDefault(); moveState[directionProperty] = false; });
};
bindMovement('moveFwd', 'forward');
bindMovement('moveBwd', 'backward');
bindMovement('moveLeft', 'left');
bindMovement('moveRight', 'right');

// Weapon Shooting Logic with Dynamic Light Flash
function fireWeaponTracer() {
    const laserGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.0);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    
    laser.position.copy(camera.position);
    laser.position.y -= 0.6; 
    laser.rotation.copy(camera.rotation);
    laser.rotation.x += Math.PI / 2;
    
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    laser.velocity = dir.multiplyScalar(3.8);

    scene.add(laser);
    lasers.push(laser);

    // Trigger Pointlight flash at barrel position
    flashLight.position.copy(camera.position);
    flashLight.intensity = 3.5;
    setTimeout(() => { flashLight.intensity = 0; }, 60);
}

// 6. MAIN ENGINE CORE MATHEMATICAL LOOP
function animate() {
    if (!isPlaying) return;
    requestAnimationFrame(animate);

    // Save previous position coordinates for physical wall collision fallback
    const oldPos = camera.position.clone();

    // Calculate Movement Translations
    const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardVector.y = 0; forwardVector.normalize(); 
    const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    rightVector.y = 0; rightVector.normalize();

    if (moveState.forward) camera.position.addScaledVector(forwardVector, playerSpeed);
    if (moveState.backward) camera.position.addScaledVector(forwardVector, -playerSpeed);
    if (moveState.left) camera.position.addScaledVector(rightVector, -playerSpeed);
    if (moveState.right) camera.position.addScaledVector(rightVector, playerSpeed);

    // Solid Wall Collision Engine Detection for Player
    obstacles.forEach((obs) => {
        let distToWall = camera.position.distanceTo(new THREE.Vector3(obs.position.x, camera.position.y, obs.position.z));
        if (distToWall < obs.userData.radius + 1.5) {
            camera.position.copy(oldPos); // Bounce/Restrict back
        }
    });

    // Bullets System Frame Update & Raycast Hitbox Collision Checking
    for(let l = lasers.length - 1; l >= 0; l--) {
        let laser = lasers[l];
        laser.position.add(laser.velocity);

        let laserDestroyed = false;

        // Check if Bullet hits 3D Cover Buildings
        for(let o=0; o<obstacles.length; o++) {
            if (laser.position.distanceTo(new THREE.Vector3(obstacles[o].position.x, laser.position.y, obstacles[o].position.z)) < obstacles[o].userData.radius) {
                scene.remove(laser);
                lasers.splice(l, 1);
                laserDestroyed = true;
                break;
            }
        }
        if (laserDestroyed) continue;

        // Check if Bullet hits Enemy Units
        for(let e = enemies.length - 1; e >= 0; e--) {
            let enemy = enemies[e];
            let dist = laser.position.distanceTo(new THREE.Vector3(enemy.position.x, enemy.position.y + 1.5, enemy.position.z));

            if(dist < 2.5) {
                scene.remove(enemy);
                enemies.splice(e, 1);
                scene.remove(laser);
                lasers.splice(l, 1);

                score++;
                document.getElementById('scoreTxt').innerText = "ELIMINATIONS: " + score;
                spawnStaticSoldier(camera.position.z - (Math.random() * 80 + 50), camera.position.x + (Math.random() - 0.5) * 70);
                break;
            }
        }

        if(laser && camera.position.distanceTo(laser.position) > 160) {
            scene.remove(laser);
            lasers.splice(l, 1);
        }
    }

    // AI Movement Path Processing with Wall Obstacle Awareness
    let takingDamage = false;

    enemies.forEach((enemy) => {
        let currentDistance = camera.position.distanceTo(new THREE.Vector3(enemy.position.x, camera.position.y, enemy.position.z));

        if (currentDistance <= attackRange) {
            enemy.userData.isAlerted = true;
            
            // Save old coordinate before tracking processing step
            let prevEnemyPos = enemy.position.clone();

            enemy.position.z += (camera.position.z > enemy.position.z) ? 0.24 : -0.24;
            enemy.position.x += (camera.position.x > enemy.position.x) ? 0.24 : -0.24;
            
            // AI Building Collision Bypass Prevention Rule
            obstacles.forEach((obs) => {
                let dToObs = enemy.position.distanceTo(new THREE.Vector3(obs.position.x, enemy.position.y, obs.position.z));
                if (dToObs < obs.userData.radius + enemy.userData.radius) {
                    enemy.position.copy(prevEnemyPos); // Slide laterally around building corners
                    enemy.position.x += (camera.position.x > enemy.position.x) ? 0.2 : -0.2; 
                }
            });

            enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z);

            // Close Combat Range Damage System Execution Trigger
            if (currentDistance < 6.5) {
                takingDamage = true;
                hp -= 0.5;
                document.getElementById('hpTxt').innerText = "HEALTH: " + Math.max(0, Math.floor(hp)) + "%";

                if(hp <= 0) {
                    isPlaying = false;
                    document.getElementById('game-over').style.display = 'flex';
                }
            }
        } else {
            // Cool-down return tracker logic loop branch execution
            if (enemy.userData.isAlerted) {
                let distToBase = enemy.position.distanceTo(new THREE.Vector3(enemy.userData.baseX, floorY, enemy.userData.baseZ));
                if (distToBase > 1.5) {
                    enemy.position.z += (enemy.userData.baseZ > enemy.position.z) ? 0.18 : -0.18;
                    enemy.position.x += (enemy.userData.baseX > enemy.position.x) ? 0.18 : -0.18;
                    enemy.lookAt(enemy.userData.baseX, floorY, enemy.userData.baseZ);
                } else {
                    enemy.userData.isAlerted = false;
                }
            }
        }
    });

    // Dynamic Blood Screen Flash rendering system call
    const flashScreen = document.getElementById('damage-flash');
    flashScreen.style.border = takingDamage ? "12px solid rgba(255, 71, 87, 0.65)" : "0px solid rgba(255, 71, 87, 0)";

    renderer.render(scene, camera);
}

// System State Overhaul Reset Config Map Call
function restartGame() {
    document.getElementById('game-over').style.display = 'none';
    hp = 100; score = 0;
    document.getElementById('scoreTxt').innerText = "ELIMINATIONS: 0";
    document.getElementById('hpTxt').innerText = "HEALTH: 100%";
    yaw = 0; pitch = 0; camera.rotation.set(0,0,0);
    
    enemies.forEach(e => scene.remove(e));
    lasers.forEach(l => scene.remove(l));
    obstacles.forEach(o => scene.remove(o));
    enemies = []; lasers = []; obstacles = [];
    
    startGame();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
