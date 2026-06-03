// 1. HARDWARE SYSTEM CONFIGURATION
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6ba2d9); // Cinematic sky blue backdrop
scene.fog = new THREE.FogExp2(0x6ba2d9, 0.007); // Beautiful distant horizon blur depth

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = "YXZ"; 

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// PROFILE ENGINE DATA MEMORY LAYER
let operatorName = "Riyanshu";
let currentLevel = 1;
let killPoints = 0;

let score = 0, hp = 100, isPlaying = false, isPaused = false;
let enemies = [], playerLasers = [], enemyLasers = [], environmentItems = [];

// AMMUNITION CORE MATRIX
let currentAmmo = 30;
let maxAmmo = 30;
let isReloading = false;

// WEAPON CONFIG PROFILE VAULT
let activeWeaponType = 1; 
let ownedWeapons = [1]; 
const weaponSpecs = {
    1: { name: "PLASMA CARBINE", damage: 1, color: 0x00ffff },
    2: { name: "HEAVY BLASTER", damage: 3, color: 0x2ed573 },
    3: { name: "HYPERION RAILGUN", damage: 6, color: 0xff4757 }
};

// Controls tracking vectors
let pitch = 0, yaw = 0;
let touchStart = { x: 0, y: 0 };
let isTouchAiming = false;
let joystickPos = { x: 0, y: 0 }, isJoystickActive = false;

const playerSpeed = 0.5;
const floorY = -10;
let gunMesh = null; // 3D First Person Hand Held Weapon mesh container

// 2. ENVIRONMENT ENGINE SETUP
const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfffaed, 0.6);
sunLight.position.set(100, 250, 50);
scene.add(sunLight);

// HIGHWAY STREET SURFACE GENERATION
const buildTacticalRoadway = () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const cx = c.getContext('2d');
    cx.fillStyle = '#2c3540'; cx.fillRect(0,0,256,256); // Asphalt gray
    cx.fillStyle = '#ffcc00'; cx.fillRect(120,0,16,60); cx.fillRect(120,150,16,60); // Yellow traffic dividers
    return new THREE.CanvasTexture(c);
};
const roadTex = buildTacticalRoadway();
roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping;
roadTex.repeat.set(5, 200);

const groundGeo = new THREE.PlaneGeometry(120, 5000);
const groundMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.8 });
const road = new THREE.Mesh(groundGeo, groundMat);
road.rotation.x = -Math.PI / 2; road.position.set(0, floorY, -2400);
scene.add(road);

// 3. FIRST PERSON HAND ARM SYSTEM GENERATOR
function generateFPVWeaponAttached() {
    if(gunMesh) camera.remove(gunMesh);
    
    gunMesh = new THREE.Group();
    
    // Main futuristic structural outer rail barrel
    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1f293d, metalness: 0.8, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.4, -0.4, -0.9); // Perfect placement bottom right corner of screen view
    gunMesh.add(barrel);

    // Glowing core neon energy chamber
    const coreGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8);
    const coreMat = new THREE.MeshBasicMaterial({ color: weaponSpecs[activeWeaponType].color });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0.4, -0.38, -0.85);
    gunMesh.add(core);

    camera.add(gunMesh);
    scene.add(camera);
}

// 4. USER CONTEXT / DATABASE ENGINE ROUTINES
window.onload = function() {
    let cachedName = localStorage.getItem('op_username');
    let cachedLevel = localStorage.getItem('op_level');
    let cachedPoints = localStorage.getItem('op_points');
    let cachedInventory = localStorage.getItem('op_weapons');

    if(cachedName) {
        operatorName = cachedName;
        currentLevel = parseInt(cachedLevel) || 1;
        killPoints = parseInt(cachedPoints) || 0;
        if(cachedInventory) ownedWeapons = JSON.parse(cachedInventory);
        
        document.getElementById('login-screen').style.display = 'none';
        displayMainMenu();
    }
};

