import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { formatCoordinateLabel } from "../lib/doctors";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [36.8065, 10.181639];
const DEFAULT_ZOOM = 6;
const FOCUS_ZOOM = 13;

function ClickCapture({ onSelect }) {
  useMapEvents({
    click(event) {
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      onSelect(lat, lng);
    },
  });
  return null;
}

function RecenterOnSelection({ lat, lng, hasSelection }) {
  const map = useMap();

  useEffect(() => {
    if (hasSelection) {
      map.setView([lat, lng], Math.max(map.getZoom(), FOCUS_ZOOM));
      return;
    }

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }, [hasSelection, lat, lng, map]);

  return null;
}

export default function LocationPickerMap({ value, onChange, onClear, labels }) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  const hasSelection = Number.isFinite(lat) && Number.isFinite(lng);
  const locationLabel = hasSelection
    ? formatCoordinateLabel(lat, lng)
    : String(value?.locationLabel || "").trim();

  const center = hasSelection ? [lat, lng] : DEFAULT_CENTER;
  const zoom = hasSelection ? FOCUS_ZOOM : DEFAULT_ZOOM;

  const selectPoint = (nextLat, nextLng) => {
    onChange({
      lat: nextLat,
      lng: nextLng,
      locationLabel: formatCoordinateLabel(nextLat, nextLng),
    });
  };

  return (
    <div className="location-picker">
      <div className="doctor-map-wrap doctor-location-picker-map-wrap">
        <MapContainer center={center} zoom={zoom} className="doctor-location-picker-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCapture onSelect={selectPoint} />
          <RecenterOnSelection lat={lat} lng={lng} hasSelection={hasSelection} />

          {hasSelection && (
            <CircleMarker
              center={[lat, lng]}
              radius={9}
              pathOptions={{
                color: "#1f4f89",
                fillColor: "#3470b7",
                fillOpacity: 0.42,
                weight: 2,
              }}
            >
              <Popup>{locationLabel}</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      <div className="location-picker-row">
        <div className="location-picker-values">
          <strong>{labels.selectedLabel}</strong>
          <span>{locationLabel || labels.noneSelected}</span>
        </div>
        <button
          type="button"
          className="location-picker-clear"
          onClick={onClear}
          disabled={!hasSelection}
        >
          {labels.clear}
        </button>
      </div>
    </div>
  );
}
