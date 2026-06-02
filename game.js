// 1. ENGINE ENGINE SETUP & CONFIGURATION
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.01); // Atmospheric warzone fog

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const floorY = -10;
let score = 0, hp = 100, isPlaying = false;
let enemies = [], lasers = [], obstacles = [];

let pitch = 0, yaw = 0;
let touchStart = { x: 0, y: 0 };
let isTouchAiming = false;
let moveState = { forward: false, backward: false, left: false, right: false };

const playerSpeed = 0.45;
const attackRange = 50; 

// 2. REALISTIC LIGHTING SYSTEM
const ambientLight = new THREE.AmbientLight(0x2d3748, 0.7); // Warmer ambient fill
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffedd5, 1.0); // Sun light tint
sunLight.position.set(60, 120, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048; // High resolution shadows
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 400;
const d = 150;
sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

const flashLight = new THREE.PointLight(0x00ffff, 0, 40);
scene.add(flashLight);

// 3. PROCEDURAL PROCEDURAL REAL GROUND TEXTURE (Zameen/Mitti Effect)
const createGroundTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const cx = c.getContext('2d');
    
    // Base Mud/Dirt Color
    cx.fillStyle = '#2d2219'; cx.fillRect(0,0,512,512);
    
    // Adding Noise / Rough Soil Patches
    for (let i = 0; i < 15000; i++) {
        let x = Math.random() * 512;
        let y = Math.random() * 512;
        let size = Math.random() * 3 + 1;
        cx.fillStyle = Math.random() > 0.5 ? '#1e1610' : '#3a2d22'; // Dark and light soil spots
        cx.fillRect(x, y, size, size);
    }
    
    // Grass/Moss Blend Marks
    for (let i = 0; i < 300; i++) {
        let x = Math.random() * 512;
        let y = Math.random() * 512;
        let r = Math.random() * 15 + 5;
        let grd = cx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(34, 45, 24, 0.4)'); // Dull tactical green
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = grd;
        cx.beginPath(); cx.arc(x, y, r, 0, Math.PI*2); cx.fill();
    }
    return new THREE.CanvasTexture(c);
};

const groundTex = createGroundTexture();
groundTex.wrapS = THREE.RepeatWrapping; groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(80, 80);

const groundGeo = new THREE.PlaneGeometry(2000, 2000);
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, metalness: 0.1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = floorY;
ground.receiveShadow = true;
scene.add(ground);

// 4. DIFFERENT TYPES OF COVERS GENERATOR
function createCustomCover(type, x, z) {
    let geo, mat, height;
    
    if (type === 'MILITARY_CRATE') {
        // Type 1: Wooden/Iron Tactical Box Container
        height = 8;
        geo = new THREE.BoxGeometry(8, height, 8);
        mat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.7, metalness: 0.4 }); // Brown Cargo color
    } 
    else if (type === 'CONCRETE_WALL') {
        // Type 2: Wide Defense Wall
        height = 10;
        geo = new THREE.BoxGeometry(22, height, 4);
        mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8, metalness: 0.2 }); // Dusty Concrete Gray
    } 
    else if (type === 'CYBER_TOWER') {
        // Type 3: High Hexagonal Tech Tower
        height = 35;
        geo = new THREE.CylinderGeometry(4, 6, height, 6);
        mat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3, metalness: 0.8 }); // Dark Metallic Steel
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, floorY + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Custom logic detail strip lines on covers for design
    if(type === 'MILITARY_CRATE' || type === 'CONCRETE_WALL') {
        const lineGeo = new THREE.BoxGeometry(geo.parameters.width + 0.2, 0.5, geo.parameters.depth + 0.2);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const strip = new THREE.Mesh(lineGeo, lineMat);
        strip.position.y = 0;
        mesh.add(strip);
    }

    mesh.userData = { radius: Math.max(geo.parameters.width || geo.parameters.radiusTop * 2, geo.parameters.depth || 1) / 1.3 };
    scene.add(mesh);
    obstacles.push(mesh);
}

// 5. CYBORG SOLDIER GENERATOR WITH DETAILED ENEMY FACES
function spawnDetailedSoldier(fixedZ, fixedX) {
    const group = new THREE.Group();

    // Body Armor
    const bodyGeo = new THREE.CylinderGeometry(1.0, 0.7, 2.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xde2c2c, metalness: 0.5, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.4; body.castShadow = true; group.add(body);

    // Head Base
    const headGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 3.1; head.castShadow = true;

    // --- CYBORG FACE DETAILS (Eyes and Visor Mask) ---
    const visorGeo = new THREE.BoxGeometry(0.7, 0.2, 0.4);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Glowing Cyan Visor Eye Mask
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.1, -0.45); // Set on front face of head sphere
    head.add(visor);

    const jawGeo = new THREE.BoxGeometry(0.5, 0.3, 0.4);
    const jawMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7 }); // Heavy armored lower jaw
    const jaw = new THREE.Mesh(jawGeo, jawMat);
    jaw.position.set(0, -0.25, -0.4);
    head.add(jaw);

    group.add(head);

    // Heavy Weapon Arm Rifle
    const gunGeo = new THREE.BoxGeometry(0.4, 0.4, 1.8);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.9, 1.7, -0.7); gun.castShadow = true; group.add(gun);

    group.position.set(fixedX, floorY, fixedZ);
    group.userData = { isAlerted: false, baseX: fixedX, baseZ: fixedZ, radius: 1.6 };

    scene.add(group);
    enemies.push(group);
}