function registerUser() {
    let input = document.getElementById('usernameInput').value.trim();
    if(input === "") { alert("Please enter a valid codename."); return; }
    operatorName = input;
    currentLevel = 1;
    killPoints = 0;
    ownedWeapons = [1];
    
    saveDatabaseProfile();
    document.getElementById('login-screen').style.display = 'none';
    displayMainMenu();
}

function saveDatabaseProfile() {
    localStorage.setItem('op_username', operatorName);
    localStorage.setItem('op_level', currentLevel.toString());
    localStorage.setItem('op_points', killPoints.toString());
    localStorage.setItem('op_weapons', JSON.stringify(ownedWeapons));
}

function displayMainMenu() {
    document.getElementById('menu-screen').style.display = 'flex';
    document.getElementById('welcomeUser').innerText = "WELCOME, OPERATOR: " + operatorName.toUpperCase();
    document.getElementById('profileLevel').innerText = "CURRENT RANK: STAGE " + currentLevel;
    updateShopUIButtons();
}

// 5. PROCEDURAL ITEM GENERATION SYSTEM (Spawns Objects Ahead dynamically)
function createStreetAsset(type, x, z) {
    let group = new THREE.Group();

    if(type === 'BUILDING') {
        const geo = new THREE.BoxGeometry(25, 60 + Math.random()*40, 25);
        const mat = new THREE.MeshStandardMaterial({ color: 0x222b3c, roughness: 0.5 });
        const mesh = new THREE.Mesh(geo, mat); mesh.position.y = geo.parameters.height/2; group.add(mesh);
        group.userData = { radius: 15 };
    } 
    else if(type === 'CAR') {
        const bGeo = new THREE.BoxGeometry(5, 2.2, 9);
        const bMat = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x9c27b0 : 0x0077cc });
        const base = new THREE.Mesh(bGeo, bMat); base.position.y = 1.1; group.add(base);
        group.userData = { radius: 5.5 };
    }
    else if(type === 'DRUM') {
        const geo = new THREE.CylinderGeometry(1.2, 1.2, 3, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xd63031, metalness: 0.5 });
        const mesh = new THREE.Mesh(geo, mat); mesh.position.y = 1.5; group.add(mesh);
        group.userData = { radius: 1.5 };
    }
    else if(type === 'STREET_LIGHT') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 14), new THREE.MeshStandardMaterial({color:0x555555}));
        pole.position.y = 7; group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshBasicMaterial({color:0xfffa9e}));
        bulb.position.set(x > 0 ? -2 : 2, 14, 0); group.add(bulb);
        group.userData = { radius: 1 };
    }

    group.position.set(x, floorY, z);
    scene.add(group);
    environmentItems.push(group);
}

function proceduralWorldPopulator(centerZ) {
    // Generate a structural cluster map slice 300 units ahead of player tracking axis
    for (let i = 0; i < 6; i++) {
        let side = Math.random() > 0.5 ? 1 : -1;
        let zPos = centerZ - (Math.random() * 250 + 50);
        let xPos = side * (35 + Math.random() * 25);
        
        let types = ['BUILDING', 'STREET_LIGHT', 'DRUM', 'CAR'];
        let picked = types[Math.floor(Math.random() * types.length)];
        
        // Ensure items stay aligned outside or directly inside road borders
        if(picked === 'CAR' || picked === 'DRUM') xPos = (Math.random() - 0.5) * 45; 
        
        createStreetAsset(picked, xPos, zPos);
    }
}

// 6. ENEMY CYBORG SOLDIER - DEFENSIVE FIRE AI UNIT
function spawnAISoldier(z, x) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 2.8, 8), new THREE.MeshStandardMaterial({ color: 0xee5253 }));
    body.position.y = 1.4; group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55), new THREE.MeshStandardMaterial({ color: 0x2f3542 }));
    head.position.y = 3.0;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    visor.position.set(0, 0.1, -0.4); head.add(visor);
    group.add(head);

    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rifle.position.set(0.8, 1.7, -0.6); group.add(rifle);

    group.position.set(x, floorY, z);
    // Enemy data tracking profiles
    group.userData = { 
        lastFiredTime: 0, 
        fireCooldown: 1200 + Math.random()*800, // randomized trigger shooting speeds
        hp: 1 + Math.floor(currentLevel * 0.5),
        radius: 2
    };

    scene.add(group);
    enemies.push(group);
}

