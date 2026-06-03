// 1. SYSTEM INITIALIZATION & FULLSCREEN SCENE SETUP
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6ba2d9); 
scene.fog = new THREE.FogExp2(0x6ba2d9, 0.005); // Deeper atmospheric fog calculation

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.rotation.order = "YXZ"; 

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
// True absolute fullscreen layout force dimensions
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

// PROFILE CONTEXT DATA DATA STORAGE
let operatorName = "Riyanshu";
let currentLevel = 1;
let killPoints = 0;

let score = 0, hp = 100, isPlaying = false, isPaused = false;
let enemies = [], playerLasers = [], enemyLasers = [], environmentItems = [];

// AMMO MATRICES
let currentAmmo = 30, maxAmmo = 30, isReloading = false;

// SCOPE MECHANICS MECHANISMS
let isScopeActive = false;
const baseFOV = 60;
const scopeFOV = 28; // Higher magnification factor inside viewport

// WEAPON SPEC DATA MATRIX
let activeWeaponType = 1; 
let ownedWeapons = [1]; 
const weaponSpecs = {
    1: { name: "PLASMA CARBINE", damage: 1, color: 0x00ffff },
    2: { name: "HEAVY BLASTER", damage: 3, color: 0x2ed573 },
    3: { name: "HYPERION RAILGUN", damage: 6, color: 0xff4757 }
};

let pitch = 0, yaw = 0;
let touchStart = { x: 0, y: 0 };
let isTouchAiming = false;
let joystickPos = { x: 0, y: 0 }, isJoystickActive = false;

const playerSpeed = 0.5;
const floorY = -10;
let gunMesh = null; 

// LIGHTING MATRICES
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfffaed, 0.65); sunLight.position.set(120, 300, 60); scene.add(sunLight);

// GIANT ROAD MAP GENERATION
const buildTacticalRoadway = () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512; const cx = c.getContext('2d');
    cx.fillStyle = '#222933'; cx.fillRect(0,0,512,512); 
    cx.fillStyle = '#ffffff'; cx.fillRect(0,0,12,512); cx.fillRect(500,0,12,512); // Sidewalk edge boundaries
    cx.fillStyle = '#ffcc00'; cx.fillRect(250,50,12,120); cx.fillRect(250,320,12,120); // Central traffic divides
    return new THREE.CanvasTexture(c);
};
const roadTex = buildTacticalRoadway();
roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping;
roadTex.repeat.set(1, 400); // Massive longitudinal tiling layout vector

// Map size enhanced significantly to feel expansive
const groundGeo = new THREE.PlaneGeometry(240, 12000); 
const groundMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
const road = new THREE.Mesh(groundGeo, groundMat);
road.rotation.x = -Math.PI / 2; road.position.set(0, floorY, -5500);
scene.add(road);

// 2. FIRST PERSON GUN WITH AIM-DOWN-SIGHTS (ADS SCOPE) TRACKING
function generateFPVWeaponAttached() {
    if(gunMesh) camera.remove(gunMesh);
    gunMesh = new THREE.Group();
    
    // Main weapon chassis rail
    const barrelGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.9, 8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x181e29, metalness: 0.85 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    
    // If scope is on, center gun model to match crosshair intersection exactly (ADS Mode)
    if(isScopeActive) {
        barrel.position.set(0, -0.28, -0.7); 
    } else {
        barrel.position.set(0.42, -0.38, -0.85); // Standard side hand held rest placement
    }
    gunMesh.add(barrel);

    const coreGeo = new THREE.BoxGeometry(0.08, 0.08, 0.75);
    const coreMat = new THREE.MeshBasicMaterial({ color: weaponSpecs[activeWeaponType].color });
    const core = new THREE.Mesh(coreGeo, coreMat);
    if(isScopeActive) {
        core.position.set(0, -0.26, -0.65);
    } else {
        core.position.set(0.42, -0.36, -0.8);
    }
    gunMesh.add(core);

    camera.add(gunMesh);
    scene.add(camera);
}

