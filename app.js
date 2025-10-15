import { MindARThree } from "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/GLTFLoader.js";


document.addEventListener("DOMContentLoaded", async () => {
 
// AR and scene variables
  let mindarThree = null;
  let renderer = null, scene = null, camera = null, anchor = null;
  let burjModel = null;
  let griffinGroup = null, falconGroupRef = null;
  let rooeyGroup = null;

  function createInstructionsElement() {
    const el = document.createElement('div');
    el.id = 'ar-instructions';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.top = '12px';
    el.style.transform = 'translateX(-50%)';
    el.style.maxWidth = '80%';
    el.style.padding = '10px 12px';
    el.style.background = 'rgba(0,0,0,0.6)';
    el.style.color = '#fff';
    el.style.fontFamily = 'sans-serif';
    el.style.fontSize = '14px';
    el.style.borderRadius = '8px';
    el.style.zIndex = '2000';
    el.style.transition = 'opacity 0.4s ease';
    el.style.textAlign = 'center';
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

  // Loaders
  const gltfLoader = new GLTFLoader();
  const loadRooey = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/Rooey.glb');
      const rooey = gltf.scene;
      try { rooey.traverse(n=>{ if(n.isMesh){ n.frustumCulled = false; if (n.material) { n.material.needsUpdate = true; } } }); } catch(e){}
      // Scale to a conservative target height with clamping, then center/ground
      try {
        const bbox0 = new THREE.Box3().setFromObject(rooey);
        const h0 = bbox0.max.y - bbox0.min.y;
        let scale = 0.08; // fallback
        if (isFinite(h0) && h0 > 0.0001) {
          const targetHeight = 0.12; // ~12cm in AR units
          scale = targetHeight / h0;
          scale = Math.max(0.02, Math.min(scale, 0.18));
        }
        rooey.scale.setScalar(scale);
        // recenter and ground
        const bbox1 = new THREE.Box3().setFromObject(rooey);
        const center1 = bbox1.getCenter(new THREE.Vector3());
        rooey.position.sub(center1);
        const bbox2 = new THREE.Box3().setFromObject(rooey);
        rooey.position.y -= bbox2.min.y;
      } catch(e){}
      upgradeModelMaterials(rooey); applyVisualTweaks('Rooey', rooey);

      const group = new THREE.Group(); group.name = 'rooeyGroup'; group.add(rooey);
      // Place Rooey on the right side (slightly closer to center)
      group.position.set(0.35, 0, 0);

      // Create a stable bubble anchor above Rooey's head to avoid per-frame bbox jitter
      try {
        const bboxFinal = new THREE.Box3().setFromObject(rooey);
        const heightLocal = Math.max(0.01, bboxFinal.max.y - bboxFinal.min.y);
        const bubbleAnchor = new THREE.Object3D();
        bubbleAnchor.name = 'rooeyBubbleAnchor';
        bubbleAnchor.position.set(0, heightLocal * 30.5, 0);
        group.add(bubbleAnchor);
        group.userData.bubbleAnchor = bubbleAnchor;
        group.userData.modelHeight = heightLocal;
      } catch(e){}

      // (removed) debug ground marker

      // Wire animations if present
      if (gltf.animations && gltf.animations.length>0) {
        const mixer = new THREE.AnimationMixer(rooey);
        const animations = {};
        gltf.animations.forEach(c=>{ animations[c.name]=mixer.clipAction(c); });
        group.userData.mixer = mixer; group.userData.animations = animations; rooey.userData.mixer = mixer; rooey.userData.animations = animations;
      }
      return group;
    } catch(e) { console.warn('Rooey load failed', e); return new THREE.Group(); }
  };
  const loadBurjKhalifaModel = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/burj_khalifa.glb');
      const model = gltf.scene;
      try { const bbox = new THREE.Box3().setFromObject(model); const h = bbox.max.y-bbox.min.y||0.5; const s = 0.6/h; model.scale.set(s,s,s); bbox.setFromObject(model); const c = bbox.getCenter(new THREE.Vector3()); model.position.sub(c); model.position.y = 0; } catch(e){}
      upgradeModelMaterials(model); applyVisualTweaks('Burj', model);
      const g = new THREE.Group(); g.name='burjModel'; g.add(model); g.userData.originalPosition = new THREE.Vector3(0,0.05,0); g.userData.startPosition = new THREE.Vector3(0,0.02,0); g.userData.baseRotation = 0; return g;
    } catch(e){ console.warn('Burj load failed, using simple fallback', e); const g=new THREE.Group(); const base=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.2), new THREE.MeshBasicMaterial({color:0x666666})); base.position.y=0.05; g.add(base); const b=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.4,0.15), new THREE.MeshBasicMaterial({color:0x888888})); b.position.y=0.3; g.add(b); const s=new THREE.Mesh(new THREE.ConeGeometry(0.02,0.1,8), new THREE.MeshBasicMaterial({color:0xffffff})); s.position.y=0.65; g.add(s); applyVisualTweaks('Burj',g); return g; }
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

      // If GLTF has animations, wire mixer/actions; otherwise enable flap fallback.
      // If animations exist but none seem like a wing/fly animation, still enable procedural flap fallback.
      if (gltf.animations && gltf.animations.length>0) {
        const mixer = new THREE.AnimationMixer(model);
        const animations = {};
        gltf.animations.forEach(c=>{ animations[c.name]=mixer.clipAction(c); });
        g.userData.mixer = mixer; g.userData.animations = animations;
        const keys = Object.keys(animations);
        const first = keys[0];
        if (first) { try { animations[first].setLoop(THREE.LoopRepeat,Infinity); animations[first].play(); } catch(e){} }
        const hasWingLikeAnim = keys.some(k=> /fly|flap|wing|glide|soar|flapping/i.test(k));
        g.userData.flyingAnimation.flapFallback = !hasWingLikeAnim;
      } else {
        // No animations in GLB: enable procedural flap fallback so bird appears lively
        g.userData.flyingAnimation.flapFallback = true;
      }

      // Ensure group is visible
      g.visible = true;

      return g;
    } catch(e){ console.warn('Griffin load failed', e); return new THREE.Group(); }
  };

  // [removed] loadHumanWaving

  // [removed] loadDancingMonkey

  // Initialize MindAR + Three scene
  try {
    mindarThree = new MindARThree({ container: document.querySelector('#ar-container'), imageTargetSrc: './assets/targets/postcard.mind' });
    ({ renderer, scene, camera } = mindarThree);
    anchor = mindarThree.addAnchor(0);
  } catch(e) { console.warn('MindAR init failed', e); }

  // Add simple lighting so PBR materials in GLTFs are visible (prevents models appearing black)
  try {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0.5, 1, 0.5);
    scene.add(dirLight);
  } catch(e) {
    console.warn('Adding lights failed', e);
  }

  // Create UI
    const instructionsEl = createInstructionsElement();

  // [removed] human speech bubble
  function createRooeySpeechBubble() {
    const el = document.createElement('div');
    el.id = 'rooey-speech-bubble';
    el.style.position = 'fixed';
    el.style.zIndex = '3000';
    el.style.pointerEvents = 'auto';
    el.style.transform = 'translate(-50%, -100%)';
    el.style.display = 'none';
    el.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    el.style.color = '#fff';
    el.style.padding = '14px 16px';
    el.style.borderRadius = '16px';
    el.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4), 0 4px 8px rgba(0,0,0,0.15)';
    el.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    el.style.fontSize = '14px';
    el.style.textAlign = 'left';
    el.style.maxWidth = '240px';
    el.style.cursor = 'pointer';
    el.style.border = '2px solid rgba(255,255,255,0.2)';
    el.style.backdropFilter = 'blur(10px)';
    el.style.transition = 'transform 0.2s ease';

    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;font-size:15px;display:flex;align-items:center;gap:6px;">
        <span>G'day! I'm Rooey</span>
        <span style="font-size:18px;">🦘</span>
      </div>
      <div>
        <a id="rooey-bubble-link" 
           href="https://www.engagesydney.com.au/" 
           target="_blank" 
           rel="noopener noreferrer" 
           style="color:#fff;text-decoration:none;font-weight:600;background:rgba(255,255,255,0.15);padding:6px 12px;border-radius:8px;display:inline-block;transition:all 0.2s ease;">
          Tap to visit our Vision →
        </a>
      </div>
    `;

    // Hover effect
    el.addEventListener('mouseenter', ()=> {
      el.style.transform = 'translate(-50%, -100%) scale(1.05)';
    });
    el.addEventListener('mouseleave', ()=> {
      el.style.transform = 'translate(-50%, -100%) scale(1)';
    });

    el.addEventListener('click', (e)=>{ 
      try{ window.open('https://www.engagesydney.com.au/','_blank','noopener'); }catch(err){} 
    });

    document.body.appendChild(el);
    return el;
  }
  const rooeySpeechBubbleEl = createRooeySpeechBubble();
  let rooeyBubbleScreenPos = { x: null, y: null };

  burjModel = await loadBurjKhalifaModel();
  burjModel.position.copy(burjModel.userData?.startPosition||new THREE.Vector3(0,0.02,0));
  // Start hidden — we'll simply show the model when the target is found (no grow animation)
  burjModel.visible = false;
  anchor.group.add(burjModel);
  // Load griffin and add to anchor (hidden by default)
  griffinGroup = await loadAnimatedGriffin();
  griffinGroup.visible = false;
  anchor.group.add(griffinGroup);
  falconGroupRef = griffinGroup;
  // [removed] humanWavingGroup
  // [removed] dancingMonkeyGroup
  // Load Rooey (hidden by default)
  rooeyGroup = await loadRooey();
  rooeyGroup.visible = false;
  anchor.group.add(rooeyGroup);
 
  // Show demo sequence when target found
  anchor.onTargetFound = () => {
    
    // Show the Burj immediately when the target is detected (no grow animation)
    try {
      if (burjModel) {
        burjModel.visible = true;
        
        // ensure it's at the intended final position/scale
        burjModel.position.copy(burjModel.userData?.originalPosition || new THREE.Vector3(0,0.05,0));
        burjModel.scale.setScalar(1);
        // Also reveal the griffin(s) and start their animations if available
        try {
          if (griffinGroup) {
            griffinGroup.visible = true;
            try { const anims = griffinGroup.userData?.animations || (falconGroupRef && falconGroupRef.userData && falconGroupRef.userData.animations) || {}; Object.values(anims).forEach(a=>{ try{ a.play && a.play(); }catch(e){} }); } catch(e){}
          }
        } catch(e) {}
        // [removed] human reveal and placement
        // [removed] dancing monkey reveal

        // Reveal Rooey and sequence animations
        try {
          if (rooeyGroup) {
            rooeyGroup.visible = true;
            // Face camera only (no dynamic reposition)
            try { const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos); const worldPos = rooeyGroup.getWorldPosition(new THREE.Vector3()); const lookDir = camPos.clone().sub(worldPos).normalize(); const targetY = Math.atan2(lookDir.x, lookDir.z); rooeyGroup.rotation.y = targetY; } catch(e){}

            // sequential animation playback by name (case-insensitive contains)
            const runSequence = async () => {
              try {
                const mixer = rooeyGroup.userData?.mixer;
                const anims = rooeyGroup.userData?.animations || {};
                const names = Object.keys(anims);
                const pick = (regexArr)=> names.find(n=> regexArr.some(r=> r.test(n)));
                const seq = [
                  pick([/hop/i, /arms\s*raised/i, /hop.*arm/i]),
                  pick([/wave/i, /one\s*hand/i, /wave.*hand/i]),
                  pick([/stand/i, /chat/i, /talk/i])
                ].filter(Boolean);

                // Start each loop clean to avoid leftover blended states causing skips
                try {
                  Object.values(anims).forEach(a=>{ try{ a.stop(); a.reset(); a.enabled = true; }catch(_){} });
                } catch(_){}

                let previousAction = null;

                const playOnce = (name)=> new Promise(resolve=>{
                  try {
                    const act = anims[name];
                    if (!act) return resolve();
                    act.reset();
                    act.setLoop(THREE.LoopOnce, 0);
                    act.clampWhenFinished = true;
                    act.enabled = true;
                    // Crossfade from previous to this to avoid T-pose snapping
                    try {
                      if (previousAction && previousAction !== act) {
                        // ensure target is playing before crossfade for stability
                        act.fadeIn && act.fadeIn(0.12);
                        previousAction.crossFadeTo(act, 0.25, false);
                        act.play();
                      } else {
                        // first action in the loop
                        act.fadeIn && act.fadeIn(0.12);
                        act.play();
                      }
                    } catch(_){ act.play(); }
                    const onFinished = (e)=>{
                      try {
                        if (!e || e.action !== act) return; // ignore other actions finishing
                        mixer.removeEventListener('finished', onFinished);
                      } catch(_){}
                      // Keep final pose (clamped) as the starting point for next crossfade
                      previousAction = act;
                      resolve();
                    };
                    try { mixer.addEventListener('finished', onFinished); } catch(e) { previousAction = act; resolve(); }
                  } catch(e) { resolve(); }
                });

                // If no mixer or no seq, try to play first available animation
                if (!mixer || seq.length===0) {
                  const first = names[0];
                  if (first && anims[first]) {
                    try { anims[first].setLoop(THREE.LoopRepeat, Infinity); anims[first].play(); } catch(e){}
                  }
                  return;
                }

                // run through sequence
                mixer.timeScale = 1;
                for (const key of seq) {
                  await playOnce(key);
                }
                // After sequence completes, wait 1 second then repeat
                setTimeout(() => {
                  runSequence(); // Repeat the entire sequence
                }, 1000);
              } catch(e){}
            };

            runSequence();
          }
        } catch(e) {}
      }
    } catch(e) { console.warn('onTargetFound handling failed', e); }

    // Hide the instructions banner (we remove it after a short fade)
    try {
      instructionsEl.style.opacity = '0';
      setTimeout(()=>{ if(instructionsEl.parentNode) instructionsEl.parentNode.removeChild(instructionsEl); },500);
    } catch(e){}
  };

  // When the target is lost, hide the Burj again
  anchor.onTargetLost = () => {
    try { if (burjModel) burjModel.visible = false; } catch(e){}
    try {
      if (griffinGroup) {
        // stop animations if present
        try { Object.values(griffinGroup.userData?.animations || {}).forEach(a=>{ try{ a.stop && a.stop(); }catch(e){} }); } catch(e){}
        griffinGroup.visible = false;
      }
    } catch(e){}
    // [removed] dancing monkey lost handling
    // [removed] human lost handling
    try {
      if (rooeyGroup) {
        try { Object.values(rooeyGroup.userData?.animations || {}).forEach(a=>{ try{ a.stop && a.stop(); }catch(e){} }); } catch(e){}
        rooeyGroup.visible = false;
      }
    } catch(e){}
  };

  // Main loop - start MindAR and begin rendering
  const clock = new THREE.Clock();
  await mindarThree.start();
  renderer.setAnimationLoop(()=>{
    const delta = clock.getDelta();
    // Update mixers (advance GLTF animations)
    const updated = new Set();
    const updateMixers = (obj)=>{
      if (obj.userData?.mixer && !obj.userData?.hasArrived && !obj.userData?.mixerPaused) {
        if (!updated.has(obj.userData.mixer)) { obj.userData.mixer.update(delta); updated.add(obj.userData.mixer); }
      }
      obj.children?.forEach(c=>updateMixers(c));
    };
    updateMixers(anchor.group);

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
        child.rotation.y = angle - Math.PI/2;
        //child.rotation.z = Math.sin(d.time*d.speed*2)*0.1;

        // Procedural flap fallback
        if (d.flapFallback) {
          const flapAngle = Math.sin(d.time * d.speed * 6) * 0.7; // smoother, gentler flap
          child.traverse(n=>{
            if ((n.isMesh || n.isBone) && /wing|wing_l|left_wing|right_wing|feather|primary|secondary|flap/i.test(n.name)) {
              if (/left|_l|\.l$/i.test(n.name)) n.rotation.z = flapAngle * 1.0;
              else if (/right|_r|\.r$/i.test(n.name)) n.rotation.z = -flapAngle * 1.0;
              else n.rotation.x = flapAngle * 0.6;
            }
          });
          if (!child.userData._flapHeuristicsChecked) {
            let found=false; child.traverse(n=>{ if((n.isMesh||n.isBone) && /wing|feather|primary|secondary/i.test(n.name)) found=true; }); child.userData._flapHeuristicsChecked = true; child.userData._hasWingMeshes = found;
          }
          if (!child.userData._hasWingMeshes) {
            child.rotation.z = Math.sin(d.time * d.speed * 6) * 0.12; // slightly larger body tilt
          }
        }
      }
    });

    renderer.render(scene, camera);
    // Update speech bubble position and visibility after render calculations
    // [removed] human speech bubble update

    // Update Rooey speech bubble position (use a fixed bubble anchor for stability)
    try {
      if (rooeySpeechBubbleEl) {
        if (rooeyGroup && rooeyGroup.visible) {
          let targetWorld;
          try {
            const anchorObj = rooeyGroup.userData && rooeyGroup.userData.bubbleAnchor;
            if (anchorObj) {
              targetWorld = anchorObj.getWorldPosition(new THREE.Vector3());
              // small right offset in object space: project a point to the right
              try {
                const rightOffset = new THREE.Vector3(rooeyGroup.userData.modelHeight * 0.35, 0, 0);
                anchorObj.localToWorld(rightOffset);
                // replace only x to shift right slightly in screen space
                targetWorld.x = rightOffset.x;
              } catch(e){}
            } else {
              targetWorld = rooeyGroup.getWorldPosition(new THREE.Vector3());
              targetWorld.y += 0.5;
              targetWorld.x += 0.14;
            }
          } catch(e) { targetWorld = rooeyGroup.getWorldPosition(new THREE.Vector3()); }
          const proj = targetWorld.project(camera);
          // Convert to screen coordinates
          let x = (proj.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          let y = (-proj.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          // Clamp inside viewport with padding
          const pad = 8;
          x = Math.max(pad, Math.min(x, renderer.domElement.clientWidth - pad));
          y = Math.max(pad, Math.min(y, renderer.domElement.clientHeight - pad));
          // Smooth to reduce jitter
          const alpha = 0.12;
          if (rooeyBubbleScreenPos.x === null) {
            rooeyBubbleScreenPos.x = x;
            rooeyBubbleScreenPos.y = y;
          } else {
            rooeyBubbleScreenPos.x += (x - rooeyBubbleScreenPos.x) * alpha;
            rooeyBubbleScreenPos.y += (y - rooeyBubbleScreenPos.y) * alpha;
          }
          // Snap to integer pixels to avoid subpixel shimmering
          rooeySpeechBubbleEl.style.left = `${Math.round(rooeyBubbleScreenPos.x)}px`;
          rooeySpeechBubbleEl.style.top = `${Math.round(rooeyBubbleScreenPos.y)}px`;
          rooeySpeechBubbleEl.style.display = 'block';
        } else {
          rooeySpeechBubbleEl.style.display = 'none';
          // Reset smoothing when hidden
          rooeyBubbleScreenPos.x = null; rooeyBubbleScreenPos.y = null;
        }
      }
    } catch(e){}
  });
});