// 7. WEAPON SHOP & RELOADING UTILITIES
function updateShopUIButtons() {
    document.getElementById('shopPoints').innerText = "POINTS: " + killPoints + " PTS";
    if(ownedWeapons.includes(2)) { document.getElementById('buyGun2').innerText = "EQUIP"; document.getElementById('buyGun2').className = "btn shop-btn equipped"; }
    if(ownedWeapons.includes(3)) { document.getElementById('buyGun3').innerText = "EQUIP"; document.getElementById('buyGun3').className = "btn shop-btn equipped"; }
}

function buyWeapon(id, cost) {
    if(ownedWeapons.includes(id)) {
        activeWeaponType = id;
        generateFPVWeaponAttached();
        togglePauseShop(false);
        return;
    }
    if(killPoints >= cost) {
        killPoints -= cost;
        ownedWeapons.push(id);
        activeWeaponType = id;
        saveDatabaseProfile();
        updateShopUIButtons();
        generateFPVWeaponAttached();
        document.getElementById('pointsTxt').innerText = "POINTS: " + killPoints;
        togglePauseShop(false);
    } else {
        alert("INSUFFICIENT KILL POINTS ARSENAL CAP!");
    }
}

function manualReloadRequest() {
    if(isReloading || currentAmmo === maxAmmo) return;
    executeWeaponReloadLoop();
}

function executeWeaponReloadLoop() {
    isReloading = true;
    document.getElementById('reloadAlert').style.display = 'block';
    setTimeout(() => {
        currentAmmo = maxAmmo;
        document.getElementById('ammoTxt').innerText = "AMMO: " + currentAmmo + " / " + maxAmmo;
        document.getElementById('reloadAlert').style.display = 'none';
        isReloading = false;
    }, 2200);
}

function togglePauseShop(pauseState) {
    if(!isPlaying) return;
    isPaused = pauseState;
    document.getElementById('shop-screen').style.display = pauseState ? 'flex' : 'none';
    updateShopUIButtons();
}

// 8. INTERACTIVE LOOK DRAG & JOYSTICK IMPLEMENTATIONS
const joystickContainer = document.getElementById('joystick-container');
const joystickKnob = document.getElementById('joystick-knob');

joystickContainer.addEventListener('touchstart', (e) => { isJoystickActive = true; moveJoystick(e.touches[0]); });
joystickContainer.addEventListener('touchmove', (e) => { e.preventDefault(); if(isJoystickActive) moveJoystick(e.touches[0]); });
joystickContainer.addEventListener('touchend', () => { isJoystickActive = false; joystickPos = {x:0, y:0}; joystickKnob.style.transform = `translate(0px,0px)`; });

function moveJoystick(touch) {
    const rect = joystickContainer.getBoundingClientRect();
    let dx = touch.clientX - (rect.left + rect.width/2), dy = touch.clientY - (rect.top + rect.height/2);
    let dist = Math.sqrt(dx*dx + dy*dy), maxR = rect.width/2;
    if(dist > maxR) { dx = (dx/dist)*maxR; dy = (dy/dist)*maxR; dist = maxR; }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickPos.x = dx / maxR; joystickPos.y = dy / maxR;
}

window.addEventListener('touchstart', (e) => {
    if(!isPlaying || isPaused) return;
    if(e.target.id === 'shootBtn' || joystickContainer.contains(e.target) || e.target.id==='pauseBtn' || e.target.id==='reloadBtn') {
        if(e.target.id === 'shootBtn') processFireCommand();
        return;
    }
    isTouchAiming = true; touchStart.x = e.touches[0].clientX; touchStart.y = e.touches[0].clientY;
});

