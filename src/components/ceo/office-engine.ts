import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { approachVelocity, officeZone, type DayEncounter, type Point } from "@/lib/ceo/day";

export type OfficeStatus = { position: Point; yaw: number; zone: string; prompt: string; target: string | null; distance: number; held: boolean };
export type OfficeSettings = { running: boolean; conversation: boolean; encounter: DayEncounter | null; muted: boolean; reducedMotion: boolean; elapsed: number };
export type OfficeEvents = { ready: () => void; fail: (message: string) => void; frame: (seconds: number) => void; status: (status: OfficeStatus) => void; interact: (id: string) => void; lock: (locked: boolean) => void; map: () => void; toast: (message: string) => void };
export type OfficeApi = { capture: () => void; release: () => void; interact: () => void; jump: () => void; move: (x: number, z: number) => void; look: (x: number, y: number) => void; throw: () => void };
type Prop = { mesh: THREE.Mesh; body: RAPIER.RigidBody; start: THREE.Vector3 };
type Npc = { group: THREE.Group; body: RAPIER.RigidBody; arms: THREE.Group[]; legs: THREE.Group[]; home: Point; phase: number; role: string };
type Door = { pivot: Point; mesh: THREE.Group; body: RAPIER.RigidBody; angle: number; open: boolean; room: string };

let physicsReady: Promise<void> | undefined;
export const initOfficePhysics = () => physicsReady ??= RAPIER.init();

