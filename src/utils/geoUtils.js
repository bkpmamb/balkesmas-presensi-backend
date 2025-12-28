// Rumus Haversine
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // meter
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const validateDistance = (userLat, userLon) => {
  const officeLat = -7.0051;
  const officeLong = 110.4381;
  const maxDistance = 100;

  const distance = getDistance(userLat, userLon, officeLat, officeLong);

  return {
    isWithinRange: distance <= maxDistance,
    distance: Math.round(distance),
  };
};