// 3. PERSISTENCE STORAGE LAYER MANAGEMENT
window.onload = function() {
    let cachedName = localStorage.getItem('op_username');
    let cachedLevel = localStorage.getItem('op_level');
    let cachedPoints = localStorage.getItem('op_points');
    let cachedInventory = localStorage.getItem('op_weapons');
    if(cachedName) {
        operatorName = cachedName; currentLevel = parseInt(cachedLevel) || 1; killPoints = parseInt(cachedPoints) || 0;
        if(cachedInventory) ownedWeapons = JSON.parse(cachedInventory);
        document.getElementById('login-screen').style.display = 'none'; displayMainMenu();
    }
};

function registerUser() {
    let input = document.getElementById('usernameInput').value.trim();
    if(input === "") { alert("Please enter a valid operator codename."); return; }
    operatorName = input; currentLevel = 1; killPoints = 0; ownedWeapons = [1];
    saveDatabaseProfile(); document.getElementById('login-screen').style.display = 'none'; displayMainMenu();
}
function saveDatabaseProfile() {
    localStorage.setItem('op_username', operatorName); localStorage.setItem('op_level', currentLevel.toString());
    localStorage.setItem('op_points', killPoints.toString()); localStorage.setItem('op_weapons', JSON.stringify(ownedWeapons));
}
function displayMainMenu() {
    document.getElementById('menu-screen').style.display = 'flex';
    document.getElementById('welcomeUser').innerText = "WELCOME, OPERATOR: " + operatorName.toUpperCase();
    document.getElementById('profileLevel').innerText = "CURRENT RANK: STAGE " + currentLevel;
    updateShopUIButtons();
}

// 4. GENERATION OF CHUNKS AND ENVIRONMENT PROP MANAGEMENT
function createStreetAsset(type, x, z) {
    let group = new THREE.Group();
    if(type === 'BUILDING') {
        const geo = new THREE.BoxGeometry(40, 90 + Math.random()*60, 40);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b222e, roughness: 0.6 }));
        mesh.position.y = geo.parameters.height/2; group.add(mesh); group.userData = { radius: 24 };
    } 
    else if(type === 'CAR') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 12), new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0xcc3333 : 0x2266bb }));
        base.position.y = 1.25; group.add(base); group.userData = { radius: 7.5 };
    }
    else if(type === 'DRUM') {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.5, 12), new THREE.MeshStandardMaterial({ color: 0xee5253 }));
        mesh.position.y = 1.75; group.add(mesh); group.userData = { radius: 2 };
    }
    else if(type === 'STREET_LIGHT') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 18), new THREE.MeshStandardMaterial({color:0x444444})); pole.position.y = 9; group.add(pole);
        group.userData = { radius: 1.2 };
    }
    group.position.set(x, floorY, z); scene.add(group); environmentItems.push(group);
}

function proceduralWorldPopulator(centerZ) {
    for (let i = 0; i < 8; i++) {
        let side = Math.random() > 0.5 ? 1 : -1;
        let zPos = centerZ - (Math.random() * 300 + 50);
        let xPos = side * (65 + Math.random() * 45); // Set outside wider roadway grid borders
        let types = ['BUILDING', 'STREET_LIGHT', 'DRUM', 'CAR'];
        let picked = types[Math.floor(Math.random() * types.length)];
        if(picked === 'CAR' || picked === 'DRUM') xPos = (Math.random() - 0.5) * 110; 
        createStreetAsset(picked, xPos, zPos);
    }
}

// 5. ENEMY CYBORG SPAWN ENGINE LOGIC
function spawnAISoldier(z, x) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.75, 3.0, 8), new THREE.MeshStandardMaterial({ color: 0xdd2c2c })); body.position.y = 1.5; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0x222831 })); head.position.y = 3.2;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.4), new THREE.MeshBasicMaterial({ color: 0xff0033 })); visor.position.set(0, 0.1, -0.42); head.add(visor);
    group.add(head);
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 1.8), new THREE.MeshStandardMaterial({ color: 0x09090b })); rifle.position.set(0.9, 1.8, -0.6); group.add(rifle);

    group.position.set(x, floorY, z);
    group.userData = { 
        lastFiredTime: 0, 
        fireCooldown: 1100 + Math.random()*700, 
        hp: 1 + Math.floor(currentLevel * 0.5),
        radius: 2.2,
        radarTriggerRange: 85 // CRITICAL CRITICAL: Enemy only starts firing inside this limit vector distance boundary box
    };
    scene.add(group); enemies.push(group);
}

