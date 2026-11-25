import { GeoMap } from "../../../shared/presentation/components/GeoMap";
import type { ActaMapPoint } from "../domain/monitoringRepository";

interface Props {
  points: ActaMapPoint[];
}

/** Mapa geográfico de las actas del recinto, con respaldo relativo (ADR-05). */
export function ProvincialActaMap({ points }: Props) {
  return (
    <GeoMap
      accessibilityLabel="Mapa de las actas del recinto"
      height={220}
      markers={points.map((point) => ({
        title: point.label,
        details: point.selected ? "Acta seleccionada" : undefined,
        latitude: point.latitude,
        longitude: point.longitude,
        selected: point.selected,
        warning: point.warning,
      }))}
      showLegend
    />
  );
}