window.addEventListener('touchmove', (e) => {
    if(!isPlaying || isPaused || !isTouchAiming) return;
    let t = null;
    for(let i=0; i<e.touches.length; i++) {
        if(!joystickContainer.contains(e.touches[i].target) && e.touches[i].target.id !== 'shootBtn') { t = e.touches[i]; break; }
    }
    if(!t) return;
    yaw -= (t.clientX - touchStart.x) * 0.0035; pitch -= (t.clientY - touchStart.y) * 0.0035;
    pitch = Math.max(-Math.PI/3.2, Math.min(Math.PI/3.2, pitch));
    camera.rotation.set(0,0,0); camera.rotation.y = yaw; camera.rotation.x = pitch;
    touchStart.x = t.clientX; touchStart.y = t.clientY;
});
window.addEventListener('touchend', () => { isTouchAiming = false; });

function processFireCommand() {
    if(isReloading) return;
    if(currentAmmo <= 0) { executeWeaponReloadLoop(); return; }

    currentAmmo--;
    document.getElementById('ammoTxt').innerText = "AMMO: " + currentAmmo + " / " + maxAmmo;

    // Dispatching FPV laser projectile
    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4), new THREE.MeshBasicMaterial({ color: weaponSpecs[activeWeaponType].color }));
    laser.position.copy(camera.position); laser.position.y -= 0.4;
    laser.rotation.copy(camera.rotation); laser.rotation.x += Math.PI/2;
    
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    laser.velocity = dir.multiplyScalar(4.5);
    laser.userData = { dmg: weaponSpecs[activeWeaponType].damage };

    scene.add(laser);
    playerLasers.push(laser);
}

// 9. ANIMATION EXECUTION KINETIC LOOP
function animate() {
    if(!isPlaying || isPaused) return;
    requestAnimationFrame(animate);

    const oldPos = camera.position.clone();

    // Player Movement Processing Matrix
    if(isJoystickActive) {
        const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); fwd.y = 0; fwd.normalize();
        const rgt = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); rgt.y = 0; rgt.normalize();
        camera.position.addScaledVector(fwd, -joystickPos.y * playerSpeed);
        camera.position.addScaledVector(rgt, joystickPos.x * playerSpeed);
    }

    // World Boundary and Obstacle Collisions
    if(Math.abs(camera.position.x) > 55) camera.position.x = oldPos.x;
    environmentItems.forEach(item => {
        if(camera.position.distanceTo(new THREE.Vector3(item.position.x, camera.position.y, item.position.z)) < item.userData.radius + 1.5) {
            camera.position.copy(oldPos);
        }
    });

    // Dynamic Procedural Chunk Spawning Hook
    if(camera.position.z - 400 < -environmentItems.length * 30) {
        proceduralWorldPopulator(camera.position.z);
    }

    // Player Lasers Tracking Pipeline
    for(let i=playerLasers.length-1; i>=0; i--) {
        let l = playerLasers[i]; l.position.add(l.velocity);
        let hit = false;

        for(let e=enemies.length-1; e>=0; e--) {
            let nmy = enemies[e];
            if(l.position.distanceTo(new THREE.Vector3(nmy.position.x, nmy.position.y+1.5, nmy.position.z)) < nmy.userData.radius + 1) {
                nmy.userData.hp -= l.userData.dmg;
                scene.remove(l); playerLasers.splice(i,1); hit = true;

                if(nmy.userData.hp <= 0) {
                    scene.remove(nmy); enemies.splice(e,1);
                    score++; killPoints += 2;
                    document.getElementById('hudKills').innerText = `PROGRESS: ${score} / 30 KILLS`;
                    document.getElementById('pointsTxt').innerText = "POINTS: " + killPoints;
                    
                    if(score >= 30) { triggerLevelCompletionSeq(); return; }
                    spawnAISoldier(camera.position.z - (Math.random()*120 + 80), (Math.random()-0.5)*80);
                }
                break;
            }
        }
        if(!hit && camera.position.distanceTo(l.position) > 200) { scene.remove(l); playerLasers.splice(i,1); }
    }

    // Enemy Lasers & Fire Shooting Matrix AI Loop
    let takingDmg = false;
    let now = Date.now();

    enemies.forEach(nmy => {
        let dist = camera.position.distanceTo(nmy.position);
        nmy.lookAt(camera.position.x, nmy.position.y, camera.position.z);

        if(dist < 110 && now - nmy.userData.lastFiredTime > nmy.userData.fireCooldown) {
            nmy.userData.lastFiredTime = now;
            
            // Enemy shooting projectile tracer deployment
            const el = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3), new THREE.MeshBasicMaterial({color: 0xffa500}));
            el.position.set(nmy.position.x, nmy.position.y + 1.7, nmy.position.z);
            el.lookAt(camera.position); el.rotation.x += Math.PI/2;
            
            let eDir = new THREE.Vector3().subVectors(camera.position, nmy.position).normalize();
            el.velocity = eDir.multiplyScalar(2.2);
            scene.add(el); enemyLasers.push(el);
        }
    });

    // Enemy Lasers Processing Hit Registry
    for(let j=enemyLasers.length-1; j>=0; j--) {
        let el = enemyLasers[j]; el.position.add(el.velocity);
        if(el.position.distanceTo(camera.position) < 2.5) {
            takingDmg = true; hp -= 4;
            document.getElementById('hpTxt').innerText = "HP: " + Math.max(0, Math.floor(hp)) + "%";
            scene.remove(el); enemyLasers.splice(j,1);

            if(hp <= 0) { triggerGameOverSeq(false); return; }
        } else if(camera.position.distanceTo(el.position) > 200) {
            scene.remove(el); enemyLasers.splice(j,1);
        }
    }

    document.getElementById('damage-flash').style.border = takingDmg ? "12px solid rgba(255,0,0,0.6)" : "0px solid transparent";
    renderer.render(scene, camera);
}

