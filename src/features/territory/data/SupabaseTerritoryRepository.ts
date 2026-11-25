import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "../../access/domain/auth";
import type { Database } from "../../access/infrastructure/database.types";
import type { PollingStationSex } from "../../../shared/domain/pollingStation";
import type {
  ManagedPrecinct,
  ManagedStation,
  TerritoryManagement,
  TerritoryPerson,
  TerritoryRepository,
} from "../domain/territory";

type PersonRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email"
>;

export class SupabaseTerritoryRepository implements TerritoryRepository {
  constructor(private readonly client: SupabaseClient<Database> | null) {}

  async loadManagement(
    role: AppRole,
    userId: string,
    provinceId: string,
  ): Promise<TerritoryManagement> {
    if (!this.client) {
      throw new Error("Supabase no está configurado para administrar territorio.");
    }

    if (role === "provincial_coordinator") {
      return this.loadProvincialManagement();
    }
    if (role === "precinct_coordinator") {
      return this.loadPrecinctManagement(userId, provinceId);
    }
    throw new Error("Tu perfil no puede administrar asignaciones territoriales.");
  }

  async assignObserver(
    stationId: string,
    observerId: string | null,
  ): Promise<void> {
    const client = this.getClient();
    const { error } = await client.rpc("assign_observer_to_station", {
      p_polling_station_id: stationId,
      p_observer_id: observerId,
    });
    if (error) {
      throw this.toUserError(error.message);
    }
  }

  async createStation(input: {
    precinctId: string;
    stationNumber: number;
    sex: PollingStationSex;
  }): Promise<void> {
    const { error } = await this.getClient().rpc("create_polling_station", {
      p_precinct_id: input.precinctId,
      p_station_number: input.stationNumber,
      p_sex: input.sex,
    });
    if (error) {
      throw this.toUserError(error.message);
    }
  }

  async createPrecinct(input: {
    cantonId: string;
    parish: string;
    name: string;
  }): Promise<void> {
    const { error } = await this.getClient().from("precincts").insert({
      canton_id: input.cantonId,
      parish: input.parish.trim(),
      name: input.name.trim(),
    });
    if (error) {
      throw this.toUserError(error.message);
    }
  }

  private async loadProvincialManagement(): Promise<TerritoryManagement> {
    const client = this.getClient();
    const { data: cantonRows, error: cantonError } = await client
      .from("cantons")
      .select("id, name")
      .order("name");
    if (cantonError) {
      throw this.toUserError(cantonError.message);
    }

    const { data: precinctRows, error: precinctError } = await client
      .from("precincts")
      .select("id, name, parish, canton_id")
      .order("name");
    if (precinctError) {
      throw this.toUserError(precinctError.message);
    }
    if (precinctRows.length === 0) {
      return {
        cantons: cantonRows,
        precincts: [],
        stations: [],
        observers: [],
      };
    }

    const { data: assignments, error: assignmentError } = await client
      .from("precinct_coordinators")
      .select("precinct_id, user_id")
      .in(
        "precinct_id",
        precinctRows.map((row) => row.id),
      );
    if (assignmentError) {
      throw this.toUserError(assignmentError.message);
    }

    const assignedIds = [...new Set(assignments.map((row) => row.user_id))];
    const assignedPeople = await this.loadPeople(assignedIds);

    const cantonNames = new Map(
      cantonRows.map((canton) => [canton.id, canton.name]),
    );
    const coordinatorById = new Map(
      assignedPeople.map((person) => [person.id, person]),
    );
    const coordinatorByPrecinct = new Map(
      assignments.map((assignment) => [
        assignment.precinct_id,
        coordinatorById.get(assignment.user_id) ?? null,
      ]),
    );
    const precincts: ManagedPrecinct[] = precinctRows.map((row) => {
      const cantonName = cantonNames.get(row.canton_id);
      if (!cantonName) {
        throw new Error("No se pudo identificar el cantón de un recinto.");
      }
      return {
        id: row.id,
        name: row.name,
        parish: row.parish,
        cantonName,
        coordinator: coordinatorByPrecinct.get(row.id) ?? null,
      };
    });

    return {
      cantons: cantonRows,
      precincts,
      stations: [],
      observers: [],
    };
  }

