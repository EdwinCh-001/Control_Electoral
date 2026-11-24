import type { AppRole } from "../domain/auth";

type Empty = { [_ in never]: never };

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

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Omit<ProfileRow, "created_at"> & { created_at?: string },
        Partial<ProfileRow>
      >;
      precincts: Table<
        PrecinctRow,
        Omit<PrecinctRow, "created_at"> & { created_at?: string },
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
    };
    Views: Empty;
    Functions: Empty;
    Enums: {
      app_role: AppRole;
      electoral_office: "mayor" | "prefect";
      acta_status:
        | "draft"
        | "pending"
        | "processing_ocr"
        | "ready"
        | "sending"
        | "sent"
        | "failed";
    };
    CompositeTypes: Empty;
  };
}
