import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Json,
} from "../../access/infrastructure/database.types";
import {
  getLocationWarning,
  getNextDeviceTimestamp,
  validateActaTally,
} from "../domain/actaRules";
import type {
  ActaDraft,
  ActaAuditEntry,
  ActaRepository,
  ActaStatus,
  ActaSummary,
  AssignedStation,
  AuditChange,
  Candidate,
  CandidateVote,
  ElectoralOffice,
  Location,
  QueueResult,
} from "../domain/acta";
import { assessAndStoreCameraPhoto } from "../infrastructure/photoEvidence";
import { SQLiteActaStore } from "../infrastructure/SQLiteActaStore";

interface CachedReferenceRow {
  precinct_id: string;
  source_acta_id: string;
  latitude: number;
  longitude: number;
  captured_at_device: string;
}

interface ParsedOCRResponse {
  totalVoters: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
  candidateVotes: CandidateVote[];
}

type Listener = (actaId: string, status: ActaStatus) => void;

function isOnline(
  state: Awaited<ReturnType<typeof NetInfo.fetch>>,
): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function isNetworkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("timed out") ||
    normalized.includes("connection")
  );
}

function toUserError(message: string): Error {
  if (isNetworkError(message)) {
    return new Error("No hay conexión. El acta se conserva en este dispositivo.");
  }
  if (message.includes("Device modification time must be newer")) {
    return new Error(
      "Otra revisión tiene una marca de dispositivo igual o más reciente. No se aplicó ningún desempate automático; revisa el acta con el coordinador.",
    );
  }
  if (
    message.includes("Two actas have the same device capture time") ||
    message.includes("GPS reference needs review")
  ) {
    return new Error(
      "Dos actas tienen la misma hora de captura en el dispositivo, por lo que no se pudo elegir la referencia GPS. Según el supuesto S-02 se requiere revisión humana, sin desempate automático. Comunica el caso al coordinador para que revise ambas actas.",
    );
  }
  return new Error(message);
}

function parseCount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function parseOCRResponse(
  value: unknown,
  draft: ActaDraft,
): ParsedOCRResponse {
  if (typeof value !== "object" || value === null || !("candidateVotes" in value)) {
    throw new Error("El OCR devolvió una respuesta incompleta.");
  }
  const response = value as {
    totalVoters?: unknown;
    blankVotes?: unknown;
    nullVotes?: unknown;
    candidateVotes?: unknown;
  };
  const votesByCandidate = new Map<string, number | null>();
  if (Array.isArray(response.candidateVotes)) {
    for (const entry of response.candidateVotes) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "candidateId" in entry &&
        typeof entry.candidateId === "string" &&
        draft.candidateVotes.some(
          (candidate) => candidate.candidateId === entry.candidateId,
        ) &&
        !votesByCandidate.has(entry.candidateId) &&
        "votes" in entry
      ) {
        votesByCandidate.set(entry.candidateId, parseCount(entry.votes));
      }
    }
  }

  return {
    totalVoters: parseCount(response.totalVoters),
    blankVotes: parseCount(response.blankVotes),
    nullVotes: parseCount(response.nullVotes),
    candidateVotes: draft.candidateVotes.map((candidate) => ({
      ...candidate,
      votes: votesByCandidate.get(candidate.candidateId) ?? null,
    })),
  };
}

function asJsonRecord(
  value: Json | null,
): Record<string, Json | undefined> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

