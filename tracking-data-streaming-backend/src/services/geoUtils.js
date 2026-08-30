/**
 * Geographic utility functions — no external dependencies
 */

/**
 * Haversine distance between two coordinates (in metres)
 */
const haversineDistanceM = (lat1, lng1, lat2, lng2) => {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Generate a circle approximation as a closed polygon ring.
 * Returns coordinate pairs in counter-clockwise order (AWS requirement).
 *
 * @param {number} centerLng
 * @param {number} centerLat
 * @param {number} radiusM   radius in metres
 * @param {number} steps     number of polygon vertices (default 64)
 * @returns {Array<[number,number]>} [[lng, lat], ...]
 */
const convertCounterClockwise = (vertices) => {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }
  return area / 2 > 0 ? vertices : vertices.reverse();
};

const generateCirclePolygon = (centerLng, centerLat, radiusM, steps = 64) => {
  const coords = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLng = (radiusM / 111_320) / Math.cos((centerLat * Math.PI) / 180);
    const dLat = radiusM / 110_540;
    coords.push([
      centerLng + dLng * Math.cos(angle),
      centerLat + dLat * Math.sin(angle),
    ]);
  }
  coords.push(coords[0]);
  return convertCounterClockwise(coords);
};

module.exports = { haversineDistanceM, generateCirclePolygon };