  private async loadPrecinctManagement(
    userId: string,
    provinceId: string,
  ): Promise<TerritoryManagement> {
    const client = this.getClient();
    const { data: coordinatorAssignments, error: coordinatorError } =
      await client
        .from("precinct_coordinators")
        .select("precinct_id")
        .eq("user_id", userId);
    if (coordinatorError) {
      throw this.toUserError(coordinatorError.message);
    }

    const precinctIds = coordinatorAssignments.map((row) => row.precinct_id);
    if (precinctIds.length === 0) {
      return {
        cantons: [],
        precincts: [],
        stations: [],
        observers: [],
      };
    }

    const { data: precinctRows, error: precinctError } = await client
      .from("precincts")
      .select("id, name, parish, canton_id")
      .in("id", precinctIds)
      .order("name");
    if (precinctError) {
      throw this.toUserError(precinctError.message);
    }

    const { data: stations, error: stationError } = await client
      .from("polling_stations")
      .select("id, precinct_id, sex, station_number")
      .in("precinct_id", precinctIds)
      .order("station_number");
    if (stationError) {
      throw this.toUserError(stationError.message);
    }

    const stationIds = stations.map((station) => station.id);
    const assignments = stationIds.length
      ? await client
          .from("observer_assignments")
          .select("polling_station_id, observer_id")
          .in("polling_station_id", stationIds)
          .is("revoked_at", null)
      : { data: [], error: null };
    if (assignments.error) {
      throw this.toUserError(assignments.error.message);
    }

    const assignedIds = [
      ...new Set(assignments.data.map((assignment) => assignment.observer_id)),
    ];
    const [assignedPeople, observers, cantonResult] = await Promise.all([
      this.loadPeople(assignedIds),
      this.loadPeopleByRole("observer", provinceId),
      this.loadCantons(precinctRows.map((row) => row.canton_id)),
    ]);
    const personById = new Map(assignedPeople.map((person) => [person.id, person]));
    const observerByStation = new Map(
      assignments.data.map((assignment) => [
        assignment.polling_station_id,
        personById.get(assignment.observer_id) ?? null,
      ]),
    );
    const precinctById = new Map(
      precinctRows.map((precinct) => [precinct.id, precinct]),
    );
    const cantonNames = new Map(
      cantonResult.map((canton) => [canton.id, canton.name]),
    );
    const managedPrecincts: ManagedPrecinct[] = precinctRows.map((row) => {
      const cantonName = cantonNames.get(row.canton_id);
      if (!cantonName) {
        throw new Error("No se pudo identificar el cantón de tu recinto.");
      }
      return {
        id: row.id,
        name: row.name,
        parish: row.parish,
        cantonName,
        coordinator: null,
      };
    });
    const managedStations: ManagedStation[] = stations.map((station) => {
      const precinct = precinctById.get(station.precinct_id);
      if (!precinct) {
        throw new Error("Una mesa no pertenece a un recinto autorizado.");
      }
      return {
        id: station.id,
        stationNumber: station.station_number,
        sex: station.sex,
        precinctName: precinct.name,
        observer: observerByStation.get(station.id) ?? null,
      };
    });

    return {
      cantons: [],
      precincts: managedPrecincts,
      stations: managedStations,
      observers,
    };
  }

  private async loadPeople(ids: string[]): Promise<TerritoryPerson[]> {
    if (ids.length === 0) {
      return [];
    }
    const { data, error } = await this.getClient()
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (error) {
      throw this.toUserError(error.message);
    }
    return data.map((person) => this.toPerson(person));
  }

  private async loadPeopleByRole(
    role: "precinct_coordinator" | "observer",
    provinceId?: string,
  ): Promise<TerritoryPerson[]> {
    let query = this.getClient()
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", role)
      .order("full_name");
    if (provinceId) {
      query = query.eq("province_id", provinceId);
    }
    const { data, error } = await query;
    if (error) {
      throw this.toUserError(error.message);
    }
    return data.map((person) => this.toPerson(person));
  }

  private async loadCantons(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return [];
    }
    const { data, error } = await this.getClient()
      .from("cantons")
      .select("id, name")
      .in("id", uniqueIds);
    if (error) {
      throw this.toUserError(error.message);
    }
    return data;
  }

  private toPerson(person: PersonRow): TerritoryPerson {
    return {
      id: person.id,
      fullName: person.full_name,
      email: person.email,
    };
  }

  private getClient(): SupabaseClient<Database> {
    if (!this.client) {
      throw new Error("Supabase no está configurado para administrar territorio.");
    }
    return this.client;
  }

  private toUserError(message: string): Error {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("network") ||
      normalized.includes("fetch") ||
      normalized.includes("offline")
    ) {
      return new Error("No hay conexión para guardar la asignación. Intenta de nuevo.");
    }
    return new Error(message);
  }
}
