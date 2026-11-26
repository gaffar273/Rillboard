(function (root, factory) {
  const shapes = factory();
  if (typeof module === 'object' && module.exports) module.exports = shapes;
  else root.DrawingShapes = shapes;
})(globalThis, function () {
  'use strict';
  const shapes = Object.create(null);
  function add(tool, name, group, options = {}) {
    shapes[tool] = { tool, name, group, type: tool, ...options };
  }
  const plane = 'Plane shapes';
  add('circle', 'Circle', plane, { type: 'ellipse', aspect: 1 });
  add('ellipse', 'Ellipse', plane);
  add('square', 'Square', plane, { type: 'rectangle', aspect: 1 });
  add('rectangle', 'Rectangle', plane);
  add('diamond', 'Diamond', plane);
  add('line', 'Line', plane);
  add('arrow', 'Arrow', plane);

  // Keep one outline for the preview, drawing, hit testing and lasso.
  function normalize(outline, edges = [], hidden = []) {
    const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    const scale = ([px, py]) => [(px - x) / w, (py - y) / h];
    return { aspect: w / h, outline: outline.map(scale),
      edges: edges.map(path => path.map(scale)), hidden: hidden.map(path => path.map(scale)) };
  }
  function polygon(tool, name, points) {
    add(tool, name, plane, normalize(points));
  }
  for (const [tool, name, sides] of [
    ['triangle', 'Triangle', 3], ['pentagon', 'Pentagon', 5],
    ['hexagon', 'Hexagon', 6], ['octagon', 'Octagon', 8]
  ]) {
    polygon(tool, name, Array.from({length: sides}, (_, i) => {
      const angle = 2 * Math.PI * i / sides - Math.PI / 2 + (sides === 8 ? Math.PI / 8 : 0);
      return [Math.cos(angle), Math.sin(angle)];
    }));
  }
  polygon('right-triangle', 'Right triangle', [[0,0],[1,1],[0,1]]);
  polygon('parallelogram', 'Parallelogram', [[.3,0],[1.5,0],[1.2,1],[0,1]]);
  polygon('trapezoid', 'Trapezoid', [[.35,0],[1.15,0],[1.5,.85],[0,.85]]);

  // Project representative lattice parameters in a common oblique view.
  // Alpha is the angle between b and c, beta between a and c, gamma between a and b.
  function cell(tool, name, a, b, c, alpha, beta, gamma) {
    const radians = Math.PI / 180;
    const cos = degrees => Math.cos(degrees * radians);
    const sine = Math.sin(gamma * radians);
    const cx = c * cos(beta), cy = c * (cos(alpha) - cos(beta) * cos(gamma)) / sine;
    const cz = Math.sqrt(c*c - cx*cx - cy*cy);
    const axes = [[a,0,0], [b*cos(gamma),b*sine,0], [cx,cy,cz]]
      .map(([x,y,z]) => [x + .38*y, -z - .42*y]);
    const vertices = Array.from({length: 8}, (_, mask) =>
      axes.reduce(([x,y], [dx,dy], i) => mask & (1 << i) ? [x+dx,y+dy] : [x,y], [0,0]));
    // From the rear corner, its three neighbors form alternating silhouette vertices.
    let rear = 0;
    for (let i = 0; i < 3; i++) {
      const u = axes[(i+1)%3], v = axes[(i+2)%3];
      if (u[0]*v[1] - u[1]*v[0] > 0) rear |= 1 << i;
    }
    const vertex = offset => vertices[rear ^ offset];
    const spokes = (from, ends) => ends.map(to => [vertex(from), vertex(to)]);
    add(tool, name, '3D shapes', normalize(
      [1,3,2,6,4,5].map(vertex), spokes(7,[6,5,3]), spokes(0,[1,2,4])));
  }
  cell('cubic','Cubic',1,1,1,90,90,90);
  cell('tetragonal','Tetragonal',1,1,1.65,90,90,90);
  cell('orthorhombic','Orthorhombic',1.7,.85,1.1,90,90,90);
  cell('hexagonal-cell','Hexagonal',1,1,1.4,90,90,120);
  cell('rhombohedral','Rhombohedral',1,1,1,72,72,72);
  cell('monoclinic','Monoclinic',1.25,.85,1.5,90,108,90);
  cell('triclinic','Triclinic',1.3,.9,1.45,74,105,112);
  return shapes;
});
