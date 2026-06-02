const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Screen dimension calculation
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// GAME VARIABLES
let score = 0;
let hp = 100;
let isPlaying = false;
let activeGhost = null;
let ghostTimer = null;
let spawnSpeed = 1600; // Time ghost stays on screen (ms) - Gets faster!
let bulletEffects = []; // Particle effect when you tap/shoot

// 1. DYNAMIC HORROR BACKGROUND GENERATOR
function drawSpookyBackground() {
    // Dark Vignette Gradient
    let gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, canvas.width*0.8);
    gradient.addColorStop(0, '#150d22');
    gradient.addColorStop(1, '#05020a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scary Fog Lines Effect
    ctx.strokeStyle = 'rgba(155, 89, 182, 0.04)';
    ctx.lineWidth = 2;
    for(let i = 0; i < canvas.height; i += 12) {
        ctx.beginPath();
        ctx.moveTo(0, i + Math.sin(Date.now()*0.002 + i)*5);
        ctx.lineTo(canvas.width, i + Math.sin(Date.now()*0.002 + i)*5);
        ctx.stroke();
    }
}

// 2. PROCEDURAL 2D GHOST VECTOR ART GENERATOR
function drawGhost(x, y, radius) {
    ctx.save();
    ctx.translate(x, y);

    // Floating floating animation calculation
    let floatY = Math.sin(Date.now() * 0.007) * 4;
    ctx.translate(0, floatY);

    // Outer Glow Effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(155, 89, 182, 0.8)";

    // Ghost Head & Body Frame
    ctx.fillStyle = "rgba(230, 210, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI, 0, false); // Head rounded top
    ctx.lineTo(radius, radius * 1.5); // Right side body
    
    // Bottom wavy skirts curves (scary look)
    let waves = 4;
    for (let i = 0; i < waves; i++) {
        let wx = radius - (i * (radius * 2 / waves));
        let nextWx = radius - ((i + 1) * (radius * 2 / waves));
        ctx.quadraticCurveTo((wx + nextWx)/2, radius * 1.8, nextWx, radius * 1.5);
    }
    ctx.lineTo(-radius, 0);
    ctx.closePath();
    ctx.fill();

    // Evil Glowing Red Eyes
    ctx.shadowBlur = 0; // Turn off shadow for eyes
    ctx.fillStyle = "#ff0055";
    ctx.beginPath();
    ctx.arc(-radius * 0.35, radius * 0.1, 5, 0, Math.PI * 2); // Left eye
    ctx.arc(radius * 0.35, radius * 0.1, 5, 0, Math.PI * 2);  // Right eye
    ctx.fill();

    // Angry Eyebrows lines
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, -radius * 0.1); ctx.lineTo(-radius * 0.1, radius * 0.05); // Left brow
    ctx.moveTo(radius * 0.5, -radius * 0.1); ctx.lineTo(radius * 0.1, radius * 0.05);   // Right brow
    ctx.stroke();

    // Creepy Mouth
    ctx.fillStyle = "#11051c";
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.5, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// 3. SPAWN LOGIC (Random Coordinates par ghost aana)
function spawnGhost() {
    if (!isPlaying) return;

    // Radius mobile view aur desktop view ke hisab se responsive banaya hai
    let radius = Math.min(canvas.width, canvas.height) * 0.08; 
    if (radius < 45) radius = 45;

    // Spawning safe boundaries inside viewport screen area
    let padding = radius * 2;
    let rx = padding + Math.random() * (canvas.width - padding * 2);
    let ry = padding + Math.random() * (canvas.height - padding * 2);

    activeGhost = { x: rx, y: ry, r: radius, id: Date.now() };

    // Progressive speed scaling rule: Har level pe ghost fast gayab hoga
    let dynamicSpeed = Math.max(650, spawnSpeed - (score * 45));

    // Agar player timing me nahi mar paya toh damage padega!
    ghostTimer = setTimeout(() => {
        triggerDamageEffect();
        hp -= 15;
        document.getElementById('hpTxt').innerText = "HEALTH: " + Math.max(0, hp) + "%";
        
        if(hp <= 0) {
            endGame();
        } else {
            spawnGhost(); // Respawn next
        }
    }, dynamicSpeed);
}

