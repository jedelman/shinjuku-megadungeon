// The PS1 look, which is also the performance budget:
// - render at 240 lines into a nearest-filtered target, then blit it up
// - snap vertices to that low-res pixel grid (the wobble)
// - affine texture mapping (WebGL2 has no `noperspective`, so carry uv*w and divide)
// - 15-bit colour with a 4x4 Bayer dither on the blit
// - short linear fog: it is the draw distance
import * as THREE from 'three';

export const LINES = 240;

const vert = /* glsl */ `
  uniform vec2 uRes;
  uniform float uSnap;
  attribute vec3 color;
  varying vec3 vUvW;
  varying vec3 vColor;
  varying float vDist;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = -mv.z;
    vec4 clip = projectionMatrix * mv;
    if (uSnap > 0.5 && clip.w > 0.0) {
      vec2 grid = uRes * 0.5;
      clip.xy = floor(clip.xy / clip.w * grid + 0.5) / grid * clip.w;
    }
    vUvW = vec3(uv * clip.w, clip.w);
    vColor = color;
    gl_Position = clip;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  uniform float uGlow;
  varying vec3 vUvW;
  varying vec3 vColor;
  varying float vDist;
  void main() {
    vec2 uv = vUvW.xy / vUvW.z;
    vec4 tex = texture2D(uMap, uv);
    if (tex.a < 0.5) discard;
    vec3 c = tex.rgb * vColor * uTint;
    float f = clamp((vDist - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
    f = mix(f, f * 0.55, uGlow);          // lit things (signs, shopfronts) carry further
    gl_FragColor = vec4(mix(c, uFog, f), 1.0);
  }
`;

export function makeMaterial(map, { tint = 0xffffff, glow = 0, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side,
    uniforms: {
      uMap: { value: map },
      uTint: { value: new THREE.Color(tint) },
      uRes: shared.uRes,
      uSnap: shared.uSnap,
      uFog: shared.uFog,
      uFogRange: shared.uFogRange,
      uGlow: { value: glow },
    },
  });
}

// uniforms shared by every PS1 material
export const shared = {
  uRes: { value: new THREE.Vector2(426, LINES) },
  uSnap: { value: 1 },
  uFog: { value: new THREE.Color(0xa9b19c) },
  uFogRange: { value: new THREE.Vector2(3, 38) },
};

const blitFrag = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uRes;
  varying vec2 vUv;
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[i]) / 16.0 - 0.5;
  }
  void main() {
    vec2 px = floor(vUv * uRes);
    vec3 c = texture2D(uTex, (px + 0.5) / uRes).rgb;
    c += bayer(px) / 31.0;                 // dither one 5-bit step
    c = floor(c * 31.0 + 0.5) / 31.0;      // 15-bit colour
    gl_FragColor = vec4(c, 1.0);
  }
`;

export class PS1Renderer {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.r.setPixelRatio(1);
    this.r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.target = new THREE.WebGLRenderTarget(426, LINES, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
    });
    this.blit = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: blitFrag,
        uniforms: { uTex: { value: this.target.texture }, uRes: shared.uRes },
        depthTest: false, depthWrite: false,
      }),
    );
    this.blitScene = new THREE.Scene();
    this.blitScene.add(this.blit);
    this.blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  resize(w, h, camera) {
    this.r.setSize(w, h, false);
    const lw = Math.max(160, Math.round((LINES * w) / h));
    this.target.setSize(lw, LINES);
    shared.uRes.value.set(lw, LINES);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  render(scene, camera) {
    this.r.setRenderTarget(this.target);
    this.r.setClearColor(shared.uFog.value, 1);
    this.r.clear();
    this.r.render(scene, camera);
    this.r.setRenderTarget(null);
    this.r.render(this.blitScene, this.blitCam);
  }
}
