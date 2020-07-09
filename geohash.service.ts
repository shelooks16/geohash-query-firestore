import firebase from "firebase/app";
import {
  encode,
  neighbors,
  setPrecision,
  distance,
  getNestedKey,
} from "./geohash.utils";
import { GeoData, Coords } from "./geohash.types";

type FirestoreQuery =
  | firebase.firestore.Query
  | firebase.firestore.CollectionReference
  | FirebaseFirestore.CollectionReference
  | FirebaseFirestore.Query;

type GeoSearchOptions = {
  center: Coords;
  radius: number;
  field: string;
};

type GeoSearchResult = {
  geoMetadata: {
    distance: number;
  };
};

class GeohashService {
  private geohashLength = 9;

  /**
   * Creates GeoData object
   */
  createGeoData(lat: number, lng: number): GeoData {
    return {
      geopoint: new firebase.firestore.GeoPoint(lat, lng),
      geohash: encode(lat, lng, this.geohashLength),
    };
  }

  /**
   * Geo search for docs within radius
   * @param fsQuery Firestore query builder object
   * @param center Pivot for geo query
   * @param radius Radius in Kilometers
   * @param field Field of GeoData object inside document
   */
  async performSearch<T>(
    fsQuery: FirestoreQuery,
    { center, radius, field }: GeoSearchOptions
  ): Promise<(T & GeoSearchResult)[]> {
    const precision = setPrecision(radius);
    const radiusBuffer = radius * 1.01; // buffer for edge distances
    const centerHash = encode(
      center.lat,
      center.lng,
      this.geohashLength
    ).substr(0, precision);
    const area = neighbors(centerHash).concat(centerHash);

    const queryPromises = area.map(async (hash) => {
      const query = this.queryByGeohash(fsQuery, hash, field);
      const snap = await query.get();
      return this.snapToData(snap as firebase.firestore.QuerySnapshot);
    });

    const queries = await Promise.all(queryPromises);
    const reduced = queries.reduce((acc, curr) => acc.concat(curr), []);

    const filtered = reduced.filter((val, pos, arr) => {
      const { latitude, longitude } = this.getGeoPoint(val, field);

      return (
        distance([center.lat, center.lng], [latitude, longitude]) <=
          radiusBuffer && arr.findIndex((v) => v.id === val.id) === pos
      );
    });

    return filtered
      .map((val) => {
        const { latitude, longitude } = this.getGeoPoint(val, field);

        const geoMetadata = {
          distance: distance([center.lat, center.lng], [latitude, longitude]),
        };
        return { ...val, geoMetadata } as T & GeoSearchResult;
      })
      .sort((a, b) => a.geoMetadata.distance - b.geoMetadata.distance);
  }

  private queryByGeohash(
    query: FirestoreQuery,
    geohash: string,
    field: string
  ) {
    const end = geohash + "~";
    return query.orderBy(`${field}.geohash`).startAt(geohash).endAt(end);
  }

  private snapToData(querySnap: firebase.firestore.QuerySnapshot, id = "id") {
    return querySnap.docs.map((v) => {
      return {
        ...(id ? { [id]: v.id } : null),
        ...v.data(),
      };
    });
  }

  private getGeoPoint(val: { [key: string]: any }, fieldPath: string) {
    if (fieldPath.includes(".")) {
      const data = getNestedKey(val, fieldPath) as GeoData;
      return data.geopoint;
    }
    return val[fieldPath].geopoint;
  }
}

export default new GeohashService();
