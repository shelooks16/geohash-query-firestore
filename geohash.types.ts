export type Coords = {
  lat: number;
  lng: number;
};

export type GeoData = {
  geopoint: firebase.firestore.GeoPoint;
  geohash: string;
};
