import type {
  ElectoralOffice,
} from "../../actas/domain/acta";
import type { PollingStationSex } from "../../../shared/domain/pollingStation";
import type { ProvincialDashboard } from "./dashboard";

export interface ActaMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  selected: boolean;
  warning: boolean;
}

export interface ProvincialActaDetail {
  id: string;
  precinctName: string;
  cantonName: string;
  stationNumber: number;
  stationSex: PollingStationSex | null;
  office: ElectoralOffice;
  totalVoters: number;
  blankVotes: number;
  nullVotes: number;
  candidateVotes: {
    candidateId: string;
    candidateName: string;
    organizationName: string;
    votes: number | null;
  }[];
  photoUri: string | null;
  latitude: number | null;
  longitude: number | null;
  capturedAtDevice: string | null;
  warningMeters: number | null;
  updatedAt: string;
  mapPoints: ActaMapPoint[];
}

export interface MonitoringRepository {
  loadDashboard(): Promise<ProvincialDashboard>;
  loadActaDetail(actaId: string): Promise<ProvincialActaDetail | null>;
  subscribe(onChange: () => void): () => void;
}
