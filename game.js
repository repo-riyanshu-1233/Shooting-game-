// 1. ENGINE ENGINE SETUP & ENVIRONMENT CONFIG
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008); 

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = "YXZ"; // CRITICAL FIX: Locks Horizontal view rotation first, then vertical (Human neck mechanics)

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const floorY = -10;
let score = 0, hp = 100, isPlaying = false;
let enemies = [], lasers = [], obstacles = [];

// FPV Camera Angle Control States
let pitch = 0, yaw = 0;
let touchStart = { x: 0, y: 0 };
let isTouchAiming = false;

// Joystick Vector Calculation Variables
let joystickPos = { x: 0, y: 0 };
let isJoystickActive = false;
const playerSpeed = 0.45;
const attackRange = 55;

// LIGHTING SETUP
const ambientLight = new THREE.AmbientLight(0x2d3748, 0.7);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffedd5, 1.0);
sunLight.position.set(60, 120, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const flashLight = new THREE.PointLight(0x00ffff, 0, 40);
scene.add(flashLight);

// MITTI/ZAMEEN TEXTURE GENERATOR
const createGroundTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const cx = c.getContext('2d');
    cx.fillStyle = '#2b1f17'; cx.fillRect(0,0,512,512);
    for (let i = 0; i < 12000; i++) {
        let x = Math.random() * 512, y = Math.random() * 512;
        cx.fillStyle = Math.random() > 0.5 ? '#1c140e' : '#36281d';
        cx.fillRect(x, y, Math.random()*2+1, Math.random()*2+1);
    }
    return new THREE.CanvasTexture(c);
};

const groundTex = createGroundTexture();
groundTex.wrapS = THREE.RepeatWrapping; groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(100, 100);

const groundGeo = new THREE.PlaneGeometry(2000, 2000);
const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = floorY;
ground.receiveShadow = true;
scene.add(ground);

// 2. ADVANCED COVERS GENERATOR (Buildings, Crates & 3D Cars)
function createCustomCover(type, x, z) {
    let mesh;
    
    if (type === 'BUILDING') {
        const geo = new THREE.BoxGeometry(18, 35, 18);
        const mat = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.6, metalness: 0.4 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, floorY + 17.5, z);
        mesh.userData = { radius: 11 };
    } 
    else if (type === 'CRATE') {
        const geo = new THREE.BoxGeometry(7, 7, 7);
        const mat = new THREE.MeshStandardMaterial({ color: 0x5c4433, roughness: 0.8 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, floorY + 3.5, z);
        mesh.userData = { radius: 4.5 };
    } 
    else if (type === 'CAR') {
        // Constructing a procedural 3D Armored Car model group
        mesh = new THREE.Group();
        
        // Car Chassis Base
        const baseGeo = new THREE.BoxGeometry(6, 2, 11);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x2d3a22, metalness: 0.6 }); // Military Green
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 1.2;
        base.castShadow = true;
        mesh.add(base);
        
        // Car Cabin Glass Roof
        const cabinGeo = new THREE.BoxGeometry(5, 1.8, 5);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 2.7, -0.5);
        cabin.castShadow = true;
        mesh.add(cabin);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 1, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
        
        const wpositions = [[-3.2, 0.9, 3.5], [3.2, 0.9, 3.5], [-3.2, 0.9, -3.5], [3.2, 0.9, -3.5]];
        wpositions.forEach((pos) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.castShadow = true;
            mesh.add(wheel);
        });

        mesh.position.set(x, floorY, z);
        mesh.userData = { radius: 6.5 };
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
}

// 3. CYBORG ENEMY WITH GLOWING EYES & VISOR MASK
function spawnDetailedSoldier(fixedZ, fixedX) {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.9, 0.7, 2.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc2323, metalness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.4; body.castShadow = true; group.add(body);

    const headGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x242b35 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 3.0; head.castShadow = true;

    // Red Glowing Visor Eye Mask Detail
    const visorGeo = new THREE.BoxGeometry(0.65, 0.15, 0.35);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff0033 }); 
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.1, -0.42); 
    head.add(visor);

    group.add(head);

    const gunGeo = new THREE.BoxGeometry(0.35, 0.35, 1.7);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f131a, metalness: 0.8 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.85, 1.7, -0.6); gun.castShadow = true; group.add(gun);

    group.position.set(fixedX, floorY, fixedZ);
    group.userData = { isAlerted: false, baseX: fixedX, baseZ: fixedZ, radius: 1.6 };

    scene.add(group);
    enemies.push(group);
}

