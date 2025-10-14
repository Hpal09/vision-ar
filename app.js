import { MindARThree } from "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/GLTFLoader.js";


document.addEventListener("DOMContentLoaded", async () => {
 
// AR and scene variables
  let mindarThree = null;
  let renderer = null, scene = null, camera = null, anchor = null;
  let burjModel = null;
  let griffinGroup = null, falconGroupRef = null;
  let humanWavingGroup = null;
  let dancingMonkeyGroup = null;

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

  // Loader for waving human (appears right of Burj and waves at camera)
  const loadHumanWaving = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/human_man_waving.glb');
      const human = gltf.scene;
      // Basic scale & center
      try { const bbox = new THREE.Box3().setFromObject(human); const h = bbox.max.y-bbox.min.y||0.4; const s = 0.4/h; human.scale.set(s,s,s); bbox.setFromObject(human); const bottom=bbox.min.y; human.position.y = -bottom; } catch(e){}
      upgradeModelMaterials(human); applyVisualTweaks('HumanWave', human);

      // If the GLB has missing textures, apply Wolf3D-style color fallbacks using exact mesh names
      try {
        human.traverse(n=>{
          if (!n.isMesh || !n.material) return;
          const name = (n.name || '').toLowerCase();
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m=>{
            try {
              if (m.map) return; // preserve textured materials
              let colorHex = 0xbfbfbf; // default neutral

              // Wolf3D-specific names from Blender: Wolf3D_Head, Wolf3D_Hair, Wolf3D_Outfit_Top, Wolf3D_Outfit_Bottom, Wolf3D_Outfit_Footwear, Wolf3D_Glasses, Wolf3D_Teeth, EyeLeft, EyeRight
              if (/wolf3d_head|wolf3d_body|head|face|skin|body/.test(name)) colorHex = 0xd8b6a0; // skin tone
              else if (/wolf3d_hair|hair/.test(name)) colorHex = 0x2b1f14; // dark hair
              else if (/wolf3d_outfit_top|outfit_top|wolf3d_outfit_top|top|shirt|torso|chest/.test(name)) colorHex = 0x2b69b3; // blue top
              else if (/wolf3d_outfit_bottom|outfit_bottom|pants|trouser|leg|lower/.test(name)) colorHex = 0x2f2f2f; // dark bottoms
              else if (/wolf3d_outfit_footwear|outfit_footwear|shoe|boot|foot/.test(name)) colorHex = 0x111111; // shoes
              else if (/wolf3d_glasses|glasses/.test(name)) colorHex = 0x333333; // glasses/frame
              else if (/wolf3d_teeth|tooth|teeth/.test(name)) colorHex = 0xffffff;
              else if (/eyeleft|eyeright|eye/.test(name)) colorHex = 0x111111;

              if (m.color && colorHex) m.color.setHex(colorHex);
              m.roughness = (typeof m.roughness !== 'undefined') ? (m.roughness ?? 0.6) : 0.6;
              m.metalness = (typeof m.metalness !== 'undefined') ? (m.metalness ?? 0) : 0;
              m.envMapIntensity = m.envMapIntensity ?? 0.8;
              m.needsUpdate = true;
            } catch(e){}
          });
        });
      } catch(e) { console.warn('Human material fallback failed', e); }

      const group = new THREE.Group(); group.name = 'humanWavingGroup'; group.add(human);
      group.position.set(0.6,0,0);
      // Wire animations if present
      if (gltf.animations && gltf.animations.length>0) {
        const mixer = new THREE.AnimationMixer(human);
        const animations = {};
        gltf.animations.forEach(c=>{ animations[c.name]=mixer.clipAction(c); });
        group.userData.mixer = mixer; group.userData.animations = animations; human.userData.mixer = mixer; human.userData.animations = animations;
        // try to find a wave animation
        const waveKey = Object.keys(animations).find(k=>/wave|waving|hand_wave|arm_wave/i.test(k)) || Object.keys(animations)[0];
        if (waveKey && animations[waveKey]) {
          try { animations[waveKey].setLoop(THREE.LoopRepeat, Infinity); animations[waveKey].play(); group.userData.currentAnimation = waveKey; } catch(e){}
        }
      }
      return group;
    } catch(e) { console.warn('Human waving load failed', e); return new THREE.Group(); }
  };

  // Loader for dancing monkey (we'll place it to the left of the Burj and play dance animation)
  const loadDancingMonkey = async () => {
    try {
      const gltf = await gltfLoader.loadAsync('./assets/targets/Dancing_Monkey.glb');
      const monkey = gltf.scene;
      // Basic scale & center
      try { const bbox = new THREE.Box3().setFromObject(monkey); const h = bbox.max.y-bbox.min.y||0.4; const s = 0.4/h; monkey.scale.set(s,s,s); bbox.setFromObject(monkey); const bottom=bbox.min.y; monkey.position.y = -bottom; } catch(e){}
      upgradeModelMaterials(monkey); applyVisualTweaks('DancingMonkey', monkey);

      const group = new THREE.Group(); group.name = 'dancingMonkeyGroup'; group.add(monkey);
      group.position.set(-0.6,0,0);

      // Wire animations if present
      if (gltf.animations && gltf.animations.length>0) {
        const mixer = new THREE.AnimationMixer(monkey);
        const animations = {};
        gltf.animations.forEach(c=>{ animations[c.name]=mixer.clipAction(c); });
        group.userData.mixer = mixer; group.userData.animations = animations; monkey.userData.mixer = mixer; monkey.userData.animations = animations;
        // try to find a dance animation
        const danceKey = Object.keys(animations).find(k=>/dance|dancing|hiphop|ballet|groove/i.test(k)) || Object.keys(animations)[0];
        if (danceKey && animations[danceKey]) {
          try { animations[danceKey].setLoop(THREE.LoopRepeat, Infinity); animations[danceKey].play(); group.userData.currentAnimation = danceKey; } catch(e){}
        }
      }

      return group;
    } catch(e) { console.warn('Dancing monkey load failed', e); return new THREE.Group(); }
  };

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

  // Speech bubble for the human (hidden until human is visible)
  function createSpeechBubble() {
    const el = document.createElement('div');
    el.id = 'speech-bubble';
    el.style.position = 'fixed';
    el.style.zIndex = '3000';
    el.style.pointerEvents = 'auto';
    // translate so left/top are the anchor point (we'll set exact px positions)
    el.style.transform = 'translate(-50%, -100%)';
    el.style.display = 'none';
    el.style.background = 'rgba(255,255,255,0.96)';
    el.style.color = '#000';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '12px';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
    el.style.fontFamily = 'sans-serif';
    el.style.fontSize = '13px';
    el.style.textAlign = 'left';
    el.style.maxWidth = '220px';
    el.style.cursor = 'pointer';
    el.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">Welcome to Dubai.</div><div><a id="speech-bubble-link" href="https://www.visitdubai.com/" target="_blank" rel="noopener noreferrer" style="color:#0066cc;text-decoration:none;font-weight:600;">Tap to find out more</a></div>`;
    // also open via click on the whole bubble for easier tapping
    el.addEventListener('click', (e)=>{ try{ window.open('https://www.visitdubai.com/','_blank','noopener'); }catch(err){} });
    document.body.appendChild(el);
    return el;
  }
  const speechBubbleEl = createSpeechBubble();

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
  // Load waving human (hidden by default)
  humanWavingGroup = await loadHumanWaving();
  humanWavingGroup.visible = false;
  anchor.group.add(humanWavingGroup);
  // Load dancing monkey (hidden by default)
  dancingMonkeyGroup = await loadDancingMonkey();
  dancingMonkeyGroup.visible = false;
  anchor.group.add(dancingMonkeyGroup);
 
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
        // Reveal waving human, position to the right of Burj and face camera
        try {
          if (humanWavingGroup) {
            humanWavingGroup.visible = true;
            // compute a safe position to the right of the Burj
            try {
              if (burjModel) {
                const box = new THREE.Box3().setFromObject(burjModel);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                const pos = center.clone();
                pos.x += (size.x * 0.6) + 0.12;
                pos.y = 0;
                pos.z += (size.z * 0.05);
                humanWavingGroup.position.copy(pos);
              } else {
                humanWavingGroup.position.set(0.6, 0, 0);
              }
              // face the camera by adjusting rotation.y of the group
              try { const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos); const worldPos = humanWavingGroup.getWorldPosition(new THREE.Vector3()); const lookDir = camPos.clone().sub(worldPos).normalize(); const targetY = Math.atan2(lookDir.x, lookDir.z); humanWavingGroup.rotation.y = targetY; } catch(e){}
            } catch(e){}
            // start wave animation if present
            try { Object.values(humanWavingGroup.userData?.animations || {}).forEach(a=>{ try{ a.play && a.play(); }catch(e){} }); } catch(e){}
          }
        } catch(e) {}
        // Reveal dancing monkey, position to the left of Burj and play dance
        try {
          if (dancingMonkeyGroup) {
            dancingMonkeyGroup.visible = true;
            try {
              if (burjModel) {
                const box = new THREE.Box3().setFromObject(burjModel);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                const pos = center.clone();
                pos.x -= (size.x * 0.6) + 0.12; // place on the other side from human
                pos.y = 0;
                pos.z += (size.z * 0.05);
                dancingMonkeyGroup.position.copy(pos);
              } else {
                dancingMonkeyGroup.position.set(-0.6, 0, 0);
              }
              // try play animations
              try { Object.values(dancingMonkeyGroup.userData?.animations || {}).forEach(a=>{ try{ a.play && a.play(); }catch(e){} }); } catch(e){}
            } catch(e){}
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
    try {
      if (dancingMonkeyGroup) {
        try { Object.values(dancingMonkeyGroup.userData?.animations || {}).forEach(a=>{ try{ a.stop && a.stop(); }catch(e){} }); } catch(e){}
        dancingMonkeyGroup.visible = false;
      }
    } catch(e){}
    try {
      if (humanWavingGroup) {
        try { Object.values(humanWavingGroup.userData?.animations || {}).forEach(a=>{ try{ a.stop && a.stop(); }catch(e){} }); } catch(e){}
        humanWavingGroup.visible = false;
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
        child.rotation.y = (angle+Math.PI)*0.6;
        child.rotation.z = Math.sin(d.time*d.speed*2)*0.1;

        // Procedural flap fallback
        if (d.flapFallback) {
          const flapAngle = Math.sin(d.time * d.speed * 10) * 1.0; // stronger flap
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
    try {
      if (speechBubbleEl) {
        if (humanWavingGroup && humanWavingGroup.visible) {
          // compute a world position slightly above and to the right of the human
          const targetWorld = humanWavingGroup.getWorldPosition(new THREE.Vector3());
          try {
            const bbox = new THREE.Box3().setFromObject(humanWavingGroup);
            const size = bbox.getSize(new THREE.Vector3());
            targetWorld.y += size.y * 0.9;
            targetWorld.x += size.x * 0.45;
            targetWorld.z += size.z * 0.05;
          } catch(e) {
            targetWorld.y += 0.15; targetWorld.x += 0.1;
          }
          // project to NDC space
          const proj = targetWorld.project(camera);
          const x = (proj.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          const y = (-proj.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          speechBubbleEl.style.left = `${x}px`;
          speechBubbleEl.style.top = `${y}px`;
          speechBubbleEl.style.display = 'block';
        } else {
          speechBubbleEl.style.display = 'none';
        }
      }
    } catch(e){}
  });
});