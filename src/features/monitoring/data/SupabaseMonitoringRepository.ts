import NetInfo from "@react-native-community/netinfo";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../access/infrastructure/database.types";
import { getLocationWarning } from "../../actas/domain/actaRules";
import type { CrashReporter } from "../../../shared/domain/observability";
import { buildProvincialDashboard } from "../domain/dashboard";
import type {
  ActaMapPoint,
  MonitoringRepository,
  ProvincialActaDetail,
} from "../domain/monitoringRepository";

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

const SEX_LABEL = { female: "Femenina", male: "Masculina" } as const;

function unwrap<T>(result: QueryResult<T>, message: string): T {
  if (result.error) {
    throw new Error(result.error.message || message);
  }
  if (result.data === null) {
    throw new Error(message);
  }
  return result.data;
}

function isConnectionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /conexión|conexion|internet|network|fetch failed/i.test(error.message)
  );
}

function toUserError(error: unknown): Error {
  if (isConnectionError(error)) {
    return new Error(
      "Se necesita conexión para consultar el tablero. Reintenta al recuperar la red.",
    );
  }
  return error instanceof Error
    ? error
    : new Error("No se pudo cargar la información del tablero.");
}

function numberOrNull(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabaseMonitoringRepository implements MonitoringRepository {
  constructor(
    private readonly client: SupabaseClient<Database> | null,
    private readonly reporter: CrashReporter,
  ) {}

  async loadDashboard() {
    try {
      const client = this.getClient();
      if (!(await NetInfo.fetch()).isConnected) {
        throw new Error("Sin conexión a Internet.");
      }
      const [cantons, precincts, stations, actas, votes, candidates, organizations] =
        await Promise.all([
          client.from("cantons").select("id, name"),
          client.from("precincts").select("id, name, canton_id"),
          client.from("polling_stations").select("id, precinct_id, station_number, sex"),
          client
            .from("actas")
            .select("id, polling_station_id, office, updated_at")
            .eq("status", "sent"),
          client.from("acta_candidate_votes").select("acta_id, candidate_id, votes"),
          client.from("candidates").select("id, full_name, organization_id, office"),
          client.from("political_organizations").select("id, name"),
        ]);

      const cantonRows = unwrap(cantons, "No se pudieron cargar los cantones.");
      const precinctRows = unwrap(precincts, "No se pudieron cargar los recintos.");
      const stationRows = unwrap(stations, "No se pudieron cargar las mesas.");
      const actaRows = unwrap(actas, "No se pudieron cargar las actas enviadas.");
      const voteRows = unwrap(votes, "No se pudieron cargar los votos.");
      const candidateRows = unwrap(candidates, "No se pudieron cargar las candidaturas.");
      const organizationRows = unwrap(organizations, "No se pudieron cargar las organizaciones.");

      const cantonNames = new Map(cantonRows.map((row) => [row.id, row.name]));
      const organizationNames = new Map(organizationRows.map((row) => [row.id, row.name]));
      const votesByActa = new Map<string, { candidateId: string; votes: number | null }[]>();
      for (const row of voteRows) {
        const list = votesByActa.get(row.acta_id) ?? [];
        list.push({ candidateId: row.candidate_id, votes: row.votes });
        votesByActa.set(row.acta_id, list);
      }

      return buildProvincialDashboard({
        precincts: precinctRows.map((row) => ({
          id: row.id,
          name: row.name,
          cantonId: row.canton_id,
          cantonName: cantonNames.get(row.canton_id) ?? "Cantón",
        })),
        stations: stationRows.map((row) => ({
          id: row.id,
          precinctId: row.precinct_id,
          stationNumber: row.station_number,
          sex: row.sex,
        })),
        candidates: candidateRows.map((row) => ({
          id: row.id,
          office: row.office,
          name: row.full_name,
          organizationName: organizationNames.get(row.organization_id) ?? "Organización",
        })),
        sentActas: actaRows.map((row) => ({
          id: row.id,
          pollingStationId: row.polling_station_id,
          office: row.office,
          candidateVotes: votesByActa.get(row.id) ?? [],
          updatedAt: row.updated_at,
        })),
      });
    } catch (error) {
      if (!isConnectionError(error)) {
        this.reporter.recordNonFatal(error, {
          screen: "ProvincialDashboard",
          operation: "load_dashboard",
        });
      }
      throw toUserError(error);
    }
  }

  async loadActaDetail(actaId: string): Promise<ProvincialActaDetail | null> {
    try {
      const client = this.getClient();
      const actaResult = await client
        .from("actas")
        .select(
          "id, polling_station_id, office, total_voters, blank_votes, null_votes, photo_path, latitude, longitude, captured_at_device, updated_at",
        )
        .eq("id", actaId)
        .maybeSingle();
      if (actaResult.error) {
        throw new Error(actaResult.error.message);
      }
      const acta = actaResult.data;
      if (!acta) {
        return null;
      }

      const [stationResult, votesResult, candidatesResult, organizationsResult] =
        await Promise.all([
          client
            .from("polling_stations")
            .select("id, precinct_id, station_number, sex")
            .eq("id", acta.polling_station_id)
            .maybeSingle(),
          client.from("acta_candidate_votes").select("candidate_id, votes").eq("acta_id", actaId),
          client.from("candidates").select("id, full_name, organization_id, office"),
          client.from("political_organizations").select("id, name"),
        ]);
      if (stationResult.error) {
        throw new Error(stationResult.error.message);
      }
      const station = stationResult.data;
      if (!station) {
        return null;
      }
      const voteRows = unwrap(votesResult, "No se pudieron cargar los votos del acta.");
      const candidateRows = unwrap(candidatesResult, "No se pudieron cargar las candidaturas.");
      const organizationRows = unwrap(organizationsResult, "No se pudieron cargar las organizaciones.");

      const precinctResult = await client
        .from("precincts")
        .select("id, name, canton_id")
        .eq("id", station.precinct_id)
        .maybeSingle();
      if (precinctResult.error) {
        throw new Error(precinctResult.error.message);
      }
      const precinct = precinctResult.data;
      if (!precinct) {
        return null;
      }
      const cantonResult = await client
        .from("cantons")
        .select("name")
        .eq("id", precinct.canton_id)
        .maybeSingle();
      if (cantonResult.error) {
        throw new Error(cantonResult.error.message);
      }
      const canton = cantonResult.data;
      const referenceResult = await client
        .from("precinct_location_references")
        .select("latitude, longitude")
        .eq("precinct_id", precinct.id)
        .maybeSingle();
      if (referenceResult.error) {
        throw new Error(referenceResult.error.message);
      }
      const reference = referenceResult.data;

      const organizationNames = new Map(organizationRows.map((row) => [row.id, row.name]));
      const candidateInfo = new Map(
        candidateRows.map((row) => [
          row.id,
          {
            name: row.full_name,
            organizationName: organizationNames.get(row.organization_id) ?? "Organización",
          },
        ]),
      );
      const latitude = numberOrNull(acta.latitude);
      const longitude = numberOrNull(acta.longitude);
      const warningMeters =
        latitude !== null && longitude !== null && reference
          ? getLocationWarning(
              { latitude, longitude },
              { latitude: reference.latitude, longitude: reference.longitude },
            )
          : null;

      return {
        id: acta.id,
        precinctName: precinct.name,
        cantonName: canton?.name ?? "Cantón",
        stationNumber: station.station_number,
        stationSex: station.sex,
        office: acta.office,
        totalVoters: acta.total_voters ?? 0,
        blankVotes: acta.blank_votes ?? 0,
        nullVotes: acta.null_votes ?? 0,
        candidateVotes: voteRows.map((row) => ({
          candidateId: row.candidate_id,
          candidateName: candidateInfo.get(row.candidate_id)?.name ?? "Candidatura",
          organizationName:
            candidateInfo.get(row.candidate_id)?.organizationName ?? "Organización",
          votes: row.votes,
        })),
        photoUri: await this.getPhotoUri(client, acta.photo_path),
        latitude,
        longitude,
        capturedAtDevice: acta.captured_at_device,
        warningMeters,
        updatedAt: acta.updated_at,
        mapPoints: await this.loadMapPoints(client, precinct.id, acta.id),
      };
    } catch (error) {
      if (!isConnectionError(error)) {
        this.reporter.recordNonFatal(error, {
          screen: "ProvincialActaDetail",
          operation: "load_acta_detail",
        });
      }
      throw toUserError(error);
    }
  }

  subscribe(onChange: () => void): () => void {
    const client = this.client;
    if (!client) {
      return () => undefined;
    }
    const channel = client
      .channel("provincial-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "actas" }, onChange)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "acta_candidate_votes" },
        onChange,
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }

  private async loadMapPoints(
    client: SupabaseClient<Database>,
    precinctId: string,
    selectedId: string,
  ): Promise<ActaMapPoint[]> {
    const stationRows = unwrap(
      await client
        .from("polling_stations")
        .select("id, station_number, sex")
        .eq("precinct_id", precinctId),
      "No se pudieron cargar las mesas del recinto.",
    );
    if (!stationRows.length) {
      return [];
    }
    const actaRows = unwrap(
      await client
        .from("actas")
        .select("id, polling_station_id, latitude, longitude")
        .eq("status", "sent")
        .in(
          "polling_station_id",
          stationRows.map((row) => row.id),
        ),
      "No se pudieron cargar las ubicaciones del recinto.",
    );
    const labels = new Map(
      stationRows.map((row) => [
        row.id,
        `Mesa ${row.station_number}${row.sex ? ` · ${SEX_LABEL[row.sex]}` : ""}`,
      ]),
    );
    return actaRows
      .filter(
        (row): row is typeof row & { latitude: number; longitude: number } =>
          row.latitude !== null && row.longitude !== null,
      )
      .map((row) => ({
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        label: labels.get(row.polling_station_id) ?? "Mesa",
        selected: row.id === selectedId,
        warning: false,
      }));
  }

  private async getPhotoUri(
    client: SupabaseClient<Database>,
    photoPath: string,
  ): Promise<string | null> {
    try {
      const { data, error } = await client.storage
        .from("acta-photos")
        .createSignedUrl(photoPath, 60);
      if (error) {
        throw new Error(error.message);
      }
      return data?.signedUrl ?? null;
    } catch (error) {
      // La URL firmada nunca se registra: RNF-03 prohíbe enviar rutas al reporte.
      this.reporter.recordNonFatal(error, {
        screen: "ProvincialActaDetail",
        operation: "load_photo",
      });
      return null;
    }
  }

  private getClient(): SupabaseClient<Database> {
    if (!this.client) {
      throw new Error("Configura Supabase para consultar el tablero.");
    }
    return this.client;
  }
}
