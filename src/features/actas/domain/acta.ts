import type { PollingStationSex } from "../../../shared/domain/pollingStation";

export type ElectoralOffice = "mayor" | "prefect";

export type ActaStatus =
  | "draft"
  | "pending"
  | "processing_ocr"
  | "ready"
  | "sending"
  | "sent"
  | "failed";

export type FailureStage = "ocr" | "submission";

export interface AssignedStation {
  id: string;
  stationNumber: number;
  sex: PollingStationSex | null;
  precinctId: string;
  precinctName: string;
}

export interface CandidateVote {
  candidateId: string;
  candidateName: string;
  organizationName: string;
  votes: number | null;
}

export interface Candidate {
  id: string;
  name: string;
  organizationName: string;
}

export interface ActaDraft {
  id: string;
  ownerId: string;
  pollingStationId: string;
  stationNumber: number;
  stationSex: PollingStationSex | null;
  precinctId: string;
  precinctName: string;
  office: ElectoralOffice;
  photoUri: string | null;
  latitude: number | null;
  longitude: number | null;
  capturedAtDevice: string | null;
  deviceModifiedAt: string;
  totalVoters: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
  candidateVotes: CandidateVote[];
  status: ActaStatus;
  failureStage: FailureStage | null;
  correctionMode: boolean;
  submissionAuthorized: boolean;
  locationWarningMeters: number | null;
  updatedAt: string;
}

export interface ActaSummary {
  id: string;
  pollingStationId: string;
  stationNumber: number;
  stationSex: PollingStationSex | null;
  precinctName: string;
  office: ElectoralOffice;
  status: ActaStatus;
  failureStage: FailureStage | null;
  updatedAt: string;
  localDraft: boolean;
  correctionMode: boolean;
}

export interface ProvincialActaLocation {
  id: string;
  precinctName: string;
  stationNumber: number;
  stationSex: PollingStationSex | null;
  office: ElectoralOffice;
  latitude: number;
  longitude: number;
  capturedAtDevice: string;
  warningMeters: number | null;
}

export interface QueueResult {
  actaId: string;
  succeeded: boolean;
  message?: string;
}

export interface AuditChange {
  label: string;
  previousValue: string;
  newValue: string;
}

export interface ActaAuditEntry {
  id: number;
  actorName: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  entityName: "actas" | "acta_candidate_votes";
  deviceModifiedAt: string | null;
  serverReceivedAt: string;
  changes: AuditChange[];
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface OCRProposal {
  totalVoters: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
  candidateVotes: {
    candidateId: string;
    votes: number | null;
  }[];
}

export interface ActaRepository {
  getCachedStations(userId: string): Promise<AssignedStation[]>;
  getLocationReference(precinctId: string): Promise<Location | null>;
  loadActaStations(
    userId: string,
    role: "observer" | "precinct_coordinator",
  ): Promise<AssignedStation[]>;
  listSummaries(
    userId: string,
    stations: AssignedStation[],
  ): Promise<ActaSummary[]>;
  loadCandidates(office: ElectoralOffice): Promise<Candidate[]>;
  createDraft(
    userId: string,
    stationId: string,
    office: ElectoralOffice,
  ): Promise<ActaDraft>;
  getDraft(id: string, userId: string): Promise<ActaDraft | null>;
  beginCorrection(userId: string, id: string): Promise<ActaDraft>;
  loadAuditHistory(actaId: string): Promise<ActaAuditEntry[]>;
  loadProvincialActaLocations(): Promise<ProvincialActaLocation[]>;
  saveDraft(draft: ActaDraft): Promise<void>;
  acceptCameraPhoto(
    draft: ActaDraft,
    sourceUri: string,
    location: Location,
    capturedAt: string,
  ): Promise<{
    draft: ActaDraft | null;
    sharpnessScore: number;
    threshold: number | null;
    warningMeters: number | null;
    cleanupWarning: string | null;
  }>;
  enterResultsManually(draft: ActaDraft): Promise<ActaDraft>;
  retryOCR(draft: ActaDraft): Promise<void>;
  processPendingOCR(userId: string): Promise<QueueResult[]>;
  processPendingSubmissions(userId: string): Promise<QueueResult[]>;
  submitReviewedActa(draft: ActaDraft): Promise<ActaDraft>;
  subscribe(
    listener: (actaId: string, status: ActaStatus) => void,
  ): () => void;
}