// 4. ACTION CONTROLLER - TAP EVENT
window.addEventListener('touchstart', (e) => {
    if (!isPlaying) return;
    e.preventDefault(); // Prevents double click zooming on mobile devices

    let touchX = e.touches[0].clientX;
    let touchY = e.touches[0].clientY;

    handleGameHitOrMiss(touchX, touchY);
});

// Click fallback support for desktops too
window.addEventListener('mousedown', (e) => {
    if (!isPlaying || 'ontouchstart' in window) return;
    handleGameHitOrMiss(e.clientX, e.clientY);
});

function handleGameHitOrMiss(clientX, clientY) {
    // Add Weapon Flash Crosshair Particle Effect onto location immediately
    createMuzzleEffect(clientX, clientY);

    if (activeGhost) {
        // Distance check math between tap and ghost center position
        let dist = Math.sqrt((clientX - activeGhost.x)**2 + (clientY - activeGhost.y)**2);
        
        if (dist <= activeGhost.r * 1.3) {
            // SUCCESS HIT!
            clearTimeout(ghostTimer);
            activeGhost = null;
            score++;
            document.getElementById('scoreTxt').innerText = "ELIMINATIONS: " + score;
            
            // Instantly setup next target spawn loop
            setTimeout(spawnGhost, Math.random() * 200 + 100);
            return;
        }
    }

    // IF MISSED TARGET (Blank screen pe tap kiya toh chhota damage penalty rule)
    triggerDamageEffect();
    hp -= 2; // Blank fires cost a bit energy
    document.getElementById('hpTxt').innerText = "HEALTH: " + Math.max(0, hp) + "%";
    if(hp <= 0) endGame();
}

// Visual feedback systems
function triggerDamageEffect() {
    const flash = document.getElementById('damage-flash');
    flash.style.background = "rgba(255, 71, 87, 0.45)";
    setTimeout(() => { flash.style.background = "rgba(0,0,0,0)"; }, 70);
}

function createMuzzleEffect(x, y) {
    bulletEffects.push({ x: x, y: y, life: 1.0 });
}

// 5. CORE RENDER ANIMATION MATRIX LOOPS
function loop() {
    if (!isPlaying) return;
    requestAnimationFrame(loop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render Background
    drawSpookyBackground();

    // Render Active Target
    if (activeGhost) {
        drawGhost(activeGhost.x, activeGhost.y, activeGhost.r);
    }

    // Render Dynamic Shooting Crosshair Rings Effects
    for (let i = bulletEffects.length - 1; i >= 0; i--) {
        let fx = bulletEffects[i];
        fx.life -= 0.08; // Fade speed calculation
        
        if (fx.life <= 0) {
            bulletEffects.splice(i, 1);
        } else {
            ctx.strokeStyle = `rgba(0, 243, 255, ${fx.life})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, (1 - fx.life) * 45 + 5, 0, Math.PI * 2);
            ctx.stroke();

            // Core center dot point
            ctx.fillStyle = `rgba(255, 255, 255, ${fx.life})`;
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// SYSTEM STATE OPERATIONS
function startGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'flex';
    document.getElementById('game-over').style.display = 'none';
    
    hp = 100;
    score = 0;
    bulletEffects = [];
    activeGhost = null;
    isPlaying = true;

    document.getElementById('scoreTxt').innerText = "ELIMINATIONS: " + score;
    document.getElementById('hpTxt').innerText = "HEALTH: 100%";

    spawnGhost();
    loop();
}

function endGame() {
    isPlaying = false;
    clearTimeout(ghostTimer);
    document.getElementById('game-over').style.display = 'flex';
}

function restartGame() {
    startGame();
}