// 10. ENGINE STATE SYSTEMS
function startGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('controls-layer').style.display = 'flex';
    
    document.getElementById('hudName').innerText = "OP: " + operatorName.toUpperCase();
    document.getElementById('hudLevel').innerText = "STAGE: " + currentLevel;
    document.getElementById('hudKills').innerText = `PROGRESS: ${score} / 30 KILLS`;
    document.getElementById('pointsTxt').innerText = "POINTS: " + killPoints;

    camera.position.set(0, -5.5, 0);
    yaw = 0; pitch = 0; camera.rotation.set(0,0,0);
    isPlaying = true; isPaused = false;

    generateFPVWeaponAttached();

    // Initial item chunks deployments
    proceduralWorldPopulator(-50);
    for(let k=0; k<5; k++) spawnAISoldier(-(k*40 + 60), (Math.random()-0.5)*75);

    animate();
}

function triggerLevelCompletionSeq() {
    isPlaying = false;
    currentLevel++;
    saveDatabaseProfile();
    
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('gameOverTitle').innerText = "LEVEL COMPLETED";
    document.getElementById('gameOverTitle').style.color = "#2ed573";
    document.getElementById('gameOverDesc').innerText = `Stage cleared! Level profile progressive save verified. Proceed to Stage ${currentLevel}.`;
}

function triggerGameOverSeq() {
    isPlaying = false;
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('gameOverTitle').innerText = "MISSION FAILED";
    document.getElementById('gameOverTitle').style.color = "#ff4757";
    document.getElementById('gameOverDesc').innerText = "Operator eliminated. Gear up and redeploy to try again.";
}

function restartGame() {
    // Purge engine grids
    enemies.forEach(e => scene.remove(e)); playerLasers.forEach(l => scene.remove(l));
    enemyLasers.forEach(el => scene.remove(el)); environmentItems.forEach(i => scene.remove(i));
    enemies = []; playerLasers = []; enemyLasers = []; environmentItems = [];
    
    score = 0; hp = 100; currentAmmo = 30; isReloading = false;
    document.getElementById('game-over').style.display = 'none';
    startGame();
}