// Deploy Match Game Init
function startGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('controls-layer').style.display = 'block';
    
    camera.position.set(0, -5.5, 60); 
    isPlaying = true;
    
    // Placing Different Types of Covers across the map ground
    createCustomCover('CYBER_TOWER', 0, -20);      // Center Tower
    createCustomCover('CONCRETE_WALL', -30, 0);     // Left Wall
    createCustomCover('CONCRETE_WALL', 30, -50);    // Right Wall far away
    createCustomCover('MILITARY_CRATE', -15, -40);  // Small Crate boxes left
    createCustomCover('MILITARY_CRATE', 20, 10);    // Crate box close right
    createCustomCover('CYBER_TOWER', -45, -80);     // Far Left Tower
    createCustomCover('MILITARY_CRATE', -35, -10);  // Additional Cover box

    // Spawn Guards around the cover layout grid locations
    spawnDetailedSoldier(-35, 5);
    spawnDetailedSoldier(-75, -35);
    spawnDetailedSoldier(-120, 25);
    spawnDetailedSoldier(0, -45);
    spawnDetailedSoldier(-150, -10);
    
    animate();
}

// 6. TOUCH LOOK LOOK DRAG OVERLAY MECHANICS
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

    yaw -= deltaX * 0.0035;
    pitch -= deltaY * 0.0035;
    pitch = Math.max(-Math.PI/3.2, Math.min(Math.PI/3.2, pitch));

    camera.rotation.set(0, 0, 0);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    touchStart.x = touch.clientX;
    touchStart.y = touch.clientY;
}, { passive: false });

window.addEventListener('touchend', () => { isTouchAiming = false; });

// D-Pad Movement Setup Hooks Binds
const bindMovement = (id, directionProperty) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); moveState[directionProperty] = true; });
    el.addEventListener('touchend', (e) => { e.preventDefault(); moveState[directionProperty] = false; });
};
bindMovement('moveFwd', 'forward');
bindMovement('moveBwd', 'backward');
bindMovement('moveLeft', 'left');
bindMovement('moveRight', 'right');

// Laser Weapon Projectile System Dispatcher
function fireWeaponTracer() {
    const laserGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.5);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    
    laser.position.copy(camera.position);
    laser.position.y -= 0.6; 
    laser.rotation.copy(camera.rotation);
    laser.rotation.x += Math.PI / 2;
    
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    laser.velocity = dir.multiplyScalar(4.0);

    scene.add(laser);
    lasers.push(laser);

    flashLight.position.copy(camera.position);
    flashLight.intensity = 4.0;
    setTimeout(() => { flashLight.intensity = 0; }, 50);
}

// 7. GAME ENGINE MAIN MAIN CALCULATOR RENDERING LOOP
function animate() {
    if (!isPlaying) return;
    requestAnimationFrame(animate);

    const oldPos = camera.position.clone();

    // Movement Calculations
    const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardVector.y = 0; forwardVector.normalize(); 
    const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    rightVector.y = 0; rightVector.normalize();

    if (moveState.forward) camera.position.addScaledVector(forwardVector, playerSpeed);
    if (moveState.backward) camera.position.addScaledVector(forwardVector, -playerSpeed);
    if (moveState.left) camera.position.addScaledVector(rightVector, -playerSpeed);
    if (moveState.right) camera.position.addScaledVector(rightVector, playerSpeed);

    // Wall Covers Collision Tracker for Player
    obstacles.forEach((obs) => {
        let distToWall = camera.position.distanceTo(new THREE.Vector3(obs.position.x, camera.position.y, obs.position.z));
        if (distToWall < obs.userData.radius + 1.6) {
            camera.position.copy(oldPos); // Reset / Collision push back block
        }
    });

    // Laser Processing & Hit Down Core
    for(let l = lasers.length - 1; l >= 0; l--) {
        let laser = lasers[l];
        laser.position.add(laser.velocity);

        let laserDestroyed = false;

        for(let o=0; o<obstacles.length; o++) {
            if (laser.position.distanceTo(new THREE.Vector3(obstacles[o].position.x, laser.position.y, obstacles[o].position.z)) < obstacles[o].userData.radius) {
                scene.remove(laser);
                lasers.splice(l, 1);
                laserDestroyed = true;
                break;
            }
        }
        if (laserDestroyed) continue;

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
                spawnDetailedSoldier(camera.position.z - (Math.random() * 90 + 50), camera.position.x + (Math.random() - 0.5) * 80);
                break;
            }
        }

        if(laser && camera.position.distanceTo(laser.position) > 170) {
            scene.remove(laser);
            lasers.splice(l, 1);
        }
    }

    // AI Guard Mechanics Engine Loop
    let takingDamage = false;

    enemies.forEach((enemy) => {
        let currentDistance = camera.position.distanceTo(new THREE.Vector3(enemy.position.x, camera.position.y, enemy.position.z));

        if (currentDistance <= attackRange) {
            enemy.userData.isAlerted = true;
            
            let prevEnemyPos = enemy.position.clone();

            enemy.position.z += (camera.position.z > enemy.position.z) ? 0.24 : -0.24;
            enemy.position.x += (camera.position.x > enemy.position.x) ? 0.24 : -0.24;
            
            // AI Cover Bypass Check
            obstacles.forEach((obs) => {
                let dToObs = enemy.position.distanceTo(new THREE.Vector3(obs.position.x, enemy.position.y, obs.position.z));
                if (dToObs < obs.userData.radius + enemy.userData.radius) {
                    enemy.position.copy(prevEnemyPos);
                    enemy.position.x += (camera.position.x > enemy.position.x) ? 0.22 : -0.22; 
                }
            });

            // Enemy locks rotation facing player
            enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z);

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

    const flashScreen = document.getElementById('damage-flash');
    flashScreen.style.border = takingDamage ? "12px solid rgba(255, 71, 87, 0.65)" : "0px solid rgba(255, 71, 87, 0)";

    renderer.render(scene, camera);
}

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