// 4. TOUCH CORES & JOYSTICK CALCULATOR ENGINE
const joystickContainer = document.getElementById('joystick-container');
const joystickKnob = document.getElementById('joystick-knob');

joystickContainer.addEventListener('touchstart', (e) => {
    isJoystickActive = true;
    processJoystickMove(e.touches[0]);
});

joystickContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isJoystickActive) return;
    processJoystickMove(e.touches[0]);
});

joystickContainer.addEventListener('touchend', () => {
    isJoystickActive = false;
    joystickPos = { x: 0, y: 0 };
    joystickKnob.style.transform = `translate(0px, 0px)`; // Recenter knob
});

function processJoystickMove(touch) {
    const rect = joystickContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = rect.width / 2;

    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
        distance = maxRadius;
    }

    joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    // Normalize vectors between -1 and 1
    joystickPos.x = deltaX / maxRadius;
    joystickPos.y = deltaY / maxRadius;
}

// 360 DEGREE LOOK AROUND (HUMAN NECK LOOK ROTATION ENGINE)
window.addEventListener('touchstart', (e) => {
    if (!isPlaying) return;
    if (e.target.id === 'shootBtn' || joystickContainer.contains(e.target)) {
        if(e.target.id === 'shootBtn') fireWeaponTracer();
        return;
    }
    isTouchAiming = true;
    touchStart.x = e.touches[0].clientX;
    touchStart.y = e.touches[0].clientY;
});

window.addEventListener('touchmove', (e) => {
    if (!isPlaying || !isTouchAiming) return;

    let touch = null;
    for(let i=0; i<e.touches.length; i++) {
        if(!joystickContainer.contains(e.touches[i].target) && e.touches[i].target.id !== 'shootBtn') {
            touch = e.touches[i];
            break;
        }
    }
    if(!touch) return;

    let deltaX = touch.clientX - touchStart.x;
    let deltaY = touch.clientY - touchStart.y;

    yaw -= deltaX * 0.0035;
    pitch -= deltaY * 0.0035;
    pitch = Math.max(-Math.PI/3.2, Math.min(Math.PI/3.2, pitch)); // Prevents looking behind head vertically

    // HUMAN VIEW MATRIX INTEGRATION
    camera.rotation.set(0, 0, 0); // Clear order loop
    camera.rotation.y = yaw;      // Turns neck left/right
    camera.rotation.x = pitch;    // Tilts head up/down

    touchStart.x = touch.clientX;
    touchStart.y = touch.clientY;
}, { passive: false });

window.addEventListener('touchend', () => { isTouchAiming = false; });

function fireWeaponTracer() {
    const laserGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.5);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    
    laser.position.copy(camera.position);
    laser.position.y -= 0.6; 
    laser.rotation.copy(camera.rotation);
    laser.rotation.x += Math.PI / 2;
    
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    laser.velocity = dir.multiplyScalar(4.2);

    scene.add(laser);
    lasers.push(laser);

    flashLight.position.copy(camera.position);
    flashLight.intensity = 4.0;
    setTimeout(() => { flashLight.intensity = 0; }, 50);
}

