import type { ElectoralOffice } from "../../actas/domain/acta";
import type { PollingStationSex } from "../../../shared/domain/pollingStation";

export interface SourceStation {
  id: string;
  precinctId: string;
  stationNumber: number;
  sex: PollingStationSex | null;
}

export interface SourcePrecinct {
  id: string;
  name: string;
  cantonId: string;
  cantonName: string;
}

export interface SourceCandidate {
  id: string;
  office: ElectoralOffice;
  name: string;
  organizationName: string;
}

export interface SourceVote {
  candidateId: string;
  votes: number | null;
}

export interface SourceActa {
  id: string;
  pollingStationId: string;
  office: ElectoralOffice;
  candidateVotes: SourceVote[];
  updatedAt: string;
}

export interface DashboardInput {
  precincts: SourcePrecinct[];
  stations: SourceStation[];
  candidates: SourceCandidate[];
  sentActas: SourceActa[];
}

export interface PrecinctProgress {
  precinctId: string;
  precinctName: string;
  cantonName: string;
  totalStations: number;
  reportedStations: number;
  missingStations: number;
  actas: {
    id: string;
    stationNumber: number;
    sex: PollingStationSex | null;
    office: ElectoralOffice;
  }[];
}

export interface CandidateScopeTotal {
  candidateId: string;
  candidateName: string;
  organizationName: string;
  votes: number;
}

export interface OfficeScopeTotals {
  office: ElectoralOffice;
  scope: "canton" | "precinct";
  precinctId: string | null;
  precinctName: string | null;
  candidates: CandidateScopeTotal[];
}

export interface ProvincialDashboard {
  totalStations: number;
  reportedStations: number;
  missingStations: number;
  precincts: PrecinctProgress[];
  totals: OfficeScopeTotals[];
  lastUpdatedAt: string | null;
}

const offices: ElectoralOffice[] = ["mayor", "prefect"];

function countReportedStations(
  stations: SourceStation[],
  sentActas: SourceActa[],
): Map<string, Set<ElectoralOffice>> {
  const byStation = new Map<string, Set<ElectoralOffice>>();
  for (const acta of sentActas) {
    const received = byStation.get(acta.pollingStationId) ?? new Set();
    received.add(acta.office);
    byStation.set(acta.pollingStationId, received);
  }
  // Una mesa se cuenta como reportada cuando llegaron sus dos actas (RF-07).
  return new Map(
    [...byStation].filter(([, received]) =>
      offices.every((office) => received.has(office)),
    ),
  );
}

function sumVotes(
  actas: SourceActa[],
  candidateId: string,
): number {
  return actas.reduce((total, acta) => {
    const vote = acta.candidateVotes.find(
      (item) => item.candidateId === candidateId,
    );
    return total + (vote?.votes ?? 0);
  }, 0);
}

function buildScopeTotals(
  scope: "canton" | "precinct",
  precinct: SourcePrecinct | null,
  candidates: SourceCandidate[],
  actas: SourceActa[],
): OfficeScopeTotals[] {
  return offices.map((office) => ({
    office,
    scope,
    precinctId: precinct?.id ?? null,
    precinctName: precinct?.name ?? null,
    candidates: candidates
      .filter((candidate) => candidate.office === office)
      .map((candidate) => ({
        candidateId: candidate.id,
        candidateName: candidate.name,
        organizationName: candidate.organizationName,
        votes: sumVotes(actas, candidate.id),
      })),
  }));
}

/**
 * Agregación pura del tablero. Solo consume actas enviadas; ningún cálculo
 * depende de servicios externos ni de datos del dispositivo.
 */
export function buildProvincialDashboard(input: DashboardInput): ProvincialDashboard {
  const stationById = new Map(input.stations.map((station) => [station.id, station]));
  const reported = countReportedStations(input.stations, input.sentActas);

  const precincts: PrecinctProgress[] = input.precincts
    .map((precinct) => {
      const stations = input.stations.filter(
        (station) => station.precinctId === precinct.id,
      );
      const stationIds = new Set(stations.map((station) => station.id));
      const reportedStations = stations.filter((station) =>
        reported.has(station.id),
      ).length;
      const actas = input.sentActas
        .filter((acta) => stationIds.has(acta.pollingStationId))
        .map((acta) => {
          const station = stationById.get(acta.pollingStationId);
          return {
            id: acta.id,
            stationNumber: station?.stationNumber ?? 0,
            sex: station?.sex ?? null,
            office: acta.office,
          };
        });
      return {
        precinctId: precinct.id,
        precinctName: precinct.name,
        cantonName: precinct.cantonName,
        totalStations: stations.length,
        reportedStations,
        missingStations: stations.length - reportedStations,
        actas,
      };
    })
    .sort(
      (first, second) =>
        first.cantonName.localeCompare(second.cantonName, "es") ||
        first.precinctName.localeCompare(second.precinctName, "es"),
    );

  const cantonTotals = buildScopeTotals(
    "canton",
    null,
    input.candidates,
    input.sentActas,
  );
  const precinctTotals = input.precincts.flatMap((precinct) => {
    const stationIds = new Set(
      input.stations
        .filter((station) => station.precinctId === precinct.id)
        .map((station) => station.id),
    );
    const actas = input.sentActas.filter((acta) =>
      stationIds.has(acta.pollingStationId),
    );
    return buildScopeTotals("precinct", precinct, input.candidates, actas);
  });

  const lastUpdatedAt = input.sentActas.reduce<string | null>(
    (latest, acta) => (!latest || acta.updatedAt > latest ? acta.updatedAt : latest),
    null,
  );

  return {
    totalStations: input.stations.length,
    reportedStations: reported.size,
    missingStations: input.stations.length - reported.size,
    precincts,
    totals: [...cantonTotals, ...precinctTotals],
    lastUpdatedAt,
  };
}

export function getPrecinctStationCount(
  precinctId: string,
  stations: SourceStation[],
): number {
  return stations.filter((station) => station.precinctId === precinctId).length;
}

export function getPrecinctName(
  precinctId: string,
  precincts: SourcePrecinct[],
): string {
  return precinctById(precincts).get(precinctId)?.name ?? "Recinto";
}

function precinctById(precincts: SourcePrecinct[]): Map<string, SourcePrecinct> {
  return new Map(precincts.map((precinct) => [precinct.id, precinct]));
}

export function getStation(
  stationId: string,
  stations: SourceStation[],
): SourceStation | undefined {
  return new Map(stations.map((station) => [station.id, station])).get(stationId);
}
