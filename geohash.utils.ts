/////// NGEOHASH ////////

const BASE32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz";
const BASE32_CODES_DICT = {};
for (let i = 0; i < BASE32_CODES.length; i++) {
  BASE32_CODES_DICT[BASE32_CODES.charAt(i)] = i;
}

const ENCODE_AUTO = "auto";
/**
 * Significant Figure Hash Length
 *
 * This is a quick and dirty lookup to figure out how long our hash
 * should be in order to guarantee a certain amount of trailing
 * significant figures. This was calculated by determining the error:
 * 45/2^(n-1) where n is the number of bits for a latitude or
 * longitude. Key is # of desired sig figs, value is minimum length of
 * the geohash.
 * @type Array
 */
//     Desired sig figs:  0  1  2  3  4   5   6   7   8   9  10
const SIGFIG_HASH_LENGTH = [0, 5, 7, 8, 11, 12, 13, 15, 16, 17, 18];
/**
 * Encode
 *
 * Create a Geohash out of a latitude and longitude that is
 * `numberOfChars` long.
 *
 * @param {Number|String} latitude
 * @param {Number|String} longitude
 * @param {Number} numberOfChars
 * @returns {String}
 */
export const encode = function (latitude, longitude, numberOfChars) {
  if (numberOfChars === ENCODE_AUTO) {
    if (typeof latitude === "number" || typeof longitude === "number") {
      throw new Error("string notation required for auto precision.");
    }
    const decSigFigsLat = latitude.split(".")[1].length;
    const decSigFigsLong = longitude.split(".")[1].length;
    const numberOfSigFigs = Math.max(decSigFigsLat, decSigFigsLong);
    numberOfChars = SIGFIG_HASH_LENGTH[numberOfSigFigs];
  } else if (numberOfChars === undefined) {
    numberOfChars = 9;
  }

  const chars = [];
  let bits = 0,
    bitsTotal = 0,
    hash_value = 0,
    maxLat = 90,
    minLat = -90,
    maxLon = 180,
    minLon = -180,
    mid;

  while (chars.length < numberOfChars) {
    if (bitsTotal % 2 === 0) {
      mid = (maxLon + minLon) / 2;
      if (longitude > mid) {
        hash_value = (hash_value << 1) + 1;
        minLon = mid;
      } else {
        hash_value = (hash_value << 1) + 0;
        maxLon = mid;
      }
    } else {
      mid = (maxLat + minLat) / 2;
      if (latitude > mid) {
        hash_value = (hash_value << 1) + 1;
        minLat = mid;
      } else {
        hash_value = (hash_value << 1) + 0;
        maxLat = mid;
      }
    }

    bits++;
    bitsTotal++;
    if (bits === 5) {
      const code = BASE32_CODES[hash_value];
      chars.push(code);
      bits = 0;
      hash_value = 0;
    }
  }
  return chars.join("");
};

/**
 * Decode Bounding Box
 *
 * Decode hashString into a bound box matches it. Data returned in a four-element array: [minlat, minlon, maxlat, maxlon]
 * @param {String} hash_string
 * @returns {Array}
 */
export const decode_bbox = function (hash_string) {
  let isLon = true,
    maxLat = 90,
    minLat = -90,
    maxLon = 180,
    minLon = -180,
    mid;

  let hashValue = 0;
  for (let i = 0, l = hash_string.length; i < l; i++) {
    const code = hash_string[i].toLowerCase();
    hashValue = BASE32_CODES_DICT[code];

    for (let bits = 4; bits >= 0; bits--) {
      const bit = (hashValue >> bits) & 1;
      if (isLon) {
        mid = (maxLon + minLon) / 2;
        if (bit === 1) {
          minLon = mid;
        } else {
          maxLon = mid;
        }
      } else {
        mid = (maxLat + minLat) / 2;
        if (bit === 1) {
          minLat = mid;
        } else {
          maxLat = mid;
        }
      }
      isLon = !isLon;
    }
  }
  return [minLat, minLon, maxLat, maxLon];
};

