// Point fragment shader — soft circular splat that keeps the PHOTOGRAPHIC
// color of the source data. Alpha blending, no additive glow: dark asphalt
// must stay dark.

precision highp float;

uniform float uOpacity;
uniform float uSaturation;
uniform float uDepthFadeStart;
uniform float uDepthFadeEnd;

varying vec3 vColor;
varying float vAlpha;
varying float vViewDist;

void main() {
  // soft circular falloff, slightly elliptical to suggest surface splats
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  uv.y *= 1.25;
  float d2 = dot(uv, uv);
  if (d2 > 1.0) discard;
  float soft = 1.0 - smoothstep(0.35, 1.0, d2);

  // adjustable saturation around luminance — lets the scene drift toward a
  // documentary desaturated look without losing the source image
  float luma = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
  vec3 col = mix(vec3(luma), vColor, uSaturation);

  // subtle depth fade into the background, never fully erasing structure
  float fade = 1.0 - smoothstep(uDepthFadeStart, uDepthFadeEnd, vViewDist) * 0.85;

  float a = uOpacity * vAlpha * soft * fade;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
