export const DEFAULT_DOCTORS = [
  {
    id: "dr-nader-bhm",
    name: "Dr. Nader BHM",
    specialty: "General Medicine",
    email: "nhmbhig@gmail.com",
    clinic: "BHM Medical Point",
    city: "Algiers",
    phone: "+213 55 20 11 02",
    lat: 36.7538,
    lng: 3.0588,
  },
];

export function normalizeDoctorDoc(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    name: String(data.name || "Unknown Doctor").trim(),
    specialty: String(data.specialty || "General Medicine").trim(),
    email: String(data.email || "").trim(),
    clinic: String(data.clinic || "").trim(),
    city: String(data.city || "").trim(),
    phone: String(data.phone || "").trim(),
    lat: Number.isFinite(Number(data.lat ?? data.latitude))
      ? Number(data.lat ?? data.latitude)
      : null,
    lng: Number.isFinite(Number(data.lng ?? data.longitude))
      ? Number(data.lng ?? data.longitude)
      : null,
    isActive: data.isActive !== false,
  };
}