export class OfficeEngine implements OfficeApi {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, 0.07, 180);
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private environment: THREE.WebGLRenderTarget;
  private world: RAPIER.World;
  private player: RAPIER.RigidBody;
  private capsule: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private props: Prop[] = [];
  private npcs = new Map<string, Npc>();
  private doors: Door[] = [];
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private textures = new Set<THREE.Texture>();
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private direction = new THREE.Vector3();
  private held: Prop | null = null;
  private target: { id: string; prompt: string } | null = null;
  private marker = new THREE.Group();
  private hand = new THREE.Group();
  private resize: ResizeObserver;
  private cleanups: (() => void)[] = [];
  private frameId = 0;
  private previous = 0;
  private accumulator = 0;
  private uiAccumulator = 0;
  private yaw = 0;
  private pitch = 0;
  private velocity = new THREE.Vector3();
  private touch = { x: 0, z: 0 };
  private grounded = false;
  private walking = 0;
  private audio: AudioContext | null = null;
  private lastStep = 0;
  private coffee = false;
  private disposed = false;
  private lastEncounter: string | null = null;
  settings: OfficeSettings = { running: false, conversation: false, encounter: null, muted: true, reducedMotion: false, elapsed: 0 };

  constructor(private host: HTMLDivElement, private events: OfficeEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute("aria-label", "First-person 3D office. WASD to move, mouse or drag to look, E to interact.");
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#a8bfd1");
    this.scene.fog = new THREE.FogExp2("#b5c7d3", 0.008);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.45;
    room.dispose(); pmrem.dispose();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.5, 1.35));
    this.composer.addPass(new OutputPass());
    this.player = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.92, 12));
    this.capsule = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), this.player);
    this.controller = this.world.createCharacterController(0.025);
    this.controller.enableAutostep(0.22, 0.3, false);
    this.controller.enableSnapToGround(0.3);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(75);
    this.buildOffice();
    this.mergeStatic();
    this.buildMarker();
    this.buildHands();
    this.scene.add(this.camera);
    this.resize = new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h); this.composer.setSize(w, h);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    });
    this.resize.observe(host);
    this.bindControls();
    this.world.step();
    this.frameId = requestAnimationFrame(this.animate);
    events.ready();
  }

  private material(color: string, metalness = 0, roughness = 0.65) {
    const key = `${color}:${metalness}:${roughness}`;
    let mat = this.mats.get(key);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color, metalness, roughness }); this.mats.set(key, mat); }
    return mat;
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, color: string | THREE.Material, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === "string" ? this.material(color) : color);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.static = true;
    this.scene.add(mesh);
    if (solid) this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setFriction(0.65));
    return mesh;
  }

  private label(text: string, w: number, h: number, color = "#b5d4f4", bg = "#0a1b34", small?: string) {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = Math.round(1024 * h / w);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color; ctx.font = `600 ${Math.min(110, canvas.height * 0.3)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 512, canvas.height * (small ? 0.4 : 0.5), 950);
    if (small) { ctx.fillStyle = "#9aafbd"; ctx.font = `${Math.min(34, canvas.height * 0.12)}px sans-serif`; ctx.fillText(small, 512, canvas.height * 0.72, 930); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
    return mesh;
  }

  private floorTexture(wood: boolean) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = wood ? "#9b8062" : "#6e7c89"; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1700; i++) {
      const x = (i * 97) % 256, y = (i * 53) % 256;
      ctx.fillStyle = i % 2 ? "#ffffff12" : "#00000012";
      ctx.fillRect(x, y, wood ? 1 : 2, wood ? 10 + i % 40 : 2);
    }
    if (wood) { ctx.strokeStyle = "#503c2d55"; ctx.lineWidth = 1; for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); } }
    const map = new THREE.CanvasTexture(canvas); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(10, 8); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    return new THREE.MeshStandardMaterial({ map, roughness: wood ? 0.4 : 0.95 });
  }

  private plant(x: number, z: number, scale = 1) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.23 * scale, 0.18 * scale, 0.5 * scale, 16), this.material("#dfdcd1"));
    pot.position.set(x, 0.25 * scale, z); pot.castShadow = true; pot.userData.static = true; this.scene.add(pot);
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(0.25 * scale, 0.23 * scale).setTranslation(x, 0.25 * scale, z));
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), this.material(i % 2 ? "#386955" : "#57836c"));
      leaf.scale.set(0.13 * scale, (0.4 + i % 3 * 0.08) * scale, 0.07 * scale);
      leaf.position.set(x + Math.sin(i * 2.4) * 0.18 * scale, (0.65 + i % 3 * 0.2) * scale, z + Math.cos(i * 2.4) * 0.18 * scale);
      leaf.rotation.set(Math.sin(i) * 0.5, i * 2.4, Math.cos(i) * 0.5); leaf.castShadow = true; leaf.userData.static = true; this.scene.add(leaf);
    }
  }

  private desk(x: number, z: number, facing = 0) {
    this.box(2.8, 0.09, 1.25, x, 0.8, z, "#b09877", true);
    for (const side of [-1, 1]) this.box(0.06, 0.77, 1.1, x + side * 1.2, 0.39, z, "#263442");
    this.box(0.12, 0.32, 0.12, x, 1, z - 0.3 * (facing || 1), "#29343f");
    this.box(1.05, 0.62, 0.07, x, 1.35, z - 0.3 * (facing || 1), "#111b23");
    const screen = this.label("WORKSPACE", 0.95, 0.52, "#90c1e3", "#162f44", "CONNECTED. CLEAR. IN CONTROL.");
    screen.position.set(x, 1.36, z - 0.3 * (facing || 1) + 0.045); this.scene.add(screen);
    this.box(0.6, 0.025, 0.22, x, 0.87, z + 0.15, "#27323a");
    this.box(0.52, 0.08, 0.48, x, 0.46, z + 1, "#233951");
    this.box(0.52, 0.6, 0.08, x, 0.8, z + 1.22, "#233951");
    this.box(0.07, 0.44, 0.07, x, 0.23, z + 1, "#38424a");
    this.box(0.65, 0.06, 0.65, x, 0.06, z + 1, "#38424a");
  }

  private glassWall(x: number, z: number, length: number, alongX = false) {
    const glass = new THREE.MeshPhysicalMaterial({ color: "#9bcee0", transparent: true, opacity: 0.13, roughness: 0.12, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
    this.box(alongX ? length : 0.09, 3.5, alongX ? 0.09 : length, x, 1.75, z, glass, true);
    for (const y of [0.1, 2.7, 3.5]) this.box(alongX ? length : 0.12, 0.045, alongX ? 0.12 : length, x, y, z, "#273f50");
    for (let offset = -length / 2; offset <= length / 2; offset += 2) this.box(0.04, 3.5, 0.04, x + (alongX ? offset : 0), 1.75, z + (alongX ? 0 : offset), "#324b5b");
    this.box(alongX ? length : 0.1, 0.05, alongX ? 0.1 : length, x, 1.35, z, "#a6bec9");
  }

  private doorway(x: number, center: number, room: string) {
    const pivot = { x, z: center - 1.1 };
    const group = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ color: "#a2d9ed", transparent: true, opacity: 0.23, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.75, 2.15), glass); leaf.position.set(0, 1.4, 1.075); group.add(leaf);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.75, 0.04), this.material("#344d60")); edge.position.set(0, 1.4, 2.13); group.add(edge);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.035), this.material("#b3bdc2", 0.8, 0.2)); handle.position.set(0.09, 1.2, 1.9); group.add(handle);
    group.position.set(x, 0, pivot.z); group.rotation.y = x < 0 ? -1.45 : 1.45;
    group.userData.interact = `door:${this.doors.length}`; this.scene.add(group);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.045, 1.375, 1.075), body);
    this.doors.push({ pivot, mesh: group, body, angle: group.rotation.y, open: true, room });
    const sign = this.label(room.toUpperCase(), 1.7, 0.35, "#e7eff1", "#203e53");
    sign.position.set(x + (x < 0 ? 0.08 : -0.08), 3, center); sign.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; this.scene.add(sign);
    this.box(0.2, 0.65, 2.3, x, 3.15, center, "#e5e6e1");
  }

  private person(id: string, x: number, z: number, shirt: string, skin: string, hair: string) {
    const group = new THREE.Group();
    const part = (geometry: THREE.BufferGeometry, color: string, px: number, py: number, pz: number, parent: THREE.Object3D = group) => {
      const mesh = new THREE.Mesh(geometry, this.material(color)); mesh.position.set(px, py, pz); mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    const torso = part(new THREE.CapsuleGeometry(0.22, 0.36, 5, 10), shirt, 0, 1.12, 0); torso.scale.z = 0.65;
    part(new THREE.CylinderGeometry(0.07, 0.09, 0.13, 10), skin, 0, 1.47, 0);
    const head = part(new THREE.SphereGeometry(0.17, 16, 12), skin, 0, 1.67, 0); head.scale.set(0.88, 1.13, 0.92);
    const haircut = part(new THREE.SphereGeometry(0.175, 12, 10, 0, Math.PI * 2, 0, 1.7), hair, 0, 1.72, -0.015); haircut.scale.set(0.95, 0.94, 0.95);
    for (const x of [-0.06, 0.06]) part(new THREE.SphereGeometry(0.013, 6, 5), "#25303b", x, 1.69, 0.145);
    part(new THREE.SphereGeometry(0.025, 7, 5), skin, 0, 1.64, 0.16);
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const sign of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sign * 0.26, 1.32, 0); group.add(arm);
      part(new THREE.CapsuleGeometry(0.07, 0.35, 4, 8), shirt, 0, -0.2, 0, arm);
      part(new THREE.SphereGeometry(0.065, 8, 6), skin, 0, -0.46, 0, arm); arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(sign * 0.12, 0.85, 0); group.add(leg);
      part(new THREE.CapsuleGeometry(0.085, 0.53, 4, 8), "#23313c", 0, -0.34, 0, leg);
      part(new THREE.BoxGeometry(0.15, 0.1, 0.28), "#202328", 0, -0.76, 0.055, leg); legs.push(leg);
    }
    const badge = part(new THREE.BoxGeometry(0.08, 0.12, 0.02), "#b4d3e5", 0.1, 1.2, 0.16); badge.rotation.z = -0.07;
    group.position.set(x, 0, z); group.userData.interact = `person:${id}`; this.scene.add(group);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.9, z));
    this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.23), body);
    this.npcs.set(id, { group, body, arms, legs, home: { x, z }, phase: 0, role: id });
  }

  private dynamicBox(x: number, y: number, z: number, size: number, color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), this.material(color, 0, 0.55));
    mesh.castShadow = mesh.receiveShadow = true; mesh.position.set(x, y, z); mesh.userData.interact = `prop:${this.props.length}`; this.scene.add(mesh);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.2).setAngularDamping(0.4).setCcdEnabled(true));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setDensity(8).setFriction(0.65).setRestitution(0.18), body);
    this.props.push({ mesh, body, start: mesh.position.clone() });
  }

  private buildOffice() {
    const wood = this.floorTexture(true), carpet = this.floorTexture(false);
    this.box(36, 0.24, 28, 0, -0.14, 0, wood, true);
    this.box(7.8, 0.025, 27.8, 0, 0.005, 0, this.material("#c4c2b8", 0.1, 0.35));
    this.box(13.8, 0.02, 10.8, -11, 0.005, 8.5, carpet);
    this.box(13.8, 0.02, 8.8, 11, 0.005, -1.5, carpet);
    this.box(13.8, 0.02, 7.8, 11, 0.005, -10, this.material("#4c6478"));
    this.box(36, 0.15, 28, 0, 3.85, 0, "#e6e5df", true);
    this.box(36, 3.8, 0.25, 0, 1.9, 14, "#e5e1d7", true);
    this.box(36, 3.8, 0.25, 0, 1.9, -14, "#cdd9de", true);
    // Full-height exterior glazing with structural mullions.
    for (const x of [-18, 18]) {
      this.box(0.2, 0.5, 28, x, 0.25, 0, "#dde0db", true);
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 2, 14).setTranslation(x, 2, 0));
      for (let z = -14; z <= 14; z += 3.5) this.box(0.15, 3.8, 0.08, x, 1.9, z, "#345062");
      this.box(0.12, 0.07, 28, x, 1.05, 0, "#4a6575");
    }
    for (const x of [-4, 4]) {
      for (const [a, b] of [[-14, -11.1], [-8.9, -2.1], [0.1, 6.9], [9.1, 14]]) this.glassWall(x, (a + b) / 2, b - a);
      this.doorway(x, -10, x < 0 ? "Quiet lounge" : "Boardroom");
      this.doorway(x, -1, x < 0 ? "Studio" : "Operations");
      this.doorway(x, 8, x < 0 ? "Finance" : "Café");
    }
    for (const x of [-11, 11]) for (const z of [-6, 3]) this.glassWall(x, z, 14, true);
    // Warm workspaces, cool daylight and a low, blue wayfinding line.
    const strip = new THREE.MeshStandardMaterial({ color: "#d5f0ff", emissive: "#a8d3ff", emissiveIntensity: 3 });
    for (let z = -11; z < 14; z += 5) {
      this.box(0.08, 0.025, 2.7, -3.5, 0.035, z, strip);
      this.box(3.3, 0.035, 0.12, 0, 3.73, z, strip);
      for (const x of [-11, 11]) this.box(5, 0.04, 0.28, x, 3.7, z, strip);
    }
    this.scene.add(new THREE.HemisphereLight("#d5e9ff", "#9d8469", 2.0));
    const sun = new THREE.DirectionalLight("#ffe3bd", 3.2); sun.position.set(-20, 22, -12); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 70 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; this.scene.add(sun);
    const blue = new THREE.PointLight("#9aceff", 12, 22); blue.position.set(0, 3.1, -9); this.scene.add(blue);
    const warm = new THREE.PointLight("#ffd6a4", 10, 18); warm.position.set(10, 3, 8); this.scene.add(warm);
    // The surrounding city is real scene geometry, visible through the windows.
    this.box(180, 0.2, 180, 0, -8, 0, "#7f999a");
    for (let i = 0; i < 38; i++) {
      const side = i % 2 ? -1 : 1, x = side * (26 + i % 5 * 7), z = -65 + i * 3.7;
      const height = 7 + i * 7 % 19;
      this.box(5 + i % 3, height, 5, x, height / 2 - 8, z, i % 3 ? "#879ba6" : "#b3bec0");
      for (let y = -4; y < height - 8; y += 2.1) this.box(5.1 + i % 3, 0.65, 5.1, x, y, z, "#637f91");
    }
    // Reception and identity.
    this.box(3.2, 1, 0.9, -1.8, 0.5, 5.2, "#263d51", true);
    this.box(3.5, 0.08, 1.1, -1.8, 1.04, 5.2, "#bba588");
    const logo = this.label("VELHO", 4.3, 1.4, "#173a55", "#e5e1d7", "A LITTLE LESS WORK. A LOT MORE POSSIBLE."); logo.position.set(0, 2.35, 13.85); logo.rotation.y = Math.PI; this.scene.add(logo);
    const welcome = this.label("YOUR DAY. YOUR CALL.", 3.7, 0.9, "#d8e8f1", "#173447", "09:00  /  EXECUTIVE FLOOR  /  HELSINKI"); welcome.position.set(-3.84, 2.1, 10.7); welcome.rotation.y = Math.PI / 2; this.scene.add(welcome);
    // Finance and open studio.
    for (const x of [-15, -10]) for (const z of [5.2, 10.8]) this.desk(x, z);
    for (const x of [-15, -9]) for (const z of [-3.8, 0.6]) this.desk(x, z);
    // Operations desks, a physical stock shelf and pick-up shipping cartons.
    for (const x of [7, 12]) this.desk(x, 0.5);
    for (const y of [0.15, 0.9, 1.65, 2.4]) this.box(1.2, 0.07, 5, 16.6, y, -2.5, "#718390", true);
    for (const z of [-4.8, -0.2]) this.box(0.08, 2.5, 0.08, 16.6, 1.25, z, "#536c7d");
    for (let i = 0; i < 9; i++) this.dynamicBox(16.6, 0.5 + Math.floor(i / 3) * 0.76, -4.2 + i % 3 * 1.4, 0.48, i % 2 ? "#b69a73" : "#8da4b8");
    this.dynamicBox(12, 0.35, -4.7, 0.55, "#b29368");
    this.dynamicBox(12.55, 1.1, -4.7, 0.4, "#c2a481");
    // Café: kitchen, coffee station, communal tables and pendants.
    this.box(1.3, 0.9, 7, 16.9, 0.45, 8.3, "#355569", true);
    this.box(1.4, 0.08, 7.1, 16.85, 0.95, 8.3, "#ded7c9");
    const coffee = this.box(0.55, 0.65, 0.65, 16.6, 1.3, 7, "#182e3e"); coffee.userData.static = false; coffee.userData.interact = "coffee";
    this.box(0.07, 0.3, 0.4, 16.27, 1.3, 7, strip);
    for (const z of [6, 11]) {
      this.box(4, 0.08, 1.4, 10, 0.82, z, "#b89a77", true);
      for (const x of [8.5, 11.5]) this.box(0.08, 0.78, 1, x, 0.39, z, "#293e4e");
      for (const x of [8.7, 11.3]) for (const dz of [-1.1, 1.1]) { this.box(0.55, 0.1, 0.5, x, 0.47, z + dz, "#bd8460"); this.box(0.08, 0.45, 0.08, x, 0.23, z + dz, "#263848"); }
      for (const x of [9, 11]) {
        this.box(0.025, 0.8, 0.025, x, 3.4, z, "#394650");
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.25, 16, 1, true), this.material("#cfa16f", 0.45, 0.35)); shade.position.set(x, 3, z); shade.userData.static = true; this.scene.add(shade);
      }
    }
    // Boardroom table, seats and an actual in-world presentation screen.
    this.box(7.4, 0.16, 2.5, 12, 0.84, -10, "#8d7055", true);
    this.box(4.5, 0.7, 1.25, 12, 0.35, -10, "#213a4c");
    for (const x of [9.5, 11.2, 12.9, 14.6]) for (const z of [-12, -8]) {
      this.box(0.65, 0.1, 0.6, x, 0.5, z, "#263e55"); this.box(0.65, 0.7, 0.1, x, 0.86, z + (z < -10 ? -0.2 : 0.2), "#263e55"); this.box(0.08, 0.45, 0.08, x, 0.24, z, "#6e7c84");
    }
    const presentation = this.label("THE NEXT MOVE", 7.5, 2.65, "#d2e7ff", "#0b2039", "GROWTH  /  SYSTEMS  /  PEOPLE"); presentation.position.set(11, 2.2, -13.82); this.scene.add(presentation);
    this.box(7.65, 2.8, 0.05, 11, 2.2, -13.88, "#1a3146");
    // Lounge and scattered things to explore between meetings.
    for (const z of [-11.5, -8]) { this.box(4, 0.5, 1.1, -12, 0.3, z, "#657e88", true); this.box(4, 0.65, 0.2, -12, 0.8, z - 0.5, "#657e88"); }
    this.box(2.5, 0.08, 1.2, -12, 0.5, -9.5, "#b09575", true);
    const report = this.box(0.4, 0.025, 0.5, -12, 0.57, -9.5, "#dbe1dc"); report.userData.static = false; report.userData.interact = "report";
    const terminal = this.label("TODAY’S BRIEF", 1.6, 0.95, "#91caed", "#112e43", "MANUAL WORK GROWS FASTER THAN SALES."); terminal.position.set(-17.8, 1.9, -0.8); terminal.rotation.y = Math.PI / 2; terminal.userData.interact = "terminal"; this.scene.add(terminal);
    for (const [x, z, scale] of [[-3.2, 12, 1.4], [3.2, 4, 1.4], [-16.8, 3.9, 1.6], [17, -12.6, 1.7], [-6, -12.5, 1.5], [5.7, 12.5, 1.4], [-16, -5, 1.2]]) this.plant(x, z, scale);
    this.person("Alex", -2.5, 7, "#798c8b", "#c99370", "#3b2d27");
    this.person("Emma", -8, 8, "#d4c7b1", "#d6a888", "#5f3828");
    this.person("Noah", 9, -1, "#486d8d", "#9f7254", "#292522");
    this.person("Sofia", 9, 8, "#293f58", "#d9b297", "#292b2c");
    this.person("ambient1", -14, -3.6, "#bba588", "#b37e5e", "#34302b");
    this.person("ambient2", 14, -11.8, "#6e8095", "#d2a589", "#7b6c5b");
  }

  private mergeStatic() {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...this.scene.children]) if (child instanceof THREE.Mesh && child.userData.static && !Array.isArray(child.material) && !child.material.transparent) {
      const list = groups.get(child.material) ?? []; list.push(child); groups.set(child.material, list);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((mesh) => { mesh.updateMatrixWorld(); return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); });
      const merged = mergeGeometries(geometries);
      geometries.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
      for (const old of meshes) { this.scene.remove(old); old.geometry.dispose(); }
    }
  }

  private buildMarker() {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 32), new THREE.MeshBasicMaterial({ color: "#8bd9ff", depthTest: false, transparent: true, opacity: 0.9 }));
    const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: "#c4efff", depthTest: false }));
    dot.position.y = 0.04; this.marker.add(ring, dot); this.marker.renderOrder = 5; this.scene.add(this.marker);
  }

  private buildHands() {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 5, 10), this.material("#203851")); sleeve.rotation.x = -1.05; sleeve.position.set(0.34, -0.42, -0.44);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), this.material("#c69674")); hand.position.set(0.34, -0.35, -0.62); hand.scale.set(0.85, 0.6, 1.4);
    const watch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.09), this.material("#97bbca", 0.8, 0.2)); watch.position.set(0.34, -0.34, -0.53);
    this.hand.add(sleeve, hand, watch); this.camera.add(this.hand);
  }

  private bindControls() {
    const on = <K extends keyof WindowEventMap>(name: K, fn: (event: WindowEventMap[K]) => void) => { window.addEventListener(name, fn); this.cleanups.push(() => window.removeEventListener(name, fn)); };
    on("keydown", (event) => {
      if (!this.settings.running || this.settings.conversation || (event.target as HTMLElement)?.closest("button,input,a,textarea")) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === "KeyE") this.interact();
      if (event.code === "KeyF") this.throw();
      if (event.code === "KeyM") this.events.map();
      if (event.code === "Space") this.jump();
    });
    on("keyup", (event) => this.keys.delete(event.code));
    on("blur", () => { this.keys.clear(); this.touch = { x: 0, z: 0 }; });
    const change = () => { const locked = document.pointerLockElement === this.renderer.domElement; this.keys.clear(); this.events.lock(locked); };
    document.addEventListener("pointerlockchange", change); this.cleanups.push(() => document.removeEventListener("pointerlockchange", change));
    on("mousemove", (event) => { if (document.pointerLockElement === this.renderer.domElement && this.settings.running && !this.settings.conversation) this.look(event.movementX, event.movementY); });
    let drag: { x: number; y: number; id: number } | null = null;
    const canvas = this.renderer.domElement;
    const down = (event: PointerEvent) => { if (!this.settings.running || this.settings.conversation) return; if (event.pointerType === "mouse") this.capture(); else { drag = { x: event.clientX, y: event.clientY, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); } };
    const move = (event: PointerEvent) => { if (drag?.id !== event.pointerId) return; this.look((event.clientX - drag.x) * 1.6, (event.clientY - drag.y) * 1.6); drag.x = event.clientX; drag.y = event.clientY; };
    const up = () => { drag = null; };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    this.cleanups.push(() => { canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); });
    const lost = (event: Event) => { event.preventDefault(); this.events.fail("The 3D view was interrupted. Restart the day to reconnect."); };
    canvas.addEventListener("webglcontextlost", lost); this.cleanups.push(() => canvas.removeEventListener("webglcontextlost", lost));
  }

  capture = () => {
    this.renderer.domElement.focus({ preventScroll: true });
    if (window.matchMedia("(pointer: fine)").matches && this.renderer.domElement.requestPointerLock) {
      try { const result = this.renderer.domElement.requestPointerLock(); result?.catch(() => this.events.toast("Mouse capture unavailable. Use the arrow keys to look around.")); } catch { this.events.toast("Use arrow keys to turn and WASD to move."); }
    }
    if (!this.audio) try { this.audio = new AudioContext(); } catch { /* Sound is optional. */ }
    void this.audio?.resume();
  };
  release = () => { this.keys.clear(); this.touch = { x: 0, z: 0 }; if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); };
  move = (x: number, z: number) => { this.touch = { x, z }; };
  look = (x: number, y: number) => { this.yaw -= x * 0.002; this.pitch = THREE.MathUtils.clamp(this.pitch - y * 0.002, -1.25, 1.25); };
  jump = () => { if (this.settings.running && !this.settings.conversation && this.grounded) { this.velocity.y = 4.3; this.grounded = false; } };

  interact = () => {
    if (!this.settings.running || this.settings.conversation) return;
    if (this.held) { this.held = null; return; }
    const id = this.target?.id;
    if (!id) return;
    if (id.startsWith("door:")) { const door = this.doors[Number(id.split(":")[1])]; door.open = !door.open; this.tone(180, 0.08, 0.025); }
    else if (id.startsWith("prop:")) this.held = this.props[Number(id.split(":")[1])];
    else if (id === "coffee") { this.coffee = true; this.events.toast("Coffee secured. You’ve got this."); this.tone(520, 0.13, 0.04); }
    else if (id === "report") this.events.toast("Board note: revenue is growing. Manual work is growing faster.");
    else if (id === "terminal") this.events.toast("Operations brief: connect the workflow before adding another handoff.");
    else if (id.startsWith("person:")) {
      const name = id.slice(7), event = this.settings.encounter;
      if (event?.person === name) { this.events.interact(event.id); this.release(); }
      else this.events.toast(`${name.startsWith("ambient") ? "Colleague" : name}: “Let’s catch up after the next meeting.”`);
    }
  };

  throw = () => {
    if (!this.held || !this.settings.running || this.settings.conversation) return;
    this.camera.getWorldDirection(this.direction); this.held.body.setLinvel(this.direction.multiplyScalar(7.5), true);
    this.held.body.setAngvel({ x: 2, y: 3, z: 1 }, true); this.held = null; this.tone(240, 0.05, 0.025);
  };

  private tone(frequency: number, duration: number, volume: number) {
    if (!this.audio || this.settings.muted) return;
    const osc = this.audio.createOscillator(), gain = this.audio.createGain(); osc.type = "sine"; osc.frequency.setValueAtTime(frequency, this.audio.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency / 3), this.audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, this.audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
    osc.connect(gain); gain.connect(this.audio.destination); osc.start(); osc.stop(this.audio.currentTime + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  private updateTarget() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera); this.raycaster.far = 3.1;
    this.target = null;
    for (const hit of this.raycaster.intersectObjects(this.scene.children, true)) {
      if (this.hand === hit.object.parent || hit.object.parent === this.marker || hit.object === this.marker) continue;
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.interact) object = object.parent;
      const id = object?.userData.interact as string | undefined;
      if (id) {
        let prompt = "Inspect";
        if (id.startsWith("door:")) { const door = this.doors[Number(id.split(":")[1])]; prompt = `${door.open ? "Close" : "Open"} ${door.room} door`; }
        else if (id.startsWith("prop:")) prompt = "Pick up carton";
        else if (id.startsWith("person:")) { const person = id.slice(7); prompt = `Talk to ${person.startsWith("ambient") ? "colleague" : person}`; }
        else if (id === "coffee") prompt = this.coffee ? "One coffee was enough" : "Get a coffee";
        else if (id === "report") prompt = "Read the board note";
        else if (id === "terminal") prompt = "Read operations brief";
        this.target = { id, prompt };
      }
      // Solid geometry and glass both prevent interaction through walls.
      break;
    }
  }

  private physicsStep(dt: number) {
    const moving = this.settings.running && !this.settings.conversation;
    let forward = moving ? Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) - this.touch.z : 0;
    let side = moving ? Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")) + this.touch.x : 0;
    const length = Math.hypot(forward, side); if (length > 1) { forward /= length; side /= length; }
    if (moving) this.yaw += (Number(this.keys.has("ArrowLeft")) - Number(this.keys.has("ArrowRight"))) * dt * 1.7;
    const speed = this.keys.has("ShiftLeft") ? 4.6 : 2.8;
    this.velocity.x = approachVelocity(this.velocity.x, (side * Math.cos(this.yaw) - forward * Math.sin(this.yaw)) * speed, dt);
    this.velocity.z = approachVelocity(this.velocity.z, (-forward * Math.cos(this.yaw) - side * Math.sin(this.yaw)) * speed, dt);
    this.velocity.y = Math.max(-18, this.velocity.y - 9.81 * dt);
    this.controller.computeColliderMovement(this.capsule, { x: this.velocity.x * dt, y: this.velocity.y * dt, z: this.velocity.z * dt }, undefined, undefined,
      (collider) => !this.held || collider.parent()?.handle !== this.held.body.handle);
    const movement = this.controller.computedMovement(), position = this.player.translation();
    this.player.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
    this.grounded = this.controller.computedGrounded(); if (this.grounded && this.velocity.y < 0) this.velocity.y = -0.3;
    for (const door of this.doors) {
      const desired = door.open ? (door.pivot.x < 0 ? -1.45 : 1.45) : 0;
      door.angle = THREE.MathUtils.damp(door.angle, desired, 7, dt);
      door.mesh.rotation.y = door.angle;
      door.body.setNextKinematicTranslation({ x: door.pivot.x + Math.sin(door.angle) * 1.075, y: 1.4, z: door.pivot.z + Math.cos(door.angle) * 1.075 });
      door.body.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, door.angle));
    }
    for (const npc of this.npcs.values()) npc.body.setNextKinematicTranslation({ x: npc.group.position.x, y: 0.9, z: npc.group.position.z });
    if (this.held) {
      const target = new THREE.Vector3(0.35, -0.15, -1.5).applyQuaternion(this.camera.quaternion).add(this.camera.position);
      const current = this.held.body.translation();
      const velocity = target.sub(new THREE.Vector3(current.x, current.y, current.z)).multiplyScalar(9).clampLength(0, 9);
      this.held.body.setLinvel(velocity, true); this.held.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.world.timestep = dt; this.world.step();
    for (const prop of this.props) {
      const p = prop.body.translation();
      if (p.y < -2 || Math.abs(p.x) > 19 || Math.abs(p.z) > 15) { prop.body.setTranslation(prop.start, true); prop.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      prop.mesh.position.copy(prop.body.translation()); prop.mesh.quaternion.copy(prop.body.rotation());
    }
  }

  private updatePeople(dt: number, time: number) {
    const event = this.settings.encounter;
    if (event?.id !== this.lastEncounter) {
      this.lastEncounter = event?.id ?? null;
      if (event) this.tone(700, 0.25, 0.035);
    }
    for (const [name, npc] of this.npcs) {
      const active = name === event?.person;
      let target = active ? event!.position : npc.home;
      // The accountant steps into the corridor to greet you when you pass Finance.
      const p = this.player.translation();
      if (active && name === "Emma" && p.z > 5 && p.z < 11 && p.x > -7 && p.x < 3) target = { x: Math.min(-1.5, p.x - 1.8), z: 8 };
      const delta = new THREE.Vector2(target.x - npc.group.position.x, target.z - npc.group.position.z);
      const distance = delta.length();
      if (distance > 0.08 && !this.settings.conversation && this.settings.running) {
        // Cross-room transfers use the corridor and each room's doorway.
        let waypoint = target;
        const currentZone = officeZone(npc.group.position), targetZone = officeZone(target);
        if (currentZone !== targetZone && Math.abs(npc.group.position.x) > 3) {
          const doorwayZ = npc.group.position.z > 3 ? 8 : npc.group.position.z > -6 ? -1 : -10;
          waypoint = Math.abs(npc.group.position.z - doorwayZ) > 0.2 ? { x: npc.group.position.x, z: doorwayZ } : { x: 0, z: doorwayZ };
        } else if (Math.abs(npc.group.position.x) <= 3 && Math.abs(target.x) > 4 && Math.abs(npc.group.position.z - (target.z > 3 ? 8 : target.z > -6 ? -1 : -10)) > 0.2) {
          waypoint = { x: 0, z: target.z > 3 ? 8 : target.z > -6 ? -1 : -10 };
        }
        const step = new THREE.Vector2(waypoint.x - npc.group.position.x, waypoint.z - npc.group.position.z);
        const amount = Math.min(step.length(), dt * 1.15); step.normalize();
        npc.group.position.x += step.x * amount; npc.group.position.z += step.y * amount;
        npc.group.rotation.y = Math.atan2(step.x, step.y); npc.phase += dt * 7;
      } else {
        if (active) npc.group.rotation.y = Math.atan2(p.x - npc.group.position.x, p.z - npc.group.position.z);
        npc.phase *= Math.max(0, 1 - dt * 7);
      }
      npc.arms.forEach((arm, i) => arm.rotation.x = Math.sin(npc.phase + i * Math.PI) * 0.25 + (active ? Math.sin(time * 2) * 0.06 : 0));
      npc.legs.forEach((leg, i) => leg.rotation.x = Math.sin(npc.phase + i * Math.PI) * 0.3);
      npc.group.position.y = Math.sin(time * 1.7) * 0.005;
    }
    const active = event ? this.npcs.get(event.person) : null;
    this.marker.visible = Boolean(active && this.settings.running && !this.settings.conversation);
    if (active) { this.marker.position.copy(active.group.position); this.marker.position.y = 2.3 + Math.sin(time * 3) * 0.07; this.marker.quaternion.copy(this.camera.quaternion); }
  }

  private animate = (now: number) => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.animate);
    const realSeconds = this.previous ? (now - this.previous) / 1000 : 0;
    const dt = Math.min(realSeconds, 0.05);
    this.previous = now;
    if (document.hidden) { this.accumulator = 0; return; }
    const active = this.settings.running;
    if (active) {
      this.events.frame(realSeconds);
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60) { this.physicsStep(1 / 60); this.accumulator -= 1 / 60; }
    }
    const p = this.player.translation();
    const motion = Math.hypot(this.velocity.x, this.velocity.z);
    if (active && this.grounded) this.walking += dt * motion * 2.5;
    const bob = active && !this.settings.reducedMotion ? Math.sin(this.walking) * 0.018 * Math.min(1, motion) : 0;
    this.camera.position.set(p.x, p.y + 0.74 + bob, p.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    if (!active && this.settings.elapsed === 0) this.camera.rotation.y = Math.sin(now * 0.00008) * 0.09;
    this.hand.visible = active && !this.settings.conversation;
    this.hand.position.y = bob * 0.7;
    if (motion > 0.6 && this.grounded && active && now - this.lastStep > 380 / Math.max(1, motion / 2.8)) { this.lastStep = now; this.tone(officeZone(p) === "Finance" ? 100 : 145, 0.08, 0.045); }
    this.updatePeople(active ? dt : 0, now / 1000);
    this.uiAccumulator += dt;
    if (this.uiAccumulator > 0.1) {
      this.uiAccumulator = 0; this.updateTarget();
      const npc = this.settings.encounter ? this.npcs.get(this.settings.encounter.person) : null;
      this.events.status({ position: { x: p.x, z: p.z }, yaw: this.yaw, zone: officeZone(p),
        prompt: this.held ? "Drop carton · F to throw" : this.target?.prompt ?? "", target: this.target?.id ?? null,
        distance: npc ? Math.hypot(npc.group.position.x - p.x, npc.group.position.z - p.z) : 0, held: Boolean(this.held) });
    }
    this.scene.environmentIntensity = 0.45 - this.settings.elapsed / 300 * 0.1;
    this.composer.render();
  };

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frameId); this.release(); this.resize.disconnect(); this.cleanups.forEach((cleanup) => cleanup());
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse((object) => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material)); } });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); this.textures.forEach((texture) => texture.dispose());
    this.environment.dispose(); this.composer.passes.forEach((pass) => pass.dispose()); this.composer.dispose(); this.renderer.dispose(); this.world.free(); void this.audio?.close();
    this.renderer.domElement.remove();
  }
}