// 5. RUNTIME GAME ENGINE ENGINE MAIN LOOP
function animate() {
    if (!isPlaying) return;
    requestAnimationFrame(animate);

    const oldPos = camera.position.clone();

    // JOYSTICK VECTOR DIRECTION TRANSLATION
    if (isJoystickActive) {
        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forwardVector.y = 0; forwardVector.normalize(); 
        
        const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        rightVector.y = 0; rightVector.normalize();

        // Moving player based on combination vectors of joystick axes
        camera.position.addScaledVector(forwardVector, -joystickPos.y * playerSpeed);
        camera.position.addScaledVector(rightVector, joystickPos.x * playerSpeed);
    }

    // Collision system logic checks
    obstacles.forEach((obs) => {
        let dist = camera.position.distanceTo(new THREE.Vector3(obs.position.x, camera.position.y, obs.position.z));
        if (dist < obs.userData.radius + 1.5) {
            camera.position.copy(oldPos); // Wall slide restriction block
        }
    });

    // Bullets translation
    for(let l = lasers.length - 1; l >= 0; l--) {
        let laser = lasers[l];
        laser.position.add(laser.velocity);
        let laserDestroyed = false;

        for(let o=0; o<obstacles.length; o++) {
            if (laser.position.distanceTo(new THREE.Vector3(obstacles[o].position.x, laser.position.y, obstacles[o].position.z)) < obstacles[o].userData.radius) {
                scene.remove(laser); lasers.splice(l, 1); laserDestroyed = true; break;
            }
        }
        if (laserDestroyed) continue;

        for(let e = enemies.length - 1; e >= 0; e--) {
            let enemy = enemies[e];
            let dist = laser.position.distanceTo(new THREE.Vector3(enemy.position.x, enemy.position.y + 1.5, enemy.position.z));
            if(dist < 2.5) {
                scene.remove(enemy); enemies.splice(e, 1);
                scene.remove(laser); lasers.splice(l, 1);
                score++;
                document.getElementById('scoreTxt').innerText = "ELIMINATIONS: " + score;
                spawnDetailedSoldier(camera.position.z - (Math.random() * 90 + 50), camera.position.x + (Math.random() - 0.5) * 80);
                break;
            }
        }

        if(laser && camera.position.distanceTo(laser.position) > 170) {
            scene.remove(laser); lasers.splice(l, 1);
        }
    }

    // AI Follow chase processing loops
    let takingDamage = false;
    enemies.forEach((enemy) => {
        let currentDistance = camera.position.distanceTo(new THREE.Vector3(enemy.position.x, camera.position.y, enemy.position.z));

        if (currentDistance <= attackRange) {
            enemy.userData.isAlerted = true;
            let prevEnemyPos = enemy.position.clone();

            enemy.position.z += (camera.position.z > enemy.position.z) ? 0.25 : -0.25;
            enemy.position.x += (camera.position.x > enemy.position.x) ? 0.25 : -0.25;
            
            obstacles.forEach((obs) => {
                if (enemy.position.distanceTo(new THREE.Vector3(obs.position.x, enemy.position.y, obs.position.z)) < obs.userData.radius + enemy.userData.radius) {
                    enemy.position.copy(prevEnemyPos);
                    enemy.position.x += (camera.position.x > enemy.position.x) ? 0.22 : -0.22; 
                }
            });

            enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z);

            if (currentDistance < 6.5) {
                takingDamage = true; hp -= 0.55;
                document.getElementById('hpTxt').innerText = "HEALTH: " + Math.max(0, Math.floor(hp)) + "%";
                if(hp <= 0) { isPlaying = false; document.getElementById('game-over').style.display = 'flex'; }
            }
        } else {
            if (enemy.userData.isAlerted) {
                let distToBase = enemy.position.distanceTo(new THREE.Vector3(enemy.userData.baseX, floorY, enemy.userData.baseZ));
                if (distToBase > 2.0) {
                    enemy.position.z += (enemy.userData.baseZ > enemy.position.z) ? 0.2 : -0.2;
                    enemy.position.x += (enemy.userData.baseX > enemy.position.x) ? 0.2 : -0.2;
                    enemy.lookAt(enemy.userData.baseX, floorY, enemy.userData.baseZ);
                } else { enemy.userData.isAlerted = false; }
            }
        }
    });

    const flashScreen = document.getElementById('damage-flash');
    flashScreen.style.border = takingDamage ? "12px solid rgba(255, 71, 87, 0.65)" : "0px solid rgba(255, 71, 87, 0)";

    renderer.render(scene, camera);
}

function startGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('controls-layer').style.display = 'flex';
    camera.position.set(0, -5.5, 60); 
    isPlaying = true;

    // Distributing Different Covers across map coordinate grid locations
    createCustomCover('BUILDING', 0, -25);
    createCustomCover('CAR', -20, 15);       // Armored military car cover left
    createCustomCover('CAR', 25, -15);       // Armored military car cover right
    createCustomCover('CRATE', -15, -45);
    createCustomCover('BUILDING', -45, -80);
    createCustomCover('CAR', 0, -70);        // Dead car core blocking paths center far

    spawnDetailedSoldier(-45, 5);
    spawnDetailedSoldier(-85, -35);
    spawnDetailedSoldier(-130, 25);
    spawnDetailedSoldier(-10, -55);
    
    animate();
}

function restartGame() {
    document.getElementById('game-over').style.display = 'none';
    hp = 100; score = 0;
    document.getElementById('scoreTxt').innerText = "ELIMINATIONS: 0";
    document.getElementById('hpTxt').innerText = "HEALTH: 100%";
    yaw = 0; pitch = 0; camera.rotation.set(0,0,0);
    enemies.forEach(e => scene.remove(e)); lasers.forEach(l => scene.remove(l)); obstacles.forEach(o => scene.remove(o));
    enemies = []; lasers = []; obstacles = [];
    startGame();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
