import type { ActaStatus, ElectoralOffice } from "../../actas/domain/acta";
import type { AppRole } from "../domain/auth";
import type { PollingStationSex } from "../../../shared/domain/pollingStation";

type Empty = { [_ in never]: never };
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown>,
  Update extends Record<string, unknown>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  role: AppRole;
  province_id: string;
  national_id: string;
  full_name: string;
  phone: string;
  email: string;
  created_by: string | null;
  must_change_password: boolean;
  created_at: string;
};

export type PrecinctRow = {
  id: string;
  canton_id: string;
  parish: string;
  name: string;
  created_at: string;
};

export type ProvinceRow = {
  id: string;
  name: string;
  created_at: string;
};

export type PrecinctCoordinatorRow = {
  precinct_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: string;
};

export type CantonRow = {
  id: string;
  province_id: string;
  name: string;
  created_at: string;
};

export type PollingStationRow = {
  id: string;
  precinct_id: string;
  sex: PollingStationSex | null;
  station_number: number;
  created_at: string;
};

export type ObserverAssignmentRow = {
  id: string;
  polling_station_id: string;
  observer_id: string;
  assigned_by: string;
  assigned_at: string;
  revoked_at: string | null;
};

export type CandidateRow = {
  id: string;
  organization_id: string;
  office: ElectoralOffice;
  full_name: string;
  created_at: string;
};

export type OrganizationRow = {
  id: string;
  name: string;
  list_number: number | null;
  created_at: string;
};

export type ActaRow = {
  id: string;
  polling_station_id: string;
  office: ElectoralOffice;
  author_id: string;
  updated_by: string | null;
  photo_path: string;
  latitude: number;
  longitude: number;
  captured_at_device: string;
  device_modified_at: string;
  server_received_at: string;
  status: ActaStatus;
  failure_stage: "ocr" | "submission" | null;
  total_voters: number | null;
  blank_votes: number | null;
  null_votes: number | null;
  created_at: string;
  updated_at: string;
};

export type ActaCandidateVoteRow = {
  acta_id: string;
  candidate_id: string;
  votes: number | null;
};

export type ActaAuditLogRow = {
  id: number;
  acta_id: string;
  actor_id: string | null;
  entity_name: "actas" | "acta_candidate_votes";
  operation: "INSERT" | "UPDATE" | "DELETE";
  device_modified_at: string | null;
  server_received_at: string;
  old_record: Json | null;
  new_record: Json | null;
};

export type PrecinctLocationReferenceRow = {
  precinct_id: string;
  source_acta_id: string;
  latitude: number;
  longitude: number;
  captured_at_device: string;
  registered_at_server: string;
};

export interface Database {
  public: {
    Tables: {
      provinces: Table<
        ProvinceRow,
        Omit<ProvinceRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        Partial<ProvinceRow>
      >;
      profiles: Table<
        ProfileRow,
        Omit<ProfileRow, "created_at"> & { created_at?: string },
        Partial<ProfileRow>
      >;
      precincts: Table<
        PrecinctRow,
        Omit<PrecinctRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        Partial<PrecinctRow>
      >;
      precinct_coordinators: Table<
        PrecinctCoordinatorRow,
        Omit<PrecinctCoordinatorRow, "assigned_at"> & { assigned_at?: string },
        Partial<PrecinctCoordinatorRow>
      >;
      cantons: Table<
        CantonRow,
        Omit<CantonRow, "created_at"> & { created_at?: string },
        Partial<CantonRow>
      >;
      polling_stations: Table<
        PollingStationRow,
        Omit<PollingStationRow, "created_at" | "sex"> & {
          created_at?: string;
          sex?: PollingStationSex | null;
        },
        Partial<PollingStationRow>
      >;
      observer_assignments: Table<
        ObserverAssignmentRow,
        Omit<ObserverAssignmentRow, "id" | "assigned_at" | "revoked_at"> & {
          id?: string;
          assigned_at?: string;
          revoked_at?: string | null;
        },
        Partial<ObserverAssignmentRow>
      >;
      political_organizations: Table<
        OrganizationRow,
        Omit<OrganizationRow, "id" | "created_at" | "list_number"> & {
          id?: string;
          created_at?: string;
          list_number?: number | null;
        },
        Partial<OrganizationRow>
      >;
      candidates: Table<
        CandidateRow,
        Omit<CandidateRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        Partial<CandidateRow>
      >;
      actas: Table<
        ActaRow,
        Omit<
          ActaRow,
          | "id"
          | "updated_by"
          | "server_received_at"
          | "created_at"
          | "updated_at"
        > & {
          id?: string;
          updated_by?: string | null;
          server_received_at?: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<ActaRow>
      >;
      acta_candidate_votes: Table<
        ActaCandidateVoteRow,
        ActaCandidateVoteRow,
        Partial<ActaCandidateVoteRow>
      >;
      acta_audit_log: Table<
        ActaAuditLogRow,
        Omit<ActaAuditLogRow, "id" | "server_received_at"> & {
          id?: number;
          server_received_at?: string;
        },
        Partial<ActaAuditLogRow>
      >;
      precinct_location_references: Table<
        PrecinctLocationReferenceRow,
        Omit<PrecinctLocationReferenceRow, "registered_at_server"> & {
          registered_at_server?: string;
        },
        Partial<PrecinctLocationReferenceRow>
      >;
    };
    Views: Empty;
    Functions: {
      register_precinct_location_reference: {
        Args: { p_acta_id: string };
        Returns: undefined;
      };
      save_acta_revision: {
        Args: {
          p_acta_id: string;
          p_polling_station_id: string;
          p_office: ElectoralOffice;
          p_photo_path: string;
          p_latitude: number;
          p_longitude: number;
          p_captured_at_device: string;
          p_device_modified_at: string;
          p_status: ActaStatus;
          p_failure_stage: string | null;
          p_total_voters: number | null;
          p_blank_votes: number | null;
          p_null_votes: number | null;
          p_candidate_votes: Json;
        };
        Returns: undefined;
      };
      submit_acta: {
        Args: { p_acta_id: string; p_device_modified_at: string };
        Returns: undefined;
      };
      assign_precinct_coordinator: {
        Args: { p_precinct_id: string; p_coordinator_id: string };
        Returns: undefined;
      };
      assign_observer_to_station: {
        Args: { p_polling_station_id: string; p_observer_id: string | null };
        Returns: undefined;
      };
      create_polling_station: {
        Args: {
          p_precinct_id: string;
          p_station_number: number;
          p_sex: PollingStationSex;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      electoral_office: ElectoralOffice;
      acta_status: ActaStatus;
      polling_station_sex: PollingStationSex;
    };
    CompositeTypes: Empty;
  };
}
