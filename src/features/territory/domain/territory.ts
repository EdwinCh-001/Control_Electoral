import type { AppRole } from "../../access/domain/auth";

export interface TerritoryPerson {
  id: string;
  fullName: string;
  email: string;
}

export interface ManagedCanton {
  id: string;
  name: string;
}

export interface ManagedPrecinct {
  id: string;
  name: string;
  parish: string;
  cantonName: string;
  coordinator: TerritoryPerson | null;
}

export interface ManagedStation {
  id: string;
  stationNumber: number;
  precinctName: string;
  observer: TerritoryPerson | null;
}

export interface TerritoryManagement {
  cantons: ManagedCanton[];
  precincts: ManagedPrecinct[];
  stations: ManagedStation[];
  observers: TerritoryPerson[];
}

export interface TerritoryRepository {
  loadManagement(
    role: AppRole,
    userId: string,
    provinceId: string,
  ): Promise<TerritoryManagement>;
  assignObserver(stationId: string, observerId: string | null): Promise<void>;
  createPrecinct(input: {
    cantonId: string;
    parish: string;
    name: string;
  }): Promise<void>;
}
