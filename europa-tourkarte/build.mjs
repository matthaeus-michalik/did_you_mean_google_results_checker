import fs from 'fs';
import {feature} from 'topojson-client';

const topo = JSON.parse(fs.readFileSync(new URL('./node_modules/world-atlas/countries-50m.json', import.meta.url)));
const fc = feature(topo, topo.objects.countries);

// --- viewport in geographic space ---
const BBOX = {w: -11.4, e: 29.6, s: 35.4, n: 61.7};

// --- Lambert conformal conic, tuned for Europe ---
const rad = Math.PI/180;
const lon0 = 10*rad, lat0 = 48*rad, p1 = 40*rad, p2 = 56*rad;
const m = f => Math.tan(Math.PI/4 + f/2);
const n = Math.log(Math.cos(p1)/Math.cos(p2)) / Math.log(m(p2)/m(p1));
const F = Math.cos(p1)*Math.pow(m(p1), n)/n;
const rho = f => F/Math.pow(m(f), n);
const rho0 = rho(lat0);
function proj([lon, lat]) {
  const t = n*(lon*rad - lon0), r = rho(lat*rad);
  return [r*Math.sin(t), rho0 - r*Math.cos(t)];
}

// --- Sutherland-Hodgman clip of a ring against the lon/lat rectangle ---
const edges = [
  {inside: p => p[0] >= BBOX.w, cut: (a,b) => [BBOX.w, a[1] + (b[1]-a[1])*(BBOX.w-a[0])/(b[0]-a[0])]},
  {inside: p => p[0] <= BBOX.e, cut: (a,b) => [BBOX.e, a[1] + (b[1]-a[1])*(BBOX.e-a[0])/(b[0]-a[0])]},
  {inside: p => p[1] >= BBOX.s, cut: (a,b) => [a[0] + (b[0]-a[0])*(BBOX.s-a[1])/(b[1]-a[1]), BBOX.s]},
  {inside: p => p[1] <= BBOX.n, cut: (a,b) => [a[0] + (b[0]-a[0])*(BBOX.n-a[1])/(b[1]-a[1]), BBOX.n]},
];
function clip(ring) {
  let out = ring;
  for (const {inside, cut} of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i], prev = src[(i + src.length - 1) % src.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) return [];
  }
  return out;
}

// --- Douglas-Peucker in projected space ---
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
  const stack = [[0, pts.length-1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, best = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx-ax, dy = by-ay, len = Math.hypot(dx, dy);
    for (let i = a+1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len ? Math.abs(dy*px - dx*py + bx*ay - by*ax)/len : Math.hypot(px-ax, py-ay);
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// --- fit: project the clipped frame to find the drawing extent ---
let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
for (let i = 0; i <= 200; i++) {
  const t = i/200;
  for (const p of [[BBOX.w + t*(BBOX.e-BBOX.w), BBOX.s], [BBOX.w + t*(BBOX.e-BBOX.w), BBOX.n],
                   [BBOX.w, BBOX.s + t*(BBOX.n-BBOX.s)], [BBOX.e, BBOX.s + t*(BBOX.n-BBOX.s)]]) {
    const [x, y] = proj(p);
    X0 = Math.min(X0, x); X1 = Math.max(X1, x); Y0 = Math.min(Y0, y); Y1 = Math.max(Y1, y);
  }
}
const W = 1000, scale = W/(X1-X0), H = Math.round((Y1-Y0)*scale);
const place = p => { const [x, y] = proj(p); return [(x-X0)*scale, (Y1-y)*scale]; };
const fmt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

const countries = [];
for (const f of fc.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = '';
  for (const poly of polys) for (const ring of poly) {
    const cut = clip(ring);
    if (cut.length < 3) continue;
    const pts = simplify(cut.map(place), 0.45);
    if (pts.length < 3) continue;
    // drop slivers that carry no visible area
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i+1) % pts.length];
      area += a[0]*b[1] - b[0]*a[1];
    }
    if (Math.abs(area/2) < 1.2) continue;
    d += `M${pts.map(fmt).join('L')}Z`;
  }
  if (d) countries.push({name: f.properties.name, d});
}

const CITIES = {
  Olbia:[9.500,40.923], Stockholm:[18.069,59.329], Paris:[2.352,48.857], Valencia:[-0.377,39.470],
  Bilbao:[-2.935,43.263], Pisa:[10.397,43.716], Catania:[15.087,37.502], Barcelona:[2.173,41.385],
  Prag:[14.437,50.076], Rimini:[12.566,44.061], Wien:[16.373,48.209], Lissabon:[-9.139,38.722],
  Chiemsee:[12.463,47.885], Nizza:[7.262,43.710], Amsterdam:[4.895,52.370], Budapest:[19.040,47.498],
  Dresden:[13.737,51.050], Bukarest:[26.103,44.427], Spessart:[9.400,50.050], 'Nürnberg':[11.077,49.452],
  'Brüssel':[4.353,50.847], Bremen:[8.802,53.079], Bratislava:[17.108,48.149], Rom:[12.496,41.903],
};
const pins = {};
for (const [k, v] of Object.entries(CITIES)) pins[k] = place(v).map(x => +x.toFixed(1));

// graticule: meridians every 10deg, parallels every 5deg
const grat = [];
for (let lon = -10; lon <= 30; lon += 10) {
  const pts = [];
  for (let i = 0; i <= 60; i++) pts.push(place([lon, BBOX.s + i/60*(BBOX.n-BBOX.s)]));
  grat.push(`M${pts.map(fmt).join('L')}`);
}
for (let lat = 35; lat <= 60; lat += 5) {
  const pts = [];
  for (let i = 0; i <= 60; i++) pts.push(place([BBOX.w + i/60*(BBOX.e-BBOX.w), lat]));
  grat.push(`M${pts.map(fmt).join('L')}`);
}

fs.writeFileSync(new URL('./mapdata.json', import.meta.url),
  JSON.stringify({W, H, countries, pins, graticule: grat.join('')}));
console.log('viewBox 0 0', W, H, '| countries:', countries.length,
  '| kb:', Math.round(countries.reduce((s,c)=>s+c.d.length,0)/1024));
console.log(Object.entries(pins).map(([k,v])=>`${k} ${v}`).join('  '));