// 6. SCOPE TOGGLE CONTROLLER HOOK MECHANICS
function setScopeState(active) {
    isScopeActive = active;
    const crosshair = document.getElementById('crosshair');
    if(isScopeActive) {
        camera.fov = scopeFOV;
        crosshair.className = "scope-active";
    } else {
        camera.fov = baseFOV;
        crosshair.className = "";
    }
    camera.updateProjectionMatrix();
    generateFPVWeaponAttached(); // Re-align weapon model matrix position vector coordinates
}

// 7. WEAPON SHOP CONTROL ENGINE INTERFACES
function updateShopUIButtons() {
    document.getElementById('shopPoints').innerText = "POINTS: " + killPoints + " PTS";
    if(ownedWeapons.includes(2)) { document.getElementById('buyGun2').innerText = "EQUIP"; document.getElementById('buyGun2').className = "btn shop-btn equipped"; }
    if(ownedWeapons.includes(3)) { document.getElementById('buyGun3').innerText = "EQUIP"; document.getElementById('buyGun3').className = "btn shop-btn equipped"; }
}
function buyWeapon(id, cost) {
    if(ownedWeapons.includes(id)) { activeWeaponType = id; generateFPVWeaponAttached(); togglePauseShop(false); return; }
    if(killPoints >= cost) {
        killPoints -= cost; ownedWeapons.push(id); activeWeaponType = id;
        saveDatabaseProfile(); updateShopUIButtons(); generateFPVWeaponAttached();
        document.getElementById('pointsTxt').innerText = "POINTS: " + killPoints; togglePauseShop(false);
    } else { alert("INSUFFICIENT FUNDS IN OPERATOR BALANCE WALLET!"); }
}
function manualReloadRequest() { if(isReloading || currentAmmo === maxAmmo) return; executeWeaponReloadLoop(); }
function executeWeaponReloadLoop() {
    isReloading = true; document.getElementById('reloadAlert').style.display = 'block';
    setTimeout(() => {
        currentAmmo = maxAmmo; document.getElementById('ammoTxt').innerText = "AMMO: " + currentAmmo + " / " + maxAmmo;
        document.getElementById('reloadAlert').style.display = 'none'; isReloading = false;
    }, 2000);
}
function togglePauseShop(pauseState) { if(!isPlaying) return; isPaused = pauseState; document.getElementById('shop-screen').style.display = pauseState ? 'flex' : 'none'; updateShopUIButtons(); }

// 8. ABSOLUTE TOUCH INTERFACE BIND MATRIX (JOYSTICK & ATTACK BUTTON RACKS)
const joystickContainer = document.getElementById('joystick-container');
const joystickKnob = document.getElementById('joystick-knob');
const scopeBtn = document.getElementById('scopeBtn');

joystickContainer.addEventListener('touchstart', (e) => { isJoystickActive = true; moveJoystick(e.touches[0]); });
joystickContainer.addEventListener('touchmove', (e) => { e.preventDefault(); if(isJoystickActive) moveJoystick(e.touches[0]); });
joystickContainer.addEventListener('touchend', () => { isJoystickActive = false; joystickPos = {x:0, y:0}; joystickKnob.style.transform = `translate(0px,0px)`; });

