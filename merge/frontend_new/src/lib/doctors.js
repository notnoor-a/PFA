export const DEFAULT_DOCTORS = [
  {
    id: "dr-nader-bhm",
    name: "Dr. Nader BHM",
    specialty: "General Medicine",
    email: "nhmbhig@gmail.com",
    clinic: "Hopital Fattouma Bourguiba",
    city: "Monastir",
    phone: "+213 55 20 11 02",
    lat: 35.770111,
    lng: 10.834,
    locationLabel: "N\u00B0 35.77011, E\u00B0 10.83400",
  },
];

const DEMO_DOCTOR_KEYS = new Set(["dr-nader-bhm"]);
const DEMO_DOCTOR_EMAIL = "nhmbhig@gmail.com";
const DEMO_DOCTOR_NAME = "dr. nader bhm";

export function formatCoordinateLabel(lat, lng, precision = 5) {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return "";

  const ns = safeLat < 0 ? "S" : "N";
  const ew = safeLng < 0 ? "W" : "E";
  return `${ns}\u00B0 ${Math.abs(safeLat).toFixed(precision)}, ${ew}\u00B0 ${Math.abs(safeLng).toFixed(precision)}`;
}

function applyDemoDoctorOverrides(doctor) {
  const name = String(doctor.name || "").trim().toLowerCase();
  const email = String(doctor.email || "").trim().toLowerCase();
  const id = String(doctor.id || "").trim().toLowerCase();

  if (!DEMO_DOCTOR_KEYS.has(id) && email !== DEMO_DOCTOR_EMAIL && name !== DEMO_DOCTOR_NAME) {
    return doctor;
  }

  return {
    ...doctor,
    name: "Dr. Nader BHM",
    clinic: "Hopital Fattouma Bourguiba",
    city: "Monastir",
    lat: 35.770111,
    lng: 10.834,
    locationLabel: formatCoordinateLabel(35.770111, 10.834),
  };
}

function parseCoordinateValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value || "").trim();
  if (!raw) return null;

  const decimal = raw.replace(",", ".");
  if (/^[+-]?\d+(?:\.\d+)?$/.test(decimal)) {
    const numeric = Number(decimal);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const dms = raw.match(
    /^([+-]?\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)?\D*(\d+(?:\.\d+)?)?\s*([NSEW])?$/i
  );
  if (!dms) return null;

  const degrees = Number(dms[1]);
  const minutes = Number(dms[2] || 0);
  const seconds = Number(dms[3] || 0);
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;

  let sign = degrees < 0 ? -1 : 1;
  const hemisphere = String(dms[4] || "").toUpperCase();
  if (hemisphere === "S" || hemisphere === "W") sign = -1;
  if (hemisphere === "N" || hemisphere === "E") sign = 1;

  return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
}

function resolveCoordinates(data) {
  const latRaw = data.lat ?? data.latitude ?? data.location?.latitude ?? data.location?._latitude;
  const lngRaw = data.lng ?? data.longitude ?? data.location?.longitude ?? data.location?._longitude;

  let lat = parseCoordinateValue(latRaw);
  let lng = parseCoordinateValue(lngRaw);

  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }

  if (!Number.isFinite(lat) || Math.abs(lat) > 90) lat = null;
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) lng = null;

  return { lat, lng };
}

export function normalizeDoctorDoc(snapshot) {
  const data = snapshot.data() || {};
  const { lat, lng } = resolveCoordinates(data);
  const storedLocationLabel = String(data.locationLabel || "").trim();

  return applyDemoDoctorOverrides({
    id: snapshot.id,
    name: String(data.name || "Unknown Doctor").trim(),
    specialty: String(data.specialty || "General Medicine").trim(),
    email: String(data.email || "").trim(),
    clinic: String(data.clinic || "").trim(),
    city: String(data.city || "").trim(),
    phone: String(data.phone || "").trim(),
    lat,
    lng,
    locationLabel: storedLocationLabel || formatCoordinateLabel(lat, lng),
    isActive: data.isActive !== false,
  });
}