function auditValue(value: Json | undefined): string {
  if (value === undefined || value === null) {
    return "Sin dato";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildAuditChanges(
  entityName: "actas" | "acta_candidate_votes",
  oldValue: Json | null,
  newValue: Json | null,
  candidateNames: Map<string, string>,
): AuditChange[] {
  const previous = asJsonRecord(oldValue);
  const next = asJsonRecord(newValue);
  if (entityName === "acta_candidate_votes") {
    const candidateId = String(
      next?.candidate_id ?? previous?.candidate_id ?? "",
    );
    const before = previous?.votes;
    const after = next?.votes;
    return JSON.stringify(before) === JSON.stringify(after)
      ? []
      : [
          {
            label: `Votos · ${candidateNames.get(candidateId) ?? "Candidatura"}`,
            previousValue: auditValue(before),
            newValue: auditValue(after),
          },
        ];
  }

  if (!previous || !next) {
    return [{ label: "Acta", previousValue: "Sin dato", newValue: "Registro actualizado" }];
  }

  const fields: [string, string][] = [
    ["total_voters", "Sufragantes"],
    ["blank_votes", "Votos en blanco"],
    ["null_votes", "Votos nulos"],
    ["status", "Estado"],
    ["failure_stage", "Etapa de error"],
    ["photo_path", "Fotografía"],
    ["latitude", "Latitud"],
    ["longitude", "Longitud"],
  ];
  return fields.flatMap(([field, label]) => {
    if (JSON.stringify(previous[field]) === JSON.stringify(next[field])) {
      return [];
    }
    if (field === "photo_path") {
      return [
        {
          label,
          previousValue: previous[field] ? "Evidencia anterior" : "Sin evidencia",
          newValue: next[field] ? "Evidencia actualizada" : "Sin evidencia",
        },
      ];
    }
    return [
      {
        label,
        previousValue: auditValue(previous[field]),
        newValue: auditValue(next[field]),
      },
    ];
  });
}

export class SupabaseActaRepository implements ActaRepository {
  private readonly store = new SQLiteActaStore();
  private readonly listeners = new Set<Listener>();
  private readonly processingActaIds = new Set<string>();
  private readonly processingSubmissionIds = new Set<string>();
  private processingQueue = false;
  private processingSubmissionQueue = false;

  constructor(private readonly client: SupabaseClient<Database> | null) {}

  async loadActaStations(
    userId: string,
    role: "observer" | "precinct_coordinator",
  ): Promise<AssignedStation[]> {
    const network = await NetInfo.fetch();
    if (!isOnline(network)) {
      return this.store.getAssignedStations(userId);
    }

    try {
      const client = this.getClient();
      let stationIds: string[] = [];
      let assignedPrecinctIds: string[] = [];
      if (role === "observer") {
        const { data, error } = await client
          .from("observer_assignments")
          .select("polling_station_id")
          .eq("observer_id", userId)
          .is("revoked_at", null);
        if (error) {
          throw error;
        }
        stationIds = data.map((row) => row.polling_station_id);
      } else {
        const { data, error } = await client
          .from("precinct_coordinators")
          .select("precinct_id")
          .eq("user_id", userId);
        if (error) {
          throw error;
        }
        assignedPrecinctIds = data.map((row) => row.precinct_id);
      }
      if (
        (role === "observer" && stationIds.length === 0) ||
        (role === "precinct_coordinator" && assignedPrecinctIds.length === 0)
      ) {
        await this.cacheReferenceData(userId, []);
        return [];
      }

      let stationsQuery = client
        .from("polling_stations")
        .select("id, station_number, precinct_id");
      stationsQuery =
        role === "observer"
          ? stationsQuery.in("id", stationIds)
          : stationsQuery.in("precinct_id", assignedPrecinctIds);
      const { data: stationRows, error: stationError } = await stationsQuery
        .order("station_number");
      if (stationError) {
        throw stationError;
      }

      const precinctIds = [...new Set(stationRows.map((row) => row.precinct_id))];
      const { data: precinctRows, error: precinctError } = await client
        .from("precincts")
        .select("id, name")
        .in("id", precinctIds);
      if (precinctError) {
        throw precinctError;
      }
      const precinctNames = new Map(
        precinctRows.map((precinct) => [precinct.id, precinct.name]),
      );
      const stations: AssignedStation[] = stationRows.map((station) => {
        const precinctName = precinctNames.get(station.precinct_id);
        if (!precinctName) {
          throw new Error("No se pudo encontrar el recinto de una mesa asignada.");
        }
        return {
          id: station.id,
          stationNumber: station.station_number,
          precinctId: station.precinct_id,
          precinctName,
        };
      });

      await this.cacheReferenceData(userId, stations);
      return stations;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudieron cargar las mesas.";
      if (isNetworkError(message)) {
        const cachedStations = await this.store.getAssignedStations(userId);
        if (cachedStations.length) {
          return cachedStations;
        }
      }
      throw toUserError(message);
    }
  }

  async listSummaries(
    userId: string,
    stations: AssignedStation[],
  ): Promise<ActaSummary[]> {
    const localDrafts = await this.store.listDrafts(userId);
    const localById = new Map(localDrafts.map((draft) => [draft.id, draft]));
    const stationById = new Map(stations.map((station) => [station.id, station]));
    const cachedRemoteSummaries =
      await this.store.getCachedRemoteActaSummaries(
        userId,
        stations.map((station) => station.id),
      );
    let remoteSummaries = cachedRemoteSummaries.map((serverSummary) => {
      const localDraft = localById.get(serverSummary.id);
      return {
        ...serverSummary,
        status:
          localDraft?.correctionMode
            ? localDraft.status
            : serverSummary.status === "sent" || !localDraft
            ? serverSummary.status
            : localDraft.status,
        failureStage: localDraft?.failureStage ?? serverSummary.failureStage,
        localDraft: Boolean(localDraft),
        correctionMode: localDraft?.correctionMode ?? false,
      };
    });

    if (stations.length && isOnline(await NetInfo.fetch())) {
      try {
        const { data, error } = await this.getClient()
          .from("actas")
          .select(
            "id, polling_station_id, office, status, failure_stage, updated_at",
          )
          .in(
            "polling_station_id",
            stations.map((station) => station.id),
          )
          .order("updated_at", { ascending: false });
        if (error) {
          throw error;
        }
        const receivedSummaries: ActaSummary[] = [];
        const currentSummaries: ActaSummary[] = [];
        for (const acta of data) {
          const station = stationById.get(acta.polling_station_id);
          if (!station) {
            continue;
          }
          const serverSummary: ActaSummary = {
            id: acta.id,
            pollingStationId: acta.polling_station_id,
            stationNumber: station.stationNumber,
            precinctName: station.precinctName,
            office: acta.office,
            status: acta.status,
            failureStage: acta.failure_stage,
            updatedAt: acta.updated_at,
            localDraft: false,
            correctionMode: false,
          };
          receivedSummaries.push(serverSummary);
          const localDraft = localById.get(acta.id);
          currentSummaries.push({
            ...serverSummary,
            status:
              localDraft?.correctionMode
                ? localDraft.status
                : acta.status === "sent" || !localDraft
                ? acta.status
                : localDraft.status,
            failureStage: localDraft?.failureStage ?? acta.failure_stage,
            localDraft: Boolean(localDraft),
            correctionMode: localDraft?.correctionMode ?? false,
          });
        }
        await this.store.cacheRemoteActaSummaries(userId, receivedSummaries);
        remoteSummaries = currentSummaries;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo cargar el historial.";
        if (!isNetworkError(message)) {
          throw toUserError(message);
        }
      }
    }

    const remoteIds = new Set(remoteSummaries.map((summary) => summary.id));
    const localSummaries: ActaSummary[] = localDrafts
      .filter((draft) => !remoteIds.has(draft.id))
      .map((draft) => ({
        id: draft.id,
        pollingStationId: draft.pollingStationId,
        stationNumber: draft.stationNumber,
        precinctName: draft.precinctName,
        office: draft.office,
        status: draft.status,
        failureStage: draft.failureStage,
        updatedAt: draft.updatedAt,
        localDraft: true,
        correctionMode: draft.correctionMode,
      }));

    return [...remoteSummaries, ...localSummaries].sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt),
    );
  }

  async loadCandidates(office: ElectoralOffice): Promise<Candidate[]> {
    const network = await NetInfo.fetch();
    if (isOnline(network)) {
      try {
        await this.refreshCandidateCatalog();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudieron cargar candidaturas.";
        if (!isNetworkError(message)) {
          throw toUserError(message);
        }
      }
    }
    return this.store.getCandidates(office);
  }

  async createDraft(
    userId: string,
    stationId: string,
    office: ElectoralOffice,
  ): Promise<ActaDraft> {
    const station = (await this.store.getAssignedStations(userId)).find(
      (item) => item.id === stationId,
    );
    if (!station) {
      throw new Error("La mesa no está en tus asignaciones almacenadas.");
    }
    const existing = await this.store.findDraftForStation(
      userId,
      stationId,
      office,
    );
    if (existing) {
      return existing;
    }
    if (await this.store.findCachedRemoteActa(userId, stationId, office)) {
      throw new Error(
        "Ya existe un acta en el servidor para esta mesa y dignidad. No se creará un duplicado.",
      );
    }
    const candidates = await this.store.getCandidates(office);
    if (candidates.length !== 5) {
      throw new Error(
        "No hay exactamente cinco candidaturas cargadas para esta dignidad. No se pueden inventar datos.",
      );
    }
    const now = new Date().toISOString();
    const draft: ActaDraft = {
      id: Crypto.randomUUID(),
      ownerId: userId,
      pollingStationId: station.id,
      stationNumber: station.stationNumber,
      precinctId: station.precinctId,
      precinctName: station.precinctName,
      office,
      photoUri: null,
      latitude: null,
      longitude: null,
      capturedAtDevice: null,
      deviceModifiedAt: now,
      totalVoters: null,
      blankVotes: null,
      nullVotes: null,
      candidateVotes: candidates.map((candidate) => ({
        candidateId: candidate.id,
        candidateName: candidate.name,
        organizationName: candidate.organizationName,
        votes: null,
      })),
      status: "draft",
      failureStage: null,
      correctionMode: false,
      submissionAuthorized: false,
      locationWarningMeters: null,
      updatedAt: now,
    };
    const stored = await this.store.createDraft(draft);
    this.notify(stored);
    return stored;
  }

  getDraft(id: string, userId: string): Promise<ActaDraft | null> {
    return this.store.getDraft(id, userId);
  }

  async beginCorrection(userId: string, id: string): Promise<ActaDraft> {
    const client = this.getClient();
    const { data: acta, error: actaError } = await client
      .from("actas")
      .select(
        "id, polling_station_id, office, photo_path, latitude, longitude, captured_at_device, device_modified_at, status, total_voters, blank_votes, null_votes",
      )
      .eq("id", id)
      .maybeSingle();
    if (actaError) {
      throw toUserError(actaError.message);
    }
    if (!acta) {
      throw new Error("No se encontró un acta accesible para corregir.");
    }
    if (acta.status !== "sent") {
      throw new Error("Solo se inicia una corrección sobre un acta enviada.");
    }

    const { data: station, error: stationError } = await client
      .from("polling_stations")
      .select("id, station_number, precinct_id")
      .eq("id", acta.polling_station_id)
      .single();
    if (stationError) {
      throw toUserError(stationError.message);
    }
    const { data: precinct, error: precinctError } = await client
      .from("precincts")
      .select("id, name")
      .eq("id", station.precinct_id)
      .single();
    if (precinctError) {
      throw toUserError(precinctError.message);
    }

    const existing = await this.store.findDraftForStation(
      userId,
      acta.polling_station_id,
      acta.office,
    );
    if (existing && existing.id !== acta.id) {
      throw new Error(
        "Hay otro borrador local para esta mesa y dignidad. Resuélvelo antes de iniciar la corrección.",
      );
    }
    if (existing?.correctionMode && existing.status !== "sent") {
      return existing;
    }

    const { data: voteRows, error: votesError } = await client
      .from("acta_candidate_votes")
      .select("candidate_id, votes")
      .eq("acta_id", acta.id);
    if (votesError) {
      throw toUserError(votesError.message);
    }
    if (voteRows.length !== 5) {
      throw new Error("El acta no contiene exactamente cinco candidaturas.");
    }
    const candidateIds = voteRows.map((vote) => vote.candidate_id);
    const { data: candidates, error: candidatesError } = await client
      .from("candidates")
      .select("id, full_name, organization_id")
      .in("id", candidateIds);
    if (candidatesError) {
      throw toUserError(candidatesError.message);
    }
    if (candidates.length !== 5) {
      throw new Error("No se pudieron cargar las candidaturas del acta.");
    }
    const organizationIds = [...new Set(
      candidates.map((candidate) => candidate.organization_id),
    )];
    const { data: organizations, error: organizationsError } = await client
      .from("political_organizations")
      .select("id, name")
      .in("id", organizationIds);
    if (organizationsError) {
      throw toUserError(organizationsError.message);
    }
    const organizationNames = new Map(
      organizations.map((organization) => [organization.id, organization.name]),
    );
    const votesByCandidate = new Map(
      voteRows.map((vote) => [vote.candidate_id, vote.votes]),
    );
    const candidateVotes = candidates.map((candidate) => {
      const organizationName = organizationNames.get(candidate.organization_id);
      if (!organizationName) {
        throw new Error("No se pudo identificar la organización de una candidatura.");
      }
      return {
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        organizationName,
        votes: votesByCandidate.get(candidate.id) ?? null,
      };
    });

    const { data: photoBlob, error: photoError } = await client.storage
      .from("acta-photos")
      .download(acta.photo_path);
    if (photoError) {
      throw toUserError(photoError.message);
    }
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) {
      throw new Error("No está disponible el almacenamiento local para la foto.");
    }
    const photoDirectory = `${documentDirectory}acta-evidence/${id}/`;
    const directoryInfo = await FileSystem.getInfoAsync(photoDirectory);
    if (!directoryInfo.exists) {
      await FileSystem.makeDirectoryAsync(photoDirectory, {
        intermediates: true,
      });
    }
    const photoUri = `${photoDirectory}correction-${Crypto.randomUUID()}.jpg`;
    const photoBase64 = this.encodeBase64(
      new Uint8Array(await photoBlob.arrayBuffer()),
    );
    await FileSystem.writeAsStringAsync(photoUri, photoBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const now = new Date().toISOString();
    const correctionTimestamp = getNextDeviceTimestamp(acta.device_modified_at);
    const draft: ActaDraft = {
      id: acta.id,
      ownerId: userId,
      pollingStationId: station.id,
      stationNumber: station.station_number,
      precinctId: precinct.id,
      precinctName: precinct.name,
      office: acta.office,
      photoUri,
      latitude: acta.latitude,
      longitude: acta.longitude,
      capturedAtDevice: acta.captured_at_device,
      deviceModifiedAt: correctionTimestamp,
      totalVoters: acta.total_voters,
      blankVotes: acta.blank_votes,
      nullVotes: acta.null_votes,
      candidateVotes,
      status: "ready",
      failureStage: null,
      correctionMode: true,
      submissionAuthorized: false,
      locationWarningMeters: null,
      updatedAt: now,
    };
    try {
      await this.saveRemoteRevision(
        client,
        draft,
        acta.photo_path,
        "pending",
        correctionTimestamp,
      );
      if (existing) {
        await this.store.saveDraft(draft);
      } else {
        await this.store.createDraft(draft);
      }
    } catch (error) {
      await FileSystem.deleteAsync(photoUri, { idempotent: true });
      throw error;
    }
    this.notify(draft);
    return draft;
  }

  async loadAuditHistory(actaId: string): Promise<ActaAuditEntry[]> {
    const client = this.getClient();
    const { data: auditRows, error: auditError } = await client
      .from("acta_audit_log")
      .select(
        "id, acta_id, actor_id, entity_name, operation, device_modified_at, server_received_at, old_record, new_record",
      )
      .eq("acta_id", actaId)
      .order("server_received_at", { ascending: false });
    if (auditError) {
      throw toUserError(auditError.message);
    }
    if (auditRows.length === 0) {
      return [];
    }

    const actorIds = [...new Set(
      auditRows.flatMap((row) => row.actor_id ? [row.actor_id] : []),
    )];
    const actorNames = new Map<string, string>();
    if (actorIds.length) {
      const { data: profiles, error: profilesError } = await client
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      if (profilesError) {
        throw toUserError(profilesError.message);
      }
      for (const profile of profiles) {
        actorNames.set(profile.id, profile.full_name);
      }
    }

    const candidateIds = new Set<string>();
    for (const row of auditRows) {
      if (row.entity_name !== "acta_candidate_votes") {
        continue;
      }
      for (const record of [row.old_record, row.new_record]) {
        const candidateId = asJsonRecord(record)?.candidate_id;
        if (typeof candidateId === "string") {
          candidateIds.add(candidateId);
        }
      }
    }
    const candidateNames = new Map<string, string>();
    if (candidateIds.size) {
      const { data: candidates, error: candidatesError } = await client
        .from("candidates")
        .select("id, full_name")
        .in("id", [...candidateIds]);
      if (candidatesError) {
        throw toUserError(candidatesError.message);
      }
      for (const candidate of candidates) {
        candidateNames.set(candidate.id, candidate.full_name);
      }
    }

    return auditRows.map((row) => ({
      id: row.id,
      actorName: row.actor_id
        ? actorNames.get(row.actor_id) ?? `Usuario ${row.actor_id}`
        : "Usuario eliminado",
      operation: row.operation,
      entityName: row.entity_name,
      deviceModifiedAt: row.device_modified_at,
      serverReceivedAt: row.server_received_at,
      changes: buildAuditChanges(
        row.entity_name,
        row.old_record,
        row.new_record,
        candidateNames,
      ),
    }));
  }

  async saveDraft(draft: ActaDraft): Promise<void> {
    const stored = await this.store.getDraft(draft.id, draft.ownerId);
    const resultChanged =
      stored !== null &&
      (stored.totalVoters !== draft.totalVoters ||
        stored.blankVotes !== draft.blankVotes ||
        stored.nullVotes !== draft.nullVotes ||
        stored.photoUri !== draft.photoUri ||
        stored.latitude !== draft.latitude ||
        stored.longitude !== draft.longitude ||
        stored.capturedAtDevice !== draft.capturedAtDevice ||
        JSON.stringify(
          stored.candidateVotes.map(({ candidateId, votes }) => ({
            candidateId,
            votes,
          })),
        ) !==
          JSON.stringify(
            draft.candidateVotes.map(({ candidateId, votes }) => ({
              candidateId,
              votes,
            })),
          ));
    const updated = {
      ...draft,
      ...(draft.submissionAuthorized && resultChanged
        ? {
            status: "ready" as const,
            failureStage: null,
            submissionAuthorized: false,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveDraft(updated);
    this.notify(updated);
  }

  async acceptCameraPhoto(
    draft: ActaDraft,
    sourceUri: string,
    location: Location,
    capturedAt: string,
  ) {
    const assessment = await assessAndStoreCameraPhoto(
      sourceUri,
      draft.id,
      draft.photoUri,
    );
    if (!assessment.accepted || !assessment.photoUri) {
      return {
        draft: null,
        sharpnessScore: assessment.sharpnessScore,
        threshold: assessment.configuredThreshold,
        warningMeters: null,
        cleanupWarning: null,
      };
    }

    const existingReference = await this.store.getLocationReference(
      draft.precinctId,
    );
    const reference = existingReference
      ? {
          latitude: existingReference.latitude,
          longitude: existingReference.longitude,
        }
      : await this.store.rememberFirstLocalLocation(
          draft.precinctId,
          draft.id,
          location,
          capturedAt,
        );
    const warningMeters = getLocationWarning(location, reference);
    const updated: ActaDraft = {
      ...draft,
      photoUri: assessment.photoUri,
      latitude: location.latitude,
      longitude: location.longitude,
      capturedAtDevice: capturedAt,
      deviceModifiedAt: getNextDeviceTimestamp(draft.deviceModifiedAt),
      status: "pending",
      failureStage: null,
      submissionAuthorized: false,
      locationWarningMeters: warningMeters,
      updatedAt: new Date().toISOString(),
    };
    try {
      await this.store.saveDraft(updated);
    } catch (error) {
      await FileSystem.deleteAsync(assessment.photoUri, { idempotent: true });
      throw error;
    }
    this.notify(updated);

    return {
      draft: updated,
      sharpnessScore: assessment.sharpnessScore,
      threshold: assessment.configuredThreshold,
      warningMeters,
      cleanupWarning: assessment.cleanupWarning,
    };
  }

  async enterResultsManually(draft: ActaDraft): Promise<ActaDraft> {
    if (this.processingActaIds.has(draft.id)) {
      throw new Error(
        "El OCR está procesando esta fotografía. Espera el resultado antes de continuar manualmente.",
      );
    }
    if (!draft.photoUri) {
      throw new Error("Toma y acepta una fotografía antes de ingresar resultados.");
    }
    const updated = {
      ...draft,
      status: "ready" as const,
      failureStage: null,
      submissionAuthorized: false,
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveDraft(updated);
    this.notify(updated);
    return updated;
  }

  async retryOCR(draft: ActaDraft): Promise<void> {
    if (this.processingActaIds.has(draft.id)) {
      throw new Error("El OCR ya está procesando esta fotografía.");
    }
    if (!draft.photoUri) {
      throw new Error("El acta no tiene una fotografía local para procesar.");
    }
    const updated = {
      ...draft,
      status: "pending" as const,
      failureStage: null,
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveDraft(updated);
    this.notify(updated);
    await this.processPendingOCR(draft.ownerId);
  }

  async processPendingOCR(userId: string): Promise<QueueResult[]> {
    if (this.processingQueue) {
      return [];
    }
    this.processingQueue = true;
    const outcomes: QueueResult[] = [];
    try {
      const allDrafts = await this.store.listDrafts(userId);
      if (!isOnline(await NetInfo.fetch())) {
        for (const draft of allDrafts) {
          if (draft.status !== "processing_ocr") {
            continue;
          }
          const pending: ActaDraft = {
            ...draft,
            status: "pending",
            updatedAt: new Date().toISOString(),
          };
          await this.store.saveDraft(pending);
          this.notify(pending);
        }
        return [];
      }
      const drafts = allDrafts.filter(
        (draft) =>
          draft.photoUri &&
          (draft.status === "pending" ||
            draft.status === "processing_ocr" ||
            (draft.status === "failed" && draft.failureStage === "ocr")),
      );
      for (const draft of drafts) {
        if (this.processingActaIds.has(draft.id)) {
          continue;
        }
        this.processingActaIds.add(draft.id);
        try {
          const currentDraft = await this.store.getDraft(draft.id, userId);
          if (
            !currentDraft ||
            (currentDraft.status !== "pending" &&
              currentDraft.status !== "processing_ocr" &&
              !(currentDraft.status === "failed" &&
                currentDraft.failureStage === "ocr"))
          ) {
            continue;
          }
          const processing: ActaDraft = {
            ...currentDraft,
            status: "processing_ocr",
            failureStage: null,
            updatedAt: new Date().toISOString(),
          };
          await this.store.saveDraft(processing);
          this.notify(processing);
          let proposal: ParsedOCRResponse;
          try {
            proposal = await this.requestOCR(processing);
          } catch (ocrError) {
            const failed: ActaDraft = {
              ...processing,
              status: "failed",
              failureStage: "ocr",
              submissionAuthorized: false,
              deviceModifiedAt: getNextDeviceTimestamp(
                processing.deviceModifiedAt,
              ),
              updatedAt: new Date().toISOString(),
            };
            await this.store.saveDraft(failed);
            this.notify(failed);
            outcomes.push({
              actaId: draft.id,
              succeeded: false,
              message:
                ocrError instanceof Error
                  ? toUserError(ocrError.message).message
                  : "No se pudo procesar la fotografía con OCR.",
            });
            continue;
          }
          const updated: ActaDraft = {
            ...processing,
            totalVoters: proposal.totalVoters,
            blankVotes: proposal.blankVotes,
            nullVotes: proposal.nullVotes,
            candidateVotes: proposal.candidateVotes,
            status: "ready",
            failureStage: null,
            submissionAuthorized: false,
            deviceModifiedAt: getNextDeviceTimestamp(
              processing.deviceModifiedAt,
            ),
            updatedAt: new Date().toISOString(),
          };
          await this.store.saveDraft(updated);
          this.notify(updated);
          outcomes.push({ actaId: draft.id, succeeded: true });
        } finally {
          this.processingActaIds.delete(draft.id);
        }
      }
      return outcomes;
    } finally {
      this.processingQueue = false;
    }
  }

  async submitReviewedActa(draft: ActaDraft): Promise<ActaDraft> {
    if (
      draft.status !== "ready" &&
      !(
        draft.status === "failed" &&
        draft.failureStage === "submission" &&
        draft.submissionAuthorized
      )
    ) {
      throw new Error(
        "El acta debe estar en revisión antes de autorizar su envío.",
      );
    }
    const errors = validateActaTally(draft);
    if (errors.length) {
      throw new Error(errors.join("\n"));
    }
    if (
      !draft.photoUri ||
      draft.latitude === null ||
      draft.longitude === null ||
      !draft.capturedAtDevice
    ) {
      throw new Error("El acta necesita fotografía y ubicación antes del envío.");
    }
    const authorized: ActaDraft = {
      ...draft,
      status: "sending",
      failureStage: null,
      submissionAuthorized: true,
      deviceModifiedAt: getNextDeviceTimestamp(draft.deviceModifiedAt),
      updatedAt: new Date().toISOString(),
    };
    await this.store.saveDraft(authorized);
    this.notify(authorized);
    if (!isOnline(await NetInfo.fetch())) {
      return authorized;
    }
    return this.syncAuthorizedActa(authorized);
  }

  async processPendingSubmissions(userId: string): Promise<QueueResult[]> {
    if (this.processingSubmissionQueue || !isOnline(await NetInfo.fetch())) {
      return [];
    }
    this.processingSubmissionQueue = true;
    const outcomes: QueueResult[] = [];
    try {
      const drafts = (await this.store.listDrafts(userId)).filter(
        (item) =>
          item.submissionAuthorized &&
          (item.status === "sending" ||
            (item.status === "failed" &&
              item.failureStage === "submission")),
      );
      for (const item of drafts) {
        if (this.processingSubmissionIds.has(item.id)) {
          continue;
        }
        try {
          await this.syncAuthorizedActa(item);
          outcomes.push({ actaId: item.id, succeeded: true });
        } catch (submissionError) {
          outcomes.push({
            actaId: item.id,
            succeeded: false,
            message:
              submissionError instanceof Error
                ? submissionError.message
                : "No se pudo sincronizar el acta.",
          });
        }
      }
      return outcomes;
    } finally {
      this.processingSubmissionQueue = false;
    }
  }

  private async syncAuthorizedActa(draft: ActaDraft): Promise<ActaDraft> {
    if (!draft.submissionAuthorized) {
      throw new Error("El envío no fue autorizado por el usuario.");
    }
    if (this.processingSubmissionIds.has(draft.id)) {
      return draft;
    }
    this.processingSubmissionIds.add(draft.id);
    try {
      if (!isOnline(await NetInfo.fetch())) {
        throw new Error(
          "No hay conexión para sincronizar. El envío autorizado permanece en la cola local.",
        );
      }

      const client = this.getClient();
      const { data: remoteActa, error: remoteActaError } = await client
        .from("actas")
        .select("status, device_modified_at")
        .eq("id", draft.id)
        .maybeSingle();
      if (remoteActaError) {
        throw toUserError(remoteActaError.message);
      }
      if (remoteActa?.status === "sent") {
        const remoteModifiedAt = Date.parse(remoteActa.device_modified_at);
        const localModifiedAt = Date.parse(draft.deviceModifiedAt);
        if (remoteModifiedAt > localModifiedAt) {
          const conflict: ActaDraft = {
            ...draft,
            status: "failed",
            failureStage: "submission",
            submissionAuthorized: false,
            updatedAt: new Date().toISOString(),
          };
          await this.store.saveDraft(conflict);
          this.notify(conflict);
          throw toUserError(
            "Device modification time must be newer than the stored version",
          );
        }
        if (remoteModifiedAt === localModifiedAt) {
          const sent: ActaDraft = {
            ...draft,
            status: "sent",
            failureStage: null,
            submissionAuthorized: false,
            updatedAt: new Date().toISOString(),
          };
          await this.store.saveDraft(sent);
          this.notify(sent);
          return sent;
        }
      }
      const photoPath = `${draft.id}/evidence.jpg`;
      let sending: ActaDraft = {
        ...draft,
        status: "sending",
        failureStage: null,
        deviceModifiedAt: getNextDeviceTimestamp(draft.deviceModifiedAt),
        updatedAt: new Date().toISOString(),
      };
      await this.store.saveDraft(sending);
      this.notify(sending);

      try {
        await this.saveRemoteRevision(
          client,
          sending,
          photoPath,
          "pending",
          sending.deviceModifiedAt,
        );

        const base64 = await FileSystem.readAsStringAsync(sending.photoUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const photoBytes = this.decodeBase64(base64);
        const { error: uploadError } = await client.storage
          .from("acta-photos")
          .upload(photoPath, photoBytes, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (uploadError) {
          throw toUserError(uploadError.message);
        }

        sending = {
          ...sending,
          deviceModifiedAt: getNextDeviceTimestamp(sending.deviceModifiedAt),
          updatedAt: new Date().toISOString(),
        };
        await this.store.saveDraft(sending);
        await this.saveRemoteRevision(
          client,
          sending,
          photoPath,
          "sending",
          sending.deviceModifiedAt,
        );

        const { error: referenceError } = await client.rpc(
          "register_precinct_location_reference",
          { p_acta_id: draft.id },
        );
        if (referenceError) {
          throw toUserError(referenceError.message);
        }
        const warningMeters = await this.refreshLocationWarning(sending);
        sending = {
          ...sending,
          deviceModifiedAt: getNextDeviceTimestamp(sending.deviceModifiedAt),
          updatedAt: new Date().toISOString(),
        };
        await this.store.saveDraft(sending);
        const { error: submitError } = await client.rpc("submit_acta", {
          p_acta_id: draft.id,
          p_device_modified_at: sending.deviceModifiedAt,
        });
        if (submitError) {
          throw toUserError(submitError.message);
        }

        const sent: ActaDraft = {
          ...sending,
          status: "sent",
          failureStage: null,
          submissionAuthorized: false,
          locationWarningMeters: warningMeters,
          updatedAt: new Date().toISOString(),
        };
        await this.store.saveDraft(sent);
        this.notify(sent);
        return sent;
      } catch (error) {
        const failed: ActaDraft = {
          ...sending,
          status: "failed",
          failureStage: "submission",
          submissionAuthorized: true,
          updatedAt: new Date().toISOString(),
        };
        await this.store.saveDraft(failed);
        this.notify(failed);
        throw error instanceof Error
          ? error
          : new Error("No se pudo enviar el acta; se conserva localmente.");
      }
    } finally {
      this.processingSubmissionIds.delete(draft.id);
    }
  }

  private async saveRemoteRevision(
    client: SupabaseClient<Database>,
    draft: ActaDraft,
    photoPath: string,
    status: "pending" | "sending",
    deviceModifiedAt: string,
  ): Promise<void> {
    const { error } = await client.rpc("save_acta_revision", {
      p_acta_id: draft.id,
      p_polling_station_id: draft.pollingStationId,
      p_office: draft.office,
      p_photo_path: photoPath,
      p_latitude: draft.latitude!,
      p_longitude: draft.longitude!,
      p_captured_at_device: draft.capturedAtDevice!,
      p_device_modified_at: deviceModifiedAt,
      p_status: status,
      p_failure_stage: null,
      p_total_voters: draft.totalVoters,
      p_blank_votes: draft.blankVotes,
      p_null_votes: draft.nullVotes,
      p_candidate_votes: draft.candidateVotes.map((vote) => ({
        candidate_id: vote.candidateId,
        votes: vote.votes,
      })),
    });
    if (error) {
      throw toUserError(error.message);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async cacheReferenceData(
    userId: string,
    stations: AssignedStation[],
  ): Promise<void> {
    const client = this.getClient();
    const offices: ElectoralOffice[] = ["mayor", "prefect"];
    const candidatesByOffice = await Promise.all(
      offices.map(async (office) => {
        const { data, error } = await client
          .from("candidates")
          .select("id, full_name, organization_id, office")
          .eq("office", office);
        if (error) {
          throw error;
        }
        const organizationIds = [...new Set(data.map((row) => row.organization_id))];
        const organizations = organizationIds.length
          ? await client
              .from("political_organizations")
              .select("id, name")
              .in("id", organizationIds)
          : { data: [], error: null };
        if (organizations.error) {
          throw organizations.error;
        }
        const organizationNames = new Map(
          organizations.data.map((organization) => [
            organization.id,
            organization.name,
          ]),
        );
        return data.map((candidate) => {
          const organizationName = organizationNames.get(
            candidate.organization_id,
          );
          if (!organizationName) {
            throw new Error("No se pudo identificar la organización de una candidatura.");
          }
          return {
            id: candidate.id,
            office,
            name: candidate.full_name,
            organizationName,
          };
        });
      }),
    );
    const precinctIds = [...new Set(stations.map((station) => station.precinctId))];
    let locations: CachedReferenceRow[] = [];
    if (precinctIds.length) {
      const { data, error } = await client
        .from("precinct_location_references")
        .select(
          "precinct_id, source_acta_id, latitude, longitude, captured_at_device",
        )
        .in("precinct_id", precinctIds);
      if (error) {
        throw error;
      }
      locations = data;
    }
    await this.store.cacheReferenceData(
      userId,
      stations,
      candidatesByOffice.flat(),
      locations,
    );
  }

  private async refreshCandidateCatalog(): Promise<void> {
    const client = this.getClient();
    const candidates: (Candidate & { office: ElectoralOffice })[] = [];
    for (const office of ["mayor", "prefect"] as const) {
      const { data, error } = await client
        .from("candidates")
        .select("id, full_name, organization_id, office")
        .eq("office", office);
      if (error) {
        throw error;
      }
      const organizationIds = [...new Set(data.map((row) => row.organization_id))];
      const organizations = organizationIds.length
        ? await client
            .from("political_organizations")
            .select("id, name")
            .in("id", organizationIds)
        : { data: [], error: null };
      if (organizations.error) {
        throw organizations.error;
      }
      const organizationNames = new Map(
        organizations.data.map((organization) => [
          organization.id,
          organization.name,
        ]),
      );
      for (const candidate of data) {
        const organizationName = organizationNames.get(
          candidate.organization_id,
        );
        if (!organizationName) {
          throw new Error("No se pudo identificar la organización de una candidatura.");
        }
        candidates.push({
          id: candidate.id,
          office,
          name: candidate.full_name,
          organizationName,
        });
      }
    }
    const userId = await this.getCurrentUserId();
    const stations = await this.store.getAssignedStations(userId);
    await this.store.cacheReferenceData(userId, stations, candidates, []);
  }

  private async getCurrentUserId(): Promise<string> {
    const { data, error } = await this.getClient().auth.getUser();
    if (error || !data.user) {
      throw new Error("La sesión expiró. Inicia sesión de nuevo.");
    }
    return data.user.id;
  }

  private async requestOCR(draft: ActaDraft): Promise<ParsedOCRResponse> {
    if (!draft.photoUri) {
      throw new Error("El acta no tiene una fotografía.");
    }
    const imageBase64 = await FileSystem.readAsStringAsync(draft.photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const { data, error } = await this.getClient().functions.invoke<unknown>(
      "process-acta-ocr",
      {
        body: {
          imageBase64,
          pollingStationId: draft.pollingStationId,
          office: draft.office,
        },
      },
    );
    if (error) {
      throw toUserError(error.message);
    }
    return parseOCRResponse(data, draft);
  }

  private async refreshLocationWarning(
    draft: ActaDraft,
  ): Promise<number | null> {
    const { data, error } = await this.getClient()
      .from("precinct_location_references")
      .select(
        "precinct_id, source_acta_id, latitude, longitude, captured_at_device",
      )
      .eq("precinct_id", draft.precinctId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data || draft.latitude === null || draft.longitude === null) {
      return null;
    }
    await this.store.cacheLocationReference(data);
    return getLocationWarning(
      { latitude: draft.latitude, longitude: draft.longitude },
      { latitude: data.latitude, longitude: data.longitude },
    );
  }

  private decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  private encodeBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  private getClient(): SupabaseClient<Database> {
    if (!this.client) {
      throw new Error("Supabase no está configurado para procesar actas.");
    }
    return this.client;
  }

  private notify(draft: ActaDraft): void {
    for (const listener of this.listeners) {
      listener(draft.id, draft.status);
    }
  }
}
