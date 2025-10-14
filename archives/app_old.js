import { MindARThree } from "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/GLTFLoader.js";

// Cleaned and balanced app.js with demo sequence and tracing
// Keep file minimal and robust. Preserve TRACE_HUMAN for debugging.

document.addEventListener("DOMContentLoaded", async () => {
  // Configuration
  const TRACE_HUMAN = true;
  const DEBUG_MODE = false;

  // UI helpers
  function createScanningUI() {
    const scanningUI = document.createElement('div');
    scanningUI.id = 'scanning-ui';
    scanningUI.style.position = 'absolute';
    scanningUI.style.top = '0';
    scanningUI.style.left = '0';
    scanningUI.style.width = '100%';
    scanningUI.style.height = '100%';
    return scanningUI;
  }

  function createInstructionsElement() {
    const el = document.createElement('div');
    el.id = 'ar-instructions';
    el.style.position = 'absolute';
    el.style.right = '12px';
    el.style.top = '12px';
    el.style.maxWidth = '320px';
    el.style.padding = '10px 12px';
    el.style.background = 'rgba(0,0,0,0.6)';
    el.style.color = '#fff';
    el.style.fontFamily = 'sans-serif';
    el.style.fontSize = '14px';
    el.style.borderRadius = '8px';
    el.style.zIndex = '2000';
    el.style.transition = 'opacity 0.4s ease';
    el.innerHTML = 'Point your camera at the postcard image to start the AR demo.';
    document.body.appendChild(el);
    return el;
  }

  const applyVisualTweaks = (name, root) => { /* small heuristics */ root.traverse(c=>{ if(!c.isMesh||!c.material)return; c.material.roughness = c.material.roughness||0.5; c.material.metalness = c.material.metalness||0.1; c.material.envMapIntensity = 0.8; }); };

  // Simple material upgrade helper (safe no-op if props missing)
  function upgradeModelMaterials(root) {
    try {
      root.traverse(n=>{
        if (!n.isMesh || !n.material) return;
        try {
          // preserve existing material where possible, but set PBR-like defaults
          if (typeof n.material.roughness !== 'undefined') n.material.roughness = n.material.roughness ?? 0.5;
          if (typeof n.material.metalness !== 'undefined') n.material.metalness = n.material.metalness ?? 0.1;
          if (typeof n.material.envMapIntensity !== 'undefined') n.material.envMapIntensity = n.material.envMapIntensity ?? 0.8;
          // ensure material.needsUpdate if appropriate
          n.material.needsUpdate = true;
        } catch(e){}
      });
    } catch(e){}
  }

  // AR and scene variables
  let mindarThree = null;
  let renderer = null, scene = null, camera = null, anchor = null;
  let burjModel = null, humanGroup = null, griffinGroup = null, humanGroupRef = null, falconGroupRef = null;

  // Initialize MindAR + Three scene
  try {
    mindarThree = new MindARThree({ container: document.querySelector('#ar-container'), imageTargetSrc: './assets/targets/postcard.mind' });
    ({ renderer, scene, camera } = mindarThree);
    anchor = mindarThree.addAnchor(0);
  } catch(e) { console.warn('MindAR init failed', e); }

  // Loaders
  const gltfLoader = new GLTFLoader();
  const loadBurjKhalifaModel = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/burj_khalifa.glb');
      const model = gltf.scene;
      try { const bbox = new THREE.Box3().setFromObject(model); const h = bbox.max.y-bbox.min.y||0.5; const s = 0.6/h; model.scale.set(s,s,s); bbox.setFromObject(model); const c = bbox.getCenter(new THREE.Vector3()); model.position.sub(c); model.position.y = 0; } catch(e){}
      upgradeModelMaterials(model); applyVisualTweaks('Burj', model);
      const g = new THREE.Group(); g.name='burjModel'; g.add(model); g.userData.originalPosition = new THREE.Vector3(0,0.05,0); g.userData.startPosition = new THREE.Vector3(0,0.02,0); g.userData.baseRotation = 0; return g;
    } catch(e){ console.warn('Burj load failed, using simple fallback', e); const g=new THREE.Group(); const base=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.2), new THREE.MeshBasicMaterial({color:0x666666})); base.position.y=0.05; g.add(base); const b=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.4,0.15), new THREE.MeshBasicMaterial({color:0x888888})); b.position.y=0.3; g.add(b); const s=new THREE.Mesh(new THREE.ConeGeometry(0.02,0.1,8), new THREE.MeshBasicMaterial({color:0xffffff})); s.position.y=0.65; g.add(s); applyVisualTweaks('Burj',g); return g; }
  };

  const loadAnimatedHuman = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/human_man_with_walk.glb');
      const human = gltf.scene;
      // Basic scale & center
      try { const bbox = new THREE.Box3().setFromObject(human); const h = bbox.max.y-bbox.min.y||0.4; const s = 0.4/h; human.scale.set(s,s,s); bbox.setFromObject(human); const bottom=bbox.min.y; human.position.y = -bottom; } catch(e){}
      upgradeModelMaterials(human); applyVisualTweaks('Human', human);

      const group = new THREE.Group(); group.name = 'humanGroup'; group.position.set(0.6,0,0); human.rotation.y = -Math.PI/2; group.add(human);
      // store local offsets
      group.userData.meshLocalY = human.rotation.y||0; group.userData.meshBaseY = human.position.y||0;

      // Setup mixer/actions if animations exist
      if (gltf.animations && gltf.animations.length>0) {
        const mixer = new THREE.AnimationMixer(human);
        const animations = {};
        gltf.animations.forEach(c=>{ animations[c.name]=mixer.clipAction(c); });
        group.userData.mixer = mixer; group.userData.animations = animations; human.userData.mixer = mixer; human.userData.animations = animations;
        // default: play walk if present
        const walkKey = Object.keys(animations).find(k=>/walk/i.test(k)) || Object.keys(animations)[0];
        if (walkKey) { animations[walkKey].setLoop(THREE.LoopRepeat, Infinity); animations[walkKey].play(); group.userData.currentAnimation = walkKey; }
      }

      // Walking metadata
      group.userData.walkingAnimation = { time:0, startX: group.position.x, endX:0.15, speed:0.03, walking:false, baseY:0, stepHeight:0.01, arrived:false };
      return group;
    } catch(e){ console.warn('Human load failed', e); return new THREE.Group(); }
  };

  const loadAnimatedGriffin = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/griffin_fly.glb');
      const model = gltf.scene; upgradeModelMaterials(model); applyVisualTweaks('Griffin', model);
      const g = new THREE.Group(); g.name='falconGroup'; g.add(model);
      // Default placement to left of building
      g.position.set(-0.15, 0.05, 0.1);

      // Compute bounding box and ensure non-zero size; if invalid, set a safe default scale
      try {
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const minSize = 0.0001;
        if (!isFinite(size.y) || size.y < minSize) {
          // fallback scale
          model.scale.setScalar(0.06);
        } else {
          // scale to a reasonable target height for the griffin
          const targetHeight = 0.05;
          const calculatedScale = targetHeight / size.y;
          if (isFinite(calculatedScale) && calculatedScale > 0 && calculatedScale < 100) {
            model.scale.setScalar(calculatedScale);
          }
        }
      } catch(e) {
        model.scale.setScalar(0.06);
      }

      // Flying metadata
      g.userData.flyingAnimation = { time:0, radius:0.2, speed:0.1, heightVariation:0.05, centerOffset:new THREE.Vector3(0,0.3,0), flapFallback:false };

      // If GLTF has animations, wire mixer/actions; otherwise enable flap fallback
      if (gltf.animations && gltf.animations.length>0) {
        const mixer = new THREE.AnimationMixer(model);
        const animations = {};
        gltf.animations.forEach(c=>{ animations[c.name]=mixer.clipAction(c); });
        g.userData.mixer = mixer; g.userData.animations = animations;
        const first = Object.keys(animations)[0];
        if (first) { try { animations[first].setLoop(THREE.LoopRepeat,Infinity); animations[first].play(); } catch(e){} }
      } else {
        // No animations in GLB: enable procedural flap fallback so bird appears lively
        g.userData.flyingAnimation.flapFallback = true;
      }

      // Ensure group is visible
      g.visible = true;

      return g;
    } catch(e){ console.warn('Griffin load failed', e); return new THREE.Group(); }
  };

  // Movement helper (lerp world-local via group.position)
  const moveHumanTo = (group, targetLocal, durationSec=1.2) => {
    if (!group) return Promise.resolve();
    return new Promise(resolve=>{
      if (TRACE_HUMAN) console.log('[TRACE] moveHumanTo START', { start: group.position.clone(), target: targetLocal.clone(), durationSec });
      const startTime = performance.now();
      const from = group.position.clone();
      const animate = ()=>{
        const now = performance.now();
        const elapsed = (now - startTime) / 1000; // seconds
        const t = Math.min(1, elapsed / Math.max(0.0001, durationSec));
        // interpolate position
        group.position.lerpVectors(from, targetLocal, t);
        // bobbing during move if walking metadata exists
        try {
          const w = group.userData && group.userData.walkingAnimation;
          if (w) {
            w.time = elapsed;
            const stepSpeed = w.speed || 0.03;
            const stepHeight = w.stepHeight || 0.01;
            const baseY = w.baseY !== undefined ? w.baseY : (group.userData.meshBaseY || 0);
            group.position.y = baseY + Math.sin(w.time * stepSpeed * 8) * stepHeight;
            // keep mesh facing left while moving for visual consistency
            group.rotation.y = -Math.PI/2;
          }
        } catch(e){}

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // final snap
          group.position.copy(targetLocal);
          try {
            const w = group.userData && group.userData.walkingAnimation;
            if (w) {
              w.arrived = true;
              w.walking = false;
              w.controlledByMove = false; // allow render-loop to resume any final pose logic
            }
            group.userData.hasArrived = true;
            if (TRACE_HUMAN) console.log('[TRACE] moveHumanTo DONE', { end: group.position.clone(), hasArrived: !!group.userData.hasArrived });
          } catch(e){}
          resolve();
        }
      };
      animate();
    });
  };

  // Speech bubble
  const createSpeechBubbleAtHuman = (group, text, url, timeout=8000) => {
    if (!group) return null;
    const existing = document.getElementById('ar-speech-bubble'); if (existing) existing.remove();
    const bubble = document.createElement('div'); bubble.id='ar-speech-bubble'; bubble.style.position='absolute'; bubble.style.background='rgba(255,255,255,0.98)'; bubble.style.color='#111'; bubble.style.padding='10px 14px'; bubble.style.borderRadius='12px'; bubble.style.zIndex='2000'; bubble.innerText = text; document.body.appendChild(bubble);
    const id = setInterval(()=>{
      try {
        const bbox = new THREE.Box3().setFromObject(group);
        const top = new THREE.Vector3((bbox.min.x + bbox.max.x) * 0.5, bbox.max.y, (bbox.min.z + bbox.max.z) * 0.5);
        top.project(camera);
        let x = (top.x*0.5 + 0.5) * window.innerWidth;
        let y = (-top.y*0.5 + 0.5) * window.innerHeight;
        x = Math.round(x); y = Math.round(y - bubble.offsetHeight - 8);
        const padding = 8; x = Math.max(padding, Math.min(x, window.innerWidth - bubble.offsetWidth - padding)); y = Math.max(padding, Math.min(y, window.innerHeight - bubble.offsetHeight - padding));
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
      } catch(e) {
        const wp=new THREE.Vector3(); group.getWorldPosition(wp); wp.y+=0.28; wp.project(camera); let x=(wp.x*0.5+0.5)*window.innerWidth; let y=(-wp.y*0.5+0.5)*window.innerHeight; x=Math.round(x); y=Math.round(y-bubble.offsetHeight-8); const padding=8; x=Math.max(padding,Math.min(x,window.innerWidth-bubble.offsetWidth-padding)); y=Math.max(padding,Math.min(y,window.innerHeight-bubble.offsetHeight-padding)); bubble.style.left=`${x}px`; bubble.style.top=`${y}px`;
      }
    },60);
    bubble.addEventListener('click', ()=>{ try{ if(url) window.open(url,'_blank','noopener,noreferrer'); }catch(e){} });
    const to = setTimeout(()=>{ clearInterval(id); if(bubble.parentNode) bubble.parentNode.removeChild(bubble); }, timeout);
    return { clear: ()=>{ clearInterval(id); clearTimeout(to); if(bubble.parentNode) bubble.parentNode.removeChild(bubble); } };
  };

  // Create UI
  const scanningUI = createScanningUI();
  const instructionsEl = createInstructionsElement();

  // Load assets and add to anchor
  try {
    burjModel = await loadBurjKhalifaModel(); burjModel.position.copy(burjModel.userData?.startPosition||new THREE.Vector3(0,0.02,0)); burjModel.scale.setScalar(0.01); anchor.group.add(burjModel);
    humanGroup = await loadAnimatedHuman(); anchor.group.add(humanGroup); humanGroupRef = humanGroup;
    griffinGroup = await loadAnimatedGriffin(); anchor.group.add(griffinGroup); falconGroupRef = griffinGroup;
  } catch(e){ console.warn('Asset loading error', e); }

  // Show demo sequence when target found
  anchor.onTargetFound = () => {
    // Hide scanning UI
    scanningUI.style.opacity = '0';
    scanningUI.style.transition = 'opacity 0.5s ease-out';
    setTimeout(()=>{ scanningUI.style.display='none'; },500);

    // Grow Burj
    if (burjModel) {
      burjModel.scale.setScalar(0.01);
      const duration = 1000;
      const startTime = Date.now();
      const startScale = burjModel.scale.clone();
      const endScale = new THREE.Vector3(1,1,1);
      const startPos = burjModel.userData?.startPosition?.clone()||burjModel.position.clone();
      const endPos = burjModel.userData?.originalPosition?.clone()||new THREE.Vector3(0,0.05,0);
      burjModel.userData.isRising = true;
      const grow = ()=>{
        const elapsed = Date.now()-startTime;
        const p = Math.min(1, elapsed/duration);
        const e = 1-Math.pow(1-p,3);
        burjModel.scale.lerpVectors(startScale,endScale,e);
        burjModel.position.lerpVectors(startPos,endPos,e);
        if(p<1) requestAnimationFrame(grow);
        else { burjModel.userData.isRising=false; burjModel.scale.copy(endScale); burjModel.position.copy(endPos); }
      };
      grow();

      (async ()=>{
        await new Promise(r=>setTimeout(r,duration+250));
        try {
          if (!(humanGroup && burjModel)) return;

          // Compute safe target beside Burj
          const burjBox = new THREE.Box3().setFromObject(burjModel);
          const burjSize = burjBox.getSize(new THREE.Vector3());
          const burjCenter = burjBox.getCenter(new THREE.Vector3());
          const clearance = Math.max(burjSize.x, burjSize.z) * 0.6;
          const target = (burjModel.userData?.originalPosition||burjCenter).clone();
          target.x = target.x + clearance + 0.05; target.y = 0; target.z = target.z + (burjSize.z*0.1);

          // Play only walk animation if present
          if (humanGroup.userData?.animations) {
            const anims = humanGroup.userData.animations;
            const walkKey = Object.keys(anims).find(k=>/walk/i.test(k));
            Object.keys(anims).forEach(k=>{ try{ if(k!==walkKey){ anims[k].paused = true; anims[k].stop && anims[k].stop(); } }catch(e){} });
            if (walkKey) { try{ anims[walkKey].setLoop(THREE.LoopRepeat,Infinity); anims[walkKey].play(); if(TRACE_HUMAN) console.log('[TRACE] walkAction.play()',walkKey);}catch(e){} }
          }

          // Compute world-based distance and duration
          const startWorld = humanGroup.getWorldPosition(new THREE.Vector3());
          const targetWorld = anchor.group.localToWorld(target.clone());
          const distanceWorld = startWorld.distanceTo(targetWorld);
          const rawDuration = distanceWorld / (humanGroup.userData?.walkingAnimation?.speed || 0.03);
          const durationSeconds = Math.min(8, Math.max(1.2, rawDuration));
          if (TRACE_HUMAN) console.log('[TRACE] computed walk duration (s)', { distanceWorld, rawDuration, durationSeconds });

          // Prepare walking metadata and pause descendant mixers to avoid root-motion
          try {
            if (humanGroup.userData && humanGroup.userData.walkingAnimation) {
              const w = humanGroup.userData.walkingAnimation;
              w.controlledByMove = true; w.time = 0; w.startX = humanGroup.position.x; w.baseY = w.baseY || (humanGroup.userData.meshBaseY || 0); w.stepHeight = w.stepHeight || 0.01; w.walking = false;
              try { humanGroup.traverse(n=>{ if (n.userData && n.userData.mixer) { n.userData.mixerPaused = true; } }); } catch(e){}
            }
          } catch(e){}

          // Ensure griffin is active
          try { if (falconGroupRef && falconGroupRef.userData && falconGroupRef.userData.flyingAnimation) { falconGroupRef.userData.flyingAnimation.time = 0; } if (falconGroupRef && falconGroupRef.userData && falconGroupRef.userData.mixer) { Object.values(falconGroupRef.userData.animations || {}).forEach(a=>{ try{ a.play(); }catch(e){} }); } } catch(e){}

          // Move the human
          await moveHumanTo(humanGroup, target, durationSeconds);

          // On arrival: face camera, mark arrived and stabilize pose
          try {
            const humanWorldPos = new THREE.Vector3(); humanGroup.getWorldPosition(humanWorldPos);
            const cameraWorldPos = new THREE.Vector3(); camera.getWorldPosition(cameraWorldPos);
            const lookDir = cameraWorldPos.clone().sub(humanWorldPos).normalize();
            const targetYWorld = Math.atan2(lookDir.x, lookDir.z);
            const meshLocalY = humanGroup.userData?.meshLocalY || 0;
            const targetGroupY = targetYWorld - meshLocalY;
            humanGroup.rotation.y = targetGroupY;

            humanGroup.userData.walkingAnimation = humanGroup.userData.walkingAnimation || {};
            humanGroup.userData.walkingAnimation.arrived = true;
            humanGroup.userData.hasArrived = true;
            if (TRACE_HUMAN) console.log('[TRACE] humanGroup hasArrived set');

            // Restore mesh local rotation only
            try { humanGroup.traverse(c=>{ if(c.isMesh){ if(humanGroup.userData.meshLocalY!==undefined) c.rotation.y = humanGroup.userData.meshLocalY; } }); } catch(e){}

            // Stabilize animations: crossfade to idle if present, otherwise freeze final walk frame
            try {
              humanGroup.traverse(n=>{
                try {
                  const mixer = n.userData && n.userData.mixer;
                  const animations = (n.userData && n.userData.animations) || {};
                  if (!mixer) return;
                  // briefly unpause to apply poses
                  n.userData.mixerPaused = false; mixer.update(0.0001);
                  const idleKey = Object.keys(animations).find(k=>/idle|stand|pose/i.test(k));
                  const walkKey = Object.keys(animations).find(k=>/walk/i.test(k));
                  if (idleKey && animations[idleKey]) {
                    try {
                      if (walkKey && animations[walkKey]) {
                        try { animations[walkKey].fadeOut && animations[walkKey].fadeOut(0.15); } catch(e){}
                      }
                      const idleAct = animations[idleKey];
                      idleAct.reset();
                      idleAct.setLoop(THREE.LoopRepeat, Infinity);
                      idleAct.fadeIn && idleAct.fadeIn(0.15);
                      idleAct.play();
                      mixer.update(0.02);
                      n.userData.mixerPaused = true;
                      mixer.timeScale = 0;
                    } catch(e){}
                  } else if (walkKey && animations[walkKey]) {
                    try {
                      const walkAct = animations[walkKey];
                      const clipDur = (walkAct.getClip && walkAct.getClip().duration) ? walkAct.getClip().duration : 0;
                      mixer.setTime(clipDur);
                      mixer.timeScale = 0;
                      walkAct.paused = true;
                      n.userData.mixerPaused = true;
                    } catch(e){}
                  }
                } catch(e){}
              });
            } catch(e) { if (TRACE_HUMAN) console.warn('[TRACE] arrival mixer handling failed', e); }

            // Show popup
            createSpeechBubbleAtHuman(humanGroup, 'Click here to find out more about the Burj Khalifa', 'https://www.burjkhalifa.ae/');

          } catch(e) { if(TRACE_HUMAN) console.warn('[TRACE] arrival facing failed', e); }

        } catch(e) { if(TRACE_HUMAN) console.warn('[TRACE] demo sequence failed', e); }
      })();
    }

    // Hide instructions after a bit
    setTimeout(()=>{ instructionsEl.style.opacity='0'; setTimeout(()=>{ if(instructionsEl.parentNode) instructionsEl.parentNode.removeChild(instructionsEl); },500); },5000);
  };

  anchor.onTargetLost = ()=>{ scanningUI.style.display='flex'; setTimeout(()=>{ scanningUI.style.opacity='1'; },10); };

  // Main loop
  const clock = new THREE.Clock();
  await mindarThree.start();
  renderer.setAnimationLoop(()=>{
    const delta = clock.getDelta();

    // Update mixers except arrived objects
    const updated = new Set();
    const updateMixers = (obj)=>{
      // Skip mixer updates if object flagged as arrived or explicitly paused (to prevent root-motion during move)
      if (obj.userData?.mixer && !obj.userData?.hasArrived && !obj.userData?.mixerPaused) {
        if (!updated.has(obj.userData.mixer)) { obj.userData.mixer.update(delta); updated.add(obj.userData.mixer); }
      }
      obj.children?.forEach(c=>updateMixers(c));
    };
    updateMixers(anchor.group);

    if (TRACE_HUMAN) {
      anchor.group.traverse(child=>{ if(child.name==='humanGroup'){ const wp = child.getWorldPosition(new THREE.Vector3()); console.log('[TRACE] humanGroup worldPos', wp.toArray(), 'hasArrived=', !!child.userData.hasArrived); } });
    }

    // Burj rotation
    if (burjModel && burjModel.userData) { if(!burjModel.userData.isRising && burjModel.userData.originalPosition) burjModel.position.copy(burjModel.userData.originalPosition); burjModel.userData.baseRotation += 0.005; burjModel.rotation.y = burjModel.userData.baseRotation; }

    // Griffin flying
    anchor.group.traverse(child=>{
      if (child.name==='falconGroup' && child.userData?.flyingAnimation) {
        const d = child.userData.flyingAnimation;
        d.time += delta;
        const angle = d.time * d.speed * Math.PI * 2;
        const x = Math.cos(angle)*d.radius;
        const z = Math.sin(angle)*d.radius;
        const h = Math.sin(d.time*d.speed*4)*d.heightVariation;
        child.position.x = d.centerOffset.x + x;
        child.position.y = d.centerOffset.y + h;
        child.position.z = d.centerOffset.z + z;
        child.rotation.y = (angle+Math.PI)*0.6;
        child.rotation.z = Math.sin(d.time*d.speed*2)*0.1;

        // Procedural flap fallback: rotate wings or whole model subtly if no GLTF animations
        if (d.flapFallback) {
          // attempt to find wing bones/meshes by name heuristics
          const flapAngle = Math.sin(d.time * d.speed * 10) * 0.6;
          child.traverse(n=>{
            if (n.isMesh && /wing|wing_l|left_wing|right_wing|feather/i.test(n.name)) {
              // alternate left/right based on name
              if (/left|_l|\.l$/i.test(n.name)) n.rotation.z = flapAngle * 0.75;
              else if (/right|_r|\.r$/i.test(n.name)) n.rotation.z = -flapAngle * 0.75;
              else n.rotation.x = flapAngle * 0.4;
            }
          });
          // if no wing meshes found, apply a subtle body tilt
          if (!child.userData._flapHeuristicsChecked) {
            let found=false; child.traverse(n=>{ if(n.isMesh && /wing|feather/i.test(n.name)) found=true; }); child.userData._flapHeuristicsChecked = true; child.userData._hasWingMeshes = found;
          }
          if (!child.userData._hasWingMeshes) {
            child.rotation.z = Math.sin(d.time * d.speed * 6) * 0.08;
          }
        }
      }
      if (child.name==='humanGroup' && child.userData?.walkingAnimation) {
        const w = child.userData.walkingAnimation;
        // If the movement is being driven by moveHumanTo, skip positional updates here to avoid conflicts
        if (w.controlledByMove) {
          // still update bobbing for visual continuity if desired, but don't change x position
          if (w.arrived) return;
          w.time += delta;
          try {
            const baseY = w.baseY !== undefined ? w.baseY : (child.userData.meshBaseY || 0);
            const stepHeight = w.stepHeight || 0.01;
            const stepSpeed = w.speed || 0.03;
            child.position.y = baseY + Math.sin(w.time * stepSpeed * 8) * stepHeight;
            child.rotation.y = -Math.PI/2;
          } catch(e) {}
          return;
        }

        if(!w.walking) return; if(w.arrived) return; w.time += delta; const startX=w.startX, endX=w.endX, dist=Math.abs(endX-startX); const dir = endX>=startX?1:-1; const speed = w.speed||0.3; const progress = Math.min(1, (w.time*speed)/Math.max(dist,0.0001)); child.position.x = startX + (progress*dist*dir); child.position.y = w.baseY + Math.sin(w.time*speed*8)*w.stepHeight; child.rotation.y = -Math.PI/2; if(progress>=1){ w.arrived=true; w.walking=false; child.rotation.y=0; try{ if(child.userData?.mixer) { Object.values(child.userData.animations||{}).forEach(a=>{ try{ a.setLoop(THREE.LoopOnce,0); a.clampWhenFinished=true; a.play && a.play(); }catch(e){} }); } }catch(e){} createSpeechBubbleAtHuman(child,'Click here to find out more about the Burj Khalifa','https://www.burjkhalifa.ae/'); }
      }
    });

    renderer.render(scene, camera);
  });

  // Cleanup
  window.addEventListener('beforeunload', ()=>{ try{ mindarThree && mindarThree.stop(); }catch(e){} });

});