function moveJoystick(touch) {
    const rect = joystickContainer.getBoundingClientRect();
    let dx = touch.clientX - (rect.left + rect.width/2), dy = touch.clientY - (rect.top + rect.height/2);
    let dist = Math.sqrt(dx*dx + dy*dy), maxR = rect.width/2;
    if(dist > maxR) { dx = (dx/dist)*maxR; dy = (dy/dist)*maxR; dist = maxR; }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`; joystickPos.x = dx / maxR; joystickPos.y = dy / maxR;
}

// Scope event registrations
scopeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); setScopeState(!isScopeActive); });

window.addEventListener('touchstart', (e) => {
    if(!isPlaying || isPaused) return;
    if(e.target.id === 'shootBtn' || joystickContainer.contains(e.target) || e.target.id==='pauseBtn' || e.target.id==='reloadBtn' || e.target.id==='scopeBtn') {
        if(e.target.id === 'shootBtn') processFireCommand(); return;
    }
    isTouchAiming = true; touchStart.x = e.touches[0].clientX; touchStart.y = e.touches[0].clientY;
});

window.addEventListener('touchmove', (e) => {
    if(!isPlaying || isPaused || !isTouchAiming) return;
    let t = null; for(let i=0; i<e.touches.length; i++) { if(!joystickContainer.contains(e.touches[i].target) && e.touches[i].target.id !== 'shootBtn' && e.touches[i].target.id !== 'scopeBtn') { t = e.touches[i]; break; } }
    if(!t) return;
    let sensMod = isScopeActive ? 0.0015 : 0.0035; // Drops aiming sensitivity when scoped in for micro precision steady target tracking
    yaw -= (t.clientX - touchStart.x) * sensMod; pitch -= (t.clientY - touchStart.y) * sensMod;
    pitch = Math.max(-Math.PI/3.2, Math.min(Math.PI/3.2, pitch));
    camera.rotation.set(0,0,0); camera.rotation.y = yaw; camera.rotation.x = pitch;
    touchStart.x = t.clientX; touchStart.y = t.clientY;
});
window.addEventListener('touchend', () => { isTouchAiming = false; });

function processFireCommand() {
    if(isReloading) return; if(currentAmmo <= 0) { executeWeaponReloadLoop(); return; }
    currentAmmo--; document.getElementById('ammoTxt').innerText = "AMMO: " + currentAmmo + " / " + maxAmmo;

    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4), new THREE.MeshBasicMaterial({ color: weaponSpecs[activeWeaponType].color }));
    laser.position.copy(camera.position); laser.position.y -= 0.35; laser.rotation.copy(camera.rotation); laser.rotation.x += Math.PI/2;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); laser.velocity = dir.multiplyScalar(4.8);
    laser.userData = { dmg: weaponSpecs[activeWeaponType].damage }; scene.add(laser); playerLasers.push(laser);
}

// 9. ANIMATION RUNTIME GAME RUNNER KINETIC ENGINE LOOP
function animate() {
    if(!isPlaying || isPaused) return;
    requestAnimationFrame(animate);
    const oldPos = camera.position.clone();

    // Calculate Motion Vector Velocity
    if(isJoystickActive) {
        const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); fwd.y = 0; fwd.normalize();
        const rgt = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); rgt.y = 0; rgt.normalize();
        camera.position.addScaledVector(fwd, -joystickPos.y * playerSpeed);
        camera.position.addScaledVector(rgt, joystickPos.x * playerSpeed);
    }

    // Fullscreen Dynamic Boundary Track Edge Collisions
    if(Math.abs(camera.position.x) > 110) camera.position.x = oldPos.x;
    environmentItems.forEach(item => { if(camera.position.distanceTo(new THREE.Vector3(item.position.x, camera.position.y, item.position.z)) < item.userData.radius + 1.8) { camera.position.copy(oldPos); } });

    // Procedural generation trigger
    if(camera.position.z - 500 < -environmentItems.length * 30) { proceduralWorldPopulator(camera.position.z); }

    // Hit down validation tracker player lasers
    for(let i=playerLasers.length-1; i>=0; i--) {
        let l = playerLasers[i]; l.position.add(l.velocity); let hit = false;
        for(let e=enemies.length-1; e>=0; e--) {
            let nmy = enemies[e];
            if(l.position.distanceTo(new THREE.Vector3(nmy.position.x, nmy.position.y+1.5, nmy.position.z)) < nmy.userData.radius + 1.2) {
                nmy.userData.hp -= l.userData.dmg; scene.remove(l); playerLasers.splice(i,1); hit = true;
                if(nmy.userData.hp <= 0) {
                    scene.remove(nmy); enemies.splice(e,1); score++; killPoints += 2;
                    document.getElementById('hudKills').innerText = `PROGRESS: ${score} / 30 KILLS`; document.getElementById('pointsTxt').innerText = "POINTS: " + killPoints;
                    if(score >= 30) { triggerLevelCompletionSeq(); return; }
                    spawnAISoldier(camera.position.z - (Math.random()*150 + 90), (Math.random()-0.5)*180);
                }
                break;
            }
        }
        if(!hit && camera.position.distanceTo(l.position) > 250) { scene.remove(l); playerLasers.splice(i,1); }
    }

    // RANGE BASED ENEMY FIRE REGISTER SYSTEM
    let takingDmg = false; let now = Date.now();
    enemies.forEach(nmy => {
        let dist = camera.position.distanceTo(nmy.position);
        nmy.lookAt(camera.position.x, nmy.position.y, camera.position.z);

        // TRUE RANGE RADAR CHECK: Shoot only if player enters proximity limit sector vectors
        if(dist <= nmy.userData.radarTriggerRange) {
            if(now - nmy.userData.lastFiredTime > nmy.userData.fireCooldown) {
                nmy.userData.lastFiredTime = now;
                const el = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), new THREE.MeshBasicMaterial({color: 0xff3b30}));
                el.position.set(nmy.position.x, nmy.position.y + 1.8, nmy.position.z); el.lookAt(camera.position); el.rotation.x += Math.PI/2;
                let eDir = new THREE.Vector3().subVectors(camera.position, nmy.position).normalize();
                el.velocity = eDir.multiplyScalar(2.4); scene.add(el); enemyLasers.push(el);
            }
        }
    });

    // Translate enemy lasers
    for(let j=enemyLasers.length-1; j>=0; j--) {
        let el = enemyLasers[j]; el.position.add(el.velocity);
        if(el.position.distanceTo(camera.position) < 2.5) {
            takingDmg = true; hp -= 5; document.getElementById('hpTxt').innerText = "HP: " + Math.max(0, Math.floor(hp)) + "%";
            scene.remove(el); enemyLasers.splice(j,1); if(hp <= 0) { triggerGameOverSeq(); return; }
        } else if(camera.position.distanceTo(el.position) > 250) { scene.remove(el); enemyLasers.splice(j,1); }
    }

    document.getElementById('damage-flash').style.border = takingDmg ? "14px solid rgba(255, 0, 50, 0.7)" : "0px solid transparent";
    renderer.render(scene, camera);
}

// 10. SYSTEM STATE INITS
function startGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('controls-layer').style.display = 'flex';
    
    document.getElementById('hudName').innerText = "OP: " + operatorName.toUpperCase();
    document.getElementById('hudLevel').innerText = "STAGE: " + currentLevel;
    document.getElementById('hudKills').innerText = `PROGRESS: ${score} / 30 KILLS`;
    document.getElementById('pointsTxt').innerText = "POINTS: " + killPoints;

    camera.position.set(0, -5.5, 0); yaw = 0; pitch = 0; camera.rotation.set(0,0,0);
    isPlaying = true; isPaused = false; setScopeState(false);

    // Build map coordinates segments
    proceduralWorldPopulator(-50);
    for(let k=0; k<6; k++) spawnAISoldier(-(k*50 + 70), (Math.random()-0.5)*140);
    animate();
}

function triggerLevelCompletionSeq() {
    isPlaying = false; currentLevel++; saveDatabaseProfile();
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('gameOverTitle').innerText = "LEVEL COMPLETED"; document.getElementById('gameOverTitle').style.color = "#2ed573";
    document.getElementById('gameOverDesc').innerText = `Stage cleared successfully! Progress synced to profile storage. Advancing to Stage ${currentLevel}.`;
}
function triggerGameOverSeq() {
    isPlaying = false; document.getElementById('game-over').style.display = 'flex';
    document.getElementById('gameOverTitle').innerText = "MISSION FAILED"; document.getElementById('gameOverTitle').style.color = "#ff4757";
    document.getElementById('gameOverDesc').innerText = "Operator vitals crashed inside the trigger zone. Reset stats and deploy.";
}
function restartGame() {
    enemies.forEach(e => scene.remove(e)); playerLasers.forEach(l => scene.remove(l)); enemyLasers.forEach(el => scene.remove(el)); environmentItems.forEach(i => scene.remove(i));
    enemies = []; playerLasers = []; enemyLasers = []; environmentItems = [];
    score = 0; hp = 100; currentAmmo = 30; isReloading = false; document.getElementById('game-over').style.display = 'none';
    startGame();
}

// Dynamic window resizing for full screen sync
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
