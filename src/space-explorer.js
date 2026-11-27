import * as THREE from "three";

export class NexusSpaceExplorer {
  constructor({ canvas, hud, stars = [], onStar = () => {}, onPlanet = () => {}, lang = "en" }) {
    this.canvas = canvas; this.hud = hud; this.onStar = onStar; this.onPlanet = onPlanet; this.lang = lang;
    this.labels = lang === "ar"
      ? { universe:"الكون", galaxy:"داخل المجرة", system:"النظام الشمسي", planet:"استكشاف الكوكب", hint:"اسحب للنظر · W A S D للحركة · عجلة الفأرة للطيران · انقر على جرم سماوي", back:"اضغط Esc للعودة", choose:"اقترب من مجرة لاستكشافها", systemHint:"اختر نجمًا للدخول إلى نظامه الشمسي", planetHint:"اختر كوكبًا للهبوط عليه" }
      : { universe:"THE UNIVERSE", galaxy:"INSIDE THE GALAXY", system:"SOLAR SYSTEM", planet:"PLANET SURFACE", hint:"DRAG TO LOOK · W A S D TO FLY · SCROLL TO MOVE · CLICK A CELESTIAL BODY", back:"PRESS ESC TO RETURN", choose:"Approach a galaxy to explore", systemHint:"Select a star to enter its solar system", planetHint:"Select a planet to descend" };
    this.stars = stars; this.sceneName = "universe"; this.previous = "system"; this.objects = []; this.velocity = new THREE.Vector3(); this.keys = new Set();
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x030611); this.scene.fog = new THREE.FogExp2(0x030611, 0.0018);
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 5000); this.camera.position.set(0, 5, 95);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.clock = new THREE.Clock(); this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.yaw = 0; this.pitch = -0.04; this.dragging = false; this.lastX = 0; this.lastY = 0; this.targetCamera = null; this.targetLook = null;
    this.planetGroup = null; this.currentStar = null; this.animate = this.animate.bind(this);
    this.makeLights(); this.makeUniverse(); this.bind(); this.resize(); this.renderer.setAnimationLoop(this.animate);
    this.showHud(this.labels.universe, this.labels.choose);
  }
  makeLights() {
    this.scene.add(new THREE.AmbientLight(0x9aa9ff, 0.42));
    const light = new THREE.PointLight(0xffd8a0, 1600, 900, 1.5); light.position.set(0, 0, 0); this.scene.add(light);
  }
  clearWorld() {
    for (const obj of [...this.objects]) { this.scene.remove(obj); obj.traverse?.(n => { n.geometry?.dispose?.(); if (Array.isArray(n.material)) n.material.forEach(m=>m.dispose()); else n.material?.dispose?.(); }); }
    this.objects = [];
  }
  add(obj) { this.scene.add(obj); this.objects.push(obj); return obj; }
  starField(count = 6500, radius = 1500) {
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    for (let i=0;i<count;i++) {
      const r = radius * Math.cbrt(Math.random()), a = Math.random()*Math.PI*2, z = (Math.random()-.5)*radius;
      positions[i*3] = Math.cos(a)*r; positions[i*3+1] = Math.sin(a)*r; positions[i*3+2] = z;
      const c = new THREE.Color().setHSL(.58+Math.random()*.16,.35,.68+Math.random()*.3);
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(positions,3)); g.setAttribute("color",new THREE.BufferAttribute(colors,3));
    const m = new THREE.PointsMaterial({size:1.35,vertexColors:true,transparent:true,opacity:.9,sizeAttenuation:true});
    return new THREE.Points(g,m);
  }
  makeGalaxy(position = new THREE.Vector3(0,0,-90), scale = 1, interactive = true) {
    const group = new THREE.Group(); group.position.copy(position); group.scale.setScalar(scale);
    const count=11500, pos=new Float32Array(count*3), col=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const arm=i%5, radius=Math.pow(Math.random(),.68)*44, angle=arm*Math.PI*2/5+radius*.17+(Math.random()-.5)*.52;
      pos[i*3]=Math.cos(angle)*radius; pos[i*3+1]=(Math.random()-.5)*radius*.12; pos[i*3+2]=Math.sin(angle)*radius;
      const c=new THREE.Color().setHSL(Math.random()>.82?.08:.64,.48,.55+Math.random()*.35);
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
    group.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.34,vertexColors:true,transparent:true,opacity:.88,sizeAttenuation:true})));
    const core=new THREE.Mesh(new THREE.SphereGeometry(2.8,32,32),new THREE.MeshBasicMaterial({color:0xffd9ad}));
    const glow=new THREE.Mesh(new THREE.SphereGeometry(7,32,32),new THREE.MeshBasicMaterial({color:0xffa76c,transparent:true,opacity:.08,side:THREE.BackSide}));
    group.add(core,glow);
    if(interactive){const hit=new THREE.Mesh(new THREE.SphereGeometry(49,16,16),new THREE.MeshBasicMaterial({visible:false}));hit.userData={kind:"galaxy"};group.add(hit);}
    this.add(group); return group;
  }
  makeUniverse() {
    this.clearWorld(); this.add(this.starField(9000,1900));
    const galaxy=this.makeGalaxy(new THREE.Vector3(0,0,-120),1.35,true); galaxy.userData.kind="galaxy-root";
    const positions=[[-145,45,-235],[170,-55,-310],[80,95,-470],[-230,-80,-560]];
    positions.forEach((p,i)=>{
      const g=this.makeGalaxy(new THREE.Vector3(...p),.25+i*.045,true);
      const label=new THREE.Object3D();label.position.set(...p);label.userData.kind="galaxy";
    });
    this.camera.position.set(0,8,100);this.yaw=0;this.pitch=-.035;this.sceneName="universe";
  }
  makeGalaxyInterior(star) {
    this.clearWorld(); this.add(this.starField(7500,850));
    const g=this.makeGalaxy(new THREE.Vector3(0,0,-100),1.05,false);g.rotation.x=.18;
    const list=this.stars.length?this.stars.slice(0,80):Array.from({length:36},(_,i)=>({id:"sample-"+i,title:"Uncharted star "+(i+1),content:"A distant signal in the NEXUS universe.",nickname:"NEXUS explorer"}));
    list.forEach((s,i)=>{
      const arm=i%4, r=12+Math.sqrt(i+1)*7.2, a=arm*Math.PI/2+r*.075;
      const p=new THREE.Vector3(Math.cos(a)*r,(Math.random()-.5)*5,Math.sin(a)*r-100);
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.7+Math.random()*.45,12,12),new THREE.MeshBasicMaterial({color:i%7===0?0xffd9aa:0xb9c8ff}));
      mesh.position.copy(p);mesh.userData={kind:"star",star:s};this.add(mesh);
      const halo=new THREE.Mesh(new THREE.SphereGeometry(1.9,12,12),new THREE.MeshBasicMaterial({color:0x91a8ff,transparent:true,opacity:.09}));halo.position.copy(p);this.add(halo);
    });
    const hub=new THREE.Mesh(new THREE.SphereGeometry(4,24,24),new THREE.MeshBasicMaterial({color:0xffd9a2}));
    hub.position.set(0,0,-100);hub.userData={kind:"system",star:star||{id:"nexus-core",title:"NEXUS Core",nickname:"NEXUS"}};this.add(hub);
    this.camera.position.set(0,12,35);this.yaw=0;this.pitch=-.12;this.sceneName="galaxy";
  }
  makeSystem(star) {
    this.clearWorld();this.add(this.starField(4500,620));this.currentStar=star;
    const sunMat=new THREE.MeshBasicMaterial({color:0xffd99b});
    const sun=new THREE.Mesh(new THREE.SphereGeometry(5,48,48),sunMat);sun.userData={kind:"sun"};this.add(sun);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(9,32,32),new THREE.MeshBasicMaterial({color:0xff9f55,transparent:true,opacity:.12,side:THREE.BackSide}));this.add(glow);
    const light=new THREE.PointLight(0xffd49a,2100,420,1.6);this.add(light);
    const colors=[0x9b9ca7,0xd7b28b,0x5d9fcf,0xc66f57,0xd8b98c,0xd4c5a4,0x8fc8cb,0x7189c8];
    this.orbits=[];
    for(let i=0;i<8;i++){
      const radius=13+i*7.1, orbit=new THREE.Mesh(new THREE.TorusGeometry(radius,.035,6,180),new THREE.MeshBasicMaterial({color:0x7180ae,transparent:true,opacity:.34}));
      orbit.rotation.x=Math.PI/2.35;this.add(orbit);
      const planet=new THREE.Mesh(new THREE.SphereGeometry([.8,1.35,1.5,1.15,3.1,2.7,2.3,2.1][i],32,24),new THREE.MeshStandardMaterial({color:colors[i],roughness:.92,metalness:.02}));
      planet.userData={kind:"planet",index:i,name:["Cinder","Vesper","Azure","Rhea","Jovian","Aurelia","Neris","Nyx"][i]};
      planet.position.set(Math.cos(i*1.2)*radius,0,Math.sin(i*1.2)*radius*.43);
      if(i===5){const ring=new THREE.Mesh(new THREE.TorusGeometry(4.1,.16,8,90),new THREE.MeshBasicMaterial({color:0xdac8a0,transparent:true,opacity:.65}));ring.position.copy(planet.position);ring.rotation.x=Math.PI/2.4;this.add(ring);}
      this.add(planet);this.orbits.push({planet,radius,speed:.12/(i*.45+1),phase:i*1.2});
    }
    this.camera.position.set(0,76,112);this.yaw=0;this.pitch=-.12;this.sceneName="system";
  }
  makePlanet(index=2,name="Azure") {
    this.clearWorld();this.add(this.starField(2400,950));
    const radius=28,geo=new THREE.SphereGeometry(radius,100,72),pos=geo.attributes.position;
    const colors=[];
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),n=Math.sin(x*.19+Math.cos(z*.13))*Math.cos(y*.21+z*.1)+Math.sin(z*.32+y*.08)*.35;
      const c=new THREE.Color(n>.28?0x8eaa78:n>-.05?0x536e54:0x254b72);colors.push(c.r,c.g,c.b);
    }
    geo.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    const surface=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));surface.userData={kind:"planet-surface",name};this.add(surface);
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(radius*1.035,64,48),new THREE.MeshBasicMaterial({color:0x77bfff,transparent:true,opacity:.12,side:THREE.BackSide}));this.add(atmosphere);
    const clouds=new THREE.Mesh(new THREE.SphereGeometry(radius*1.008,64,48),new THREE.MeshBasicMaterial({color:0xe5f3ff,transparent:true,opacity:.055,wireframe:true}));this.add(clouds);
    this.camera.position.set(0,7,78);this.yaw=0;this.pitch=-.08;this.sceneName="planet";this.currentPlanet={index,name};
  }
  enterGalaxy(){this.makeGalaxyInterior();this.flyTo(new THREE.Vector3(0,12,36),new THREE.Vector3(0,0,-100));this.showHud(this.labels.galaxy,this.labels.systemHint);}
  enterSystem(star){this.currentStar=star;this.makeSystem(star);this.flyTo(new THREE.Vector3(0,76,112),new THREE.Vector3(0,0,0));this.showHud(this.labels.system,star?.title||this.labels.systemHint);}
  enterPlanet(index,name){this.previous="system";this.makePlanet(index,name);this.flyTo(new THREE.Vector3(0,6,76),new THREE.Vector3(0,0,0));this.showHud(this.labels.planet,name+" · "+this.labels.back);}
  flyTo(position,look){this.targetCamera=position.clone();this.targetLook=look.clone();const d=look.clone().sub(position).normalize();this.yaw=Math.atan2(d.x,-d.z);this.pitch=Math.asin(THREE.MathUtils.clamp(d.y,-1,1));}
  showHud(title,sub){if(this.hud)this.hud.innerHTML=`<div class="flight-level">${title}</div><div class="flight-sub">${sub}</div><div class="flight-controls">${this.labels.hint}</div>`;}
  bind(){
    this.onDown=e=>{this.dragging=true;this.dragMoved=0;this.lastX=e.clientX;this.lastY=e.clientY;this.canvas.setPointerCapture?.(e.pointerId);};
    this.onMove=e=>{if(!this.dragging)return;const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;this.lastX=e.clientX;this.lastY=e.clientY;this.dragMoved=(this.dragMoved||0)+Math.abs(dx)+Math.abs(dy);this.yaw-=dx*.003;this.pitch=Math.max(-1.35,Math.min(1.35,this.pitch-dy*.003));};
    this.onUp=()=>{this.dragging=false;};
    this.onWheel=e=>{e.preventDefault();const dir=this.camera.getWorldDirection(new THREE.Vector3());this.camera.position.addScaledVector(dir,Math.sign(e.deltaY)*Math.min(24,Math.abs(e.deltaY)*.035));};
    this.onKeyDown=e=>{this.keys.add(e.key.toLowerCase());if(e.key==="Escape"||e.key==="Backspace"){e.preventDefault();this.goBack();}};
    this.onKeyUp=e=>this.keys.delete(e.key.toLowerCase());
    this.onClick=e=>{if(this.dragMoved>4){this.dragMoved=0;return;}const r=this.canvas.getBoundingClientRect();this.pointer.x=((e.clientX-r.left)/r.width)*2-1;this.pointer.y=-((e.clientY-r.top)/r.height)*2+1;this.raycaster.setFromCamera(this.pointer,this.camera);const hits=this.raycaster.intersectObjects(this.objects,true);const hit=hits.find(x=>x.object.userData?.kind);if(!hit)return;const d=hit.object.userData;
      if(d.kind==="galaxy"){this.enterGalaxy();return;}
      if(d.kind==="star"){this.currentStar=d.star;this.enterSystem(d.star);this.onStar(d.star);return;}
      if(d.kind==="system"){this.enterSystem(d.star);return;}
      if(d.kind==="planet"){this.enterPlanet(d.index,d.name);this.onPlanet({index:d.index,name:d.name});return;}
    };
    this.canvas.addEventListener("pointerdown",this.onDown);this.canvas.addEventListener("pointermove",this.onMove);this.canvas.addEventListener("pointerup",this.onUp);this.canvas.addEventListener("pointercancel",this.onUp);this.canvas.addEventListener("click",this.onClick);this.canvas.addEventListener("wheel",this.onWheel,{passive:false});
    window.addEventListener("keydown",this.onKeyDown);window.addEventListener("keyup",this.onKeyUp);window.addEventListener("resize",this.onResize=()=>this.resize());
  }
  goBack(){
    if(this.sceneName==="planet"){this.enterSystem(this.currentStar);return;}
    if(this.sceneName==="system"){this.enterGalaxy();return;}
    if(this.sceneName==="galaxy"){this.makeUniverse();this.showHud(this.labels.universe,this.labels.choose);return;}
  }
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  animate(){
    const dt=Math.min(this.clock.getDelta(),.04);
    if(this.targetCamera){this.camera.position.lerp(this.targetCamera,1-Math.exp(-dt*1.5));const target=this.targetLook||new THREE.Vector3();this.camera.lookAt(target);if(this.camera.position.distanceTo(this.targetCamera)<.35)this.targetCamera=null;}
    const forward=new THREE.Vector3(Math.sin(this.yaw),0,-Math.cos(this.yaw)),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const speed=this.sceneName==="planet"?22:48;
    if(this.keys.has("w")||this.keys.has("arrowup"))this.camera.position.addScaledVector(forward,speed*dt);
    if(this.keys.has("s")||this.keys.has("arrowdown"))this.camera.position.addScaledVector(forward,-speed*dt);
    if(this.keys.has("a")||this.keys.has("arrowleft"))this.camera.position.addScaledVector(right,-speed*dt);
    if(this.keys.has("d")||this.keys.has("arrowright"))this.camera.position.addScaledVector(right,speed*dt);
    if(this.keys.has(" "))this.camera.position.y+=speed*dt;if(this.keys.has("shift"))this.camera.position.y-=speed*dt;
    this.camera.rotation.order="YXZ";this.camera.rotation.y=this.yaw;this.camera.rotation.x=this.pitch;
    if(this.orbits){const t=this.clock.elapsedTime;this.orbits.forEach(o=>{const a=t*o.speed+o.phase;o.planet.position.set(Math.cos(a)*o.radius,Math.sin(a*.6)*.6,Math.sin(a)*o.radius*.43);});}
    this.objects.forEach(o=>{if(o.userData?.kind==="galaxy-root")o.rotation.y=dt*.018;});
    this.renderer.render(this.scene,this.camera);
  }
  destroy(){
    this.renderer.setAnimationLoop(null);this.canvas.removeEventListener("pointerdown",this.onDown);this.canvas.removeEventListener("pointermove",this.onMove);this.canvas.removeEventListener("pointerup",this.onUp);this.canvas.removeEventListener("pointercancel",this.onUp);this.canvas.removeEventListener("click",this.onClick);this.canvas.removeEventListener("wheel",this.onWheel);window.removeEventListener("keydown",this.onKeyDown);window.removeEventListener("keyup",this.onKeyUp);window.removeEventListener("resize",this.onResize);this.clearWorld();this.renderer.dispose();
  }
}