/**
 * Decode
 *
 * Decode a hash string into pair of latitude and longitude. A javascript object is returned with keys `latitude`,
 * `longitude` and `error`.
 * @param {String} hashString
 * @returns {Object}
 */
export const decode = function (hashString) {
  const bbox = decode_bbox(hashString);
  const lat = (bbox[0] + bbox[2]) / 2;
  const lon = (bbox[1] + bbox[3]) / 2;
  const latErr = bbox[2] - lat;
  const lonErr = bbox[3] - lon;
  return {
    latitude: lat,
    longitude: lon,
    error: { latitude: latErr, longitude: lonErr },
  };
};

/**
 * Neighbors
 *
 * Returns all neighbors' hashstrings clockwise from north around to northwest
 * 7 0 1
 * 6 x 2
 * 5 4 3
 * @param {String} hash_string
 * @returns {encoded neighborHashList|Array}
 */
export const neighbors = function (hash_string) {
  const hashstringLength = hash_string.length;

  const lonlat = decode(hash_string);
  const lat = lonlat.latitude;
  const lon = lonlat.longitude;
  const latErr = lonlat.error.latitude * 2;
  const lonErr = lonlat.error.longitude * 2;

  let neighbor_lat, neighbor_lon;

  const neighborHashList = [
    encodeNeighbor(1, 0),
    encodeNeighbor(1, 1),
    encodeNeighbor(0, 1),
    encodeNeighbor(-1, 1),
    encodeNeighbor(-1, 0),
    encodeNeighbor(-1, -1),
    encodeNeighbor(0, -1),
    encodeNeighbor(1, -1),
  ];

  function encodeNeighbor(neighborLatDir, neighborLonDir) {
    neighbor_lat = lat + neighborLatDir * latErr;
    neighbor_lon = lon + neighborLonDir * lonErr;
    return encode(neighbor_lat, neighbor_lon, hashstringLength);
  }

  return neighborHashList;
};

//--------------
export function setPrecision(km: number) {
  switch (true) {
    case km <= 0.00477:
      return 9;

    case km <= 0.0382:
      return 8;

    case km <= 0.153:
      return 7;

    case km <= 1.22:
      return 6;

    case km <= 4.89:
      return 5;

    case km <= 39.1:
      return 4;

    case km <= 156:
      return 3;

    case km <= 1250:
      return 2;

    default:
      return 1;
  }
  // 1	≤ 5,000km	×	5,000km
  // 2	≤ 1,250km	×	625km
  // 3	≤ 156km	×	156km
  // 4	≤ 39.1km	×	19.5km
  // 5	≤ 4.89km	×	4.89km
  // 6	≤ 1.22km	×	0.61km
  // 7	≤ 153m	×	153m
  // 8	≤ 38.2m	×	19.1m
  // 9	≤ 4.77m	×	4.77m
}

const EARTH_RADIUS = 6371008.8;

function degreesToRadians(degrees: number): number {
  const radians = degrees % 360;
  return (radians * Math.PI) / 180;
}

function radiansToKmLength(radians: number): number {
  return radians * (EARTH_RADIUS / 1000);
}

type Coordinates = [number, number];

export function distance(fromLatLng: Coordinates, toLatLng: Coordinates) {
  const from = flip(fromLatLng);
  const to = flip(toLatLng);

  const dLat = degreesToRadians(to[1] - from[1]);
  const dLon = degreesToRadians(to[0] - from[0]);
  const lat1 = degreesToRadians(from[1]);
  const lat2 = degreesToRadians(to[1]);

  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);

  return radiansToKmLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function flip(arr: [any, any]) {
  return [arr[1], arr[0]];
}

export function getNestedKey(obj: any, path: string, fallbackVal?: any) {
  for (let i = 0, pList = path.split("."), len = pList.length; i < len; i++) {
    if (!obj || typeof obj !== "object") {
      return fallbackVal;
    }
    obj = obj[pList[i]];
  }

  if (obj === undefined) return fallbackVal;
  return obj;
}
