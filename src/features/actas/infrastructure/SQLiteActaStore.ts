import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import type {
  ActaDraft,
  ActaStatus,
  ActaSummary,
  AssignedStation,
  Candidate,
  CandidateVote,
  ElectoralOffice,
  FailureStage,
  Location,
} from "../domain/acta";

interface DraftRow {
  id: string;
  observer_id: string;
  polling_station_id: string;
  station_number: number;
  station_sex: AssignedStation["sex"];
  precinct_id: string;
  precinct_name: string;
  office: ElectoralOffice;
  photo_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  captured_at_device: string | null;
  device_modified_at: string;
  total_voters: number | null;
  blank_votes: number | null;
  null_votes: number | null;
  status: ActaStatus;
  failure_stage: FailureStage | null;
  correction_mode: number;
  submission_authorized: number;
  location_warning_meters: number | null;
  updated_at: string;
}

interface VoteRow {
  acta_id: string;
  candidate_id: string;
  candidate_name: string;
  organization_name: string;
  votes: number | null;
}

interface StationRow extends AssignedStation {
  user_id: string;
}

interface LocationRow extends Location {
  precinct_id: string;
  source_acta_id: string;
  captured_at_device: string;
}

interface CachedActaSummaryRow {
  user_id: string;
  id: string;
  polling_station_id: string;
  station_number: number;
  station_sex: AssignedStation["sex"];
  precinct_name: string;
  office: ElectoralOffice;
  status: ActaStatus;
  failure_stage: FailureStage | null;
  updated_at: string;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("electoral-actas.db").then(
      async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS assigned_stations_cache (
            user_id TEXT NOT NULL,
            id TEXT NOT NULL,
            station_number INTEGER NOT NULL,
            station_sex TEXT,
            precinct_id TEXT NOT NULL,
            precinct_name TEXT NOT NULL,
            PRIMARY KEY (user_id, id)
          );
          CREATE TABLE IF NOT EXISTS candidate_catalog (
            id TEXT PRIMARY KEY NOT NULL,
            office TEXT NOT NULL CHECK (office IN ('mayor', 'prefect')),
            name TEXT NOT NULL,
            organization_name TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS remote_acta_summaries (
            user_id TEXT NOT NULL,
            id TEXT NOT NULL,
            polling_station_id TEXT NOT NULL,
            station_number INTEGER NOT NULL,
            station_sex TEXT,
            precinct_name TEXT NOT NULL,
            office TEXT NOT NULL CHECK (office IN ('mayor', 'prefect')),
            status TEXT NOT NULL,
            failure_stage TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, id),
            UNIQUE (user_id, polling_station_id, office)
          );
          CREATE TABLE IF NOT EXISTS location_reference_cache (
            precinct_id TEXT PRIMARY KEY NOT NULL,
            source_acta_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            captured_at_device TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS acta_drafts (
            id TEXT PRIMARY KEY NOT NULL,
            observer_id TEXT NOT NULL,
            polling_station_id TEXT NOT NULL,
            station_number INTEGER NOT NULL,
            station_sex TEXT,
            precinct_id TEXT NOT NULL,
            precinct_name TEXT NOT NULL,
            office TEXT NOT NULL CHECK (office IN ('mayor', 'prefect')),
            photo_uri TEXT,
            latitude REAL,
            longitude REAL,
            captured_at_device TEXT,
            device_modified_at TEXT NOT NULL,
            total_voters INTEGER,
            blank_votes INTEGER,
            null_votes INTEGER,
            status TEXT NOT NULL,
            failure_stage TEXT,
            correction_mode INTEGER NOT NULL DEFAULT 0,
            submission_authorized INTEGER NOT NULL DEFAULT 0,
            location_warning_meters REAL,
            updated_at TEXT NOT NULL,
            UNIQUE (observer_id, polling_station_id, office)
          );
          CREATE TABLE IF NOT EXISTS acta_draft_votes (
            acta_id TEXT NOT NULL REFERENCES acta_drafts(id) ON DELETE CASCADE,
            candidate_id TEXT NOT NULL,
            candidate_name TEXT NOT NULL,
            organization_name TEXT NOT NULL,
            votes INTEGER,
            PRIMARY KEY (acta_id, candidate_id)
          );
          CREATE INDEX IF NOT EXISTS acta_drafts_owner_status_idx
            ON acta_drafts (observer_id, status, updated_at DESC);
        `);
        const draftColumns = await database.getAllAsync<{ name: string }>(
          "PRAGMA table_info(acta_drafts)",
        );
        const stationColumns = await database.getAllAsync<{ name: string }>(
          "PRAGMA table_info(assigned_stations_cache)",
        );
        const summaryColumns = await database.getAllAsync<{ name: string }>(
          "PRAGMA table_info(remote_acta_summaries)",
        );
        if (!stationColumns.some((column) => column.name === "station_sex")) {
          await database.execAsync(
            "ALTER TABLE assigned_stations_cache ADD COLUMN station_sex TEXT",
          );
        }
        if (!summaryColumns.some((column) => column.name === "station_sex")) {
          await database.execAsync(
            "ALTER TABLE remote_acta_summaries ADD COLUMN station_sex TEXT",
          );
        }
        if (!draftColumns.some((column) => column.name === "station_sex")) {
          await database.execAsync(
            "ALTER TABLE acta_drafts ADD COLUMN station_sex TEXT",
          );
        }
        if (!draftColumns.some((column) => column.name === "correction_mode")) {
          await database.execAsync(
            "ALTER TABLE acta_drafts ADD COLUMN correction_mode INTEGER NOT NULL DEFAULT 0",
          );
        }
        if (
          !draftColumns.some((column) => column.name === "submission_authorized")
        ) {
          await database.execAsync(
            "ALTER TABLE acta_drafts ADD COLUMN submission_authorized INTEGER NOT NULL DEFAULT 0",
          );
        }
        return database;
      },
    );
  }
  return databasePromise;
}

async function withActaTransaction(
  database: SQLite.SQLiteDatabase,
  task: (transaction: SQLite.SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (Platform.OS === "web") {
    await database.withTransactionAsync(() => task(database));
    return;
  }
  await database.withExclusiveTransactionAsync(task);
}

export class SQLiteActaStore {
  async cacheReferenceData(
    userId: string,
    stations: AssignedStation[],
    candidates: (Candidate & { office: ElectoralOffice })[],
    locations: LocationRow[],
  ): Promise<void> {
    const database = await openDatabase();
    await withActaTransaction(database, async (transaction) => {
      await transaction.runAsync(
        "DELETE FROM assigned_stations_cache WHERE user_id = ?",
        userId,
      );
      for (const station of stations) {
        await transaction.runAsync(
          `INSERT INTO assigned_stations_cache
            (user_id, id, station_number, station_sex, precinct_id, precinct_name)
           VALUES (?, ?, ?, ?, ?, ?)`,
          userId,
          station.id,
          station.stationNumber,
          station.sex,
          station.precinctId,
          station.precinctName,
        );
      }

      await transaction.runAsync("DELETE FROM candidate_catalog");
      for (const candidate of candidates) {
        await transaction.runAsync(
          `INSERT INTO candidate_catalog (id, office, name, organization_name)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             office = excluded.office,
             name = excluded.name,
             organization_name = excluded.organization_name`,
          candidate.id,
          candidate.office,
          candidate.name,
          candidate.organizationName,
        );
      }
      for (const location of locations) {
        await this.cacheLocation(transaction, location);
      }
    });
  }

  async getAssignedStations(userId: string): Promise<AssignedStation[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync<StationRow>(
      `SELECT id, station_number AS stationNumber,
              station_sex AS sex, precinct_id AS precinctId,
              precinct_name AS precinctName
       FROM assigned_stations_cache
       WHERE user_id = ?
       ORDER BY precinct_name, station_number`,
      userId,
    );
    return rows.map((row) => ({
      id: row.id,
      stationNumber: row.stationNumber,
      sex: row.sex,
      precinctId: row.precinctId,
      precinctName: row.precinctName,
    }));
  }

  async cacheRemoteActaSummaries(
    userId: string,
    summaries: ActaSummary[],
  ): Promise<void> {
    const database = await openDatabase();
    await withActaTransaction(database, async (transaction) => {
      await transaction.runAsync(
        "DELETE FROM remote_acta_summaries WHERE user_id = ?",
        userId,
      );
      for (const summary of summaries) {
        await transaction.runAsync(
          `INSERT INTO remote_acta_summaries (
            user_id, id, polling_station_id, station_number, station_sex, precinct_name,
            office, status, failure_stage, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, id) DO UPDATE SET
            polling_station_id = excluded.polling_station_id,
            station_number = excluded.station_number,
            station_sex = excluded.station_sex,
            precinct_name = excluded.precinct_name,
            office = excluded.office,
            status = excluded.status,
            failure_stage = excluded.failure_stage,
            updated_at = excluded.updated_at`,
          userId,
          summary.id,
          summary.pollingStationId,
          summary.stationNumber,
          summary.stationSex,
          summary.precinctName,
          summary.office,
          summary.status,
          summary.failureStage,
          summary.updatedAt,
        );
      }
    });
  }

  async getCachedRemoteActaSummaries(
    userId: string,
    stationIds: string[],
  ): Promise<ActaSummary[]> {
    if (stationIds.length === 0) {
      return [];
    }
    const database = await openDatabase();
    const placeholders = stationIds.map(() => "?").join(", ");
    const rows = await database.getAllAsync<CachedActaSummaryRow>(
      `SELECT * FROM remote_acta_summaries
       WHERE user_id = ? AND polling_station_id IN (${placeholders})`,
      userId,
      ...stationIds,
    );
    return rows.map((row) => ({
      id: row.id,
      pollingStationId: row.polling_station_id,
      stationNumber: row.station_number,
      stationSex: row.station_sex,
      precinctName: row.precinct_name,
      office: row.office,
      status: row.status,
      failureStage: row.failure_stage,
      updatedAt: row.updated_at,
      localDraft: false,
      correctionMode: false,
    }));
  }

  async findCachedRemoteActa(
    userId: string,
    stationId: string,
    office: ElectoralOffice,
  ): Promise<ActaSummary | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync<CachedActaSummaryRow>(
      `SELECT * FROM remote_acta_summaries
       WHERE user_id = ? AND polling_station_id = ? AND office = ?`,
      userId,
      stationId,
      office,
    );
    return row
      ? {
          id: row.id,
          pollingStationId: row.polling_station_id,
          stationNumber: row.station_number,
          stationSex: row.station_sex,
          precinctName: row.precinct_name,
          office: row.office,
          status: row.status,
          failureStage: row.failure_stage,
          updatedAt: row.updated_at,
          localDraft: false,
          correctionMode: false,
        }
      : null;
  }

  async getCandidates(office: ElectoralOffice): Promise<Candidate[]> {
    const database = await openDatabase();
    return database.getAllAsync<Candidate>(
      `SELECT id, name, organization_name AS organizationName
       FROM candidate_catalog
       WHERE office = ?
       ORDER BY organization_name`,
      office,
    );
  }

  async getLocationReference(precinctId: string): Promise<LocationRow | null> {
    const database = await openDatabase();
    return database.getFirstAsync<LocationRow>(
      `SELECT precinct_id, source_acta_id, latitude, longitude,
              captured_at_device
       FROM location_reference_cache
       WHERE precinct_id = ?`,
      precinctId,
    );
  }

  async rememberFirstLocalLocation(
    precinctId: string,
    actaId: string,
    location: Location,
    capturedAtDevice: string,
  ): Promise<LocationRow> {
    const database = await openDatabase();
    await database.runAsync(
      `INSERT OR IGNORE INTO location_reference_cache
         (precinct_id, source_acta_id, latitude, longitude, captured_at_device)
       VALUES (?, ?, ?, ?, ?)`,
      precinctId,
      actaId,
      location.latitude,
      location.longitude,
      capturedAtDevice,
    );
    const reference = await this.getLocationReference(precinctId);
    if (!reference) {
      throw new Error("No se pudo guardar la referencia GPS local.");
    }
    return reference;
  }

  async cacheLocationReference(location: LocationRow): Promise<void> {
    const database = await openDatabase();
    await database.runAsync(
      `INSERT INTO location_reference_cache
         (precinct_id, source_acta_id, latitude, longitude, captured_at_device)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(precinct_id) DO UPDATE SET
         source_acta_id = excluded.source_acta_id,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         captured_at_device = excluded.captured_at_device`,
      location.precinct_id,
      location.source_acta_id,
      location.latitude,
      location.longitude,
      location.captured_at_device,
    );
  }

  async createDraft(draft: ActaDraft): Promise<ActaDraft> {
    const existing = await this.findDraftForStation(
      draft.ownerId,
      draft.pollingStationId,
      draft.office,
    );
    if (existing) {
      return existing;
    }

    const database = await openDatabase();
    await withActaTransaction(database, async (transaction) => {
      const idCollision = await transaction.getFirstAsync<{
        observer_id: string;
        status: ActaStatus;
      }>(
        "SELECT observer_id, status FROM acta_drafts WHERE id = ?",
        draft.id,
      );
      if (idCollision) {
        const canReplaceSentDraft =
          draft.correctionMode &&
          draft.status === "ready" &&
          idCollision.observer_id !== draft.ownerId &&
          idCollision.status === "sent";
        if (!canReplaceSentDraft) {
          throw new Error(
            "Ya existe un borrador local de esta acta. No se reemplazará porque no está confirmado como enviado.",
          );
        }
        await transaction.runAsync(
          "DELETE FROM acta_draft_votes WHERE acta_id = ?",
          draft.id,
        );
        await transaction.runAsync(
          `DELETE FROM acta_drafts
           WHERE id = ? AND observer_id = ? AND status = 'sent'`,
          draft.id,
          idCollision.observer_id,
        );
      }
      await transaction.runAsync(
        `INSERT INTO acta_drafts (
          id, observer_id, polling_station_id, station_number, precinct_id,
          station_sex, precinct_name, office, photo_uri, latitude, longitude,
          captured_at_device, device_modified_at, total_voters, blank_votes,
          null_votes, status, failure_stage, correction_mode,
          submission_authorized, location_warning_meters, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        draft.id,
        draft.ownerId,
        draft.pollingStationId,
        draft.stationNumber,
        draft.precinctId,
        draft.stationSex,
        draft.precinctName,
        draft.office,
        draft.photoUri,
        draft.latitude,
        draft.longitude,
        draft.capturedAtDevice,
        draft.deviceModifiedAt,
        draft.totalVoters,
        draft.blankVotes,
        draft.nullVotes,
        draft.status,
        draft.failureStage,
        Number(draft.correctionMode),
        Number(draft.submissionAuthorized),
        draft.locationWarningMeters,
        draft.updatedAt,
      );
      for (const vote of draft.candidateVotes) {
        await transaction.runAsync(
          `INSERT OR IGNORE INTO acta_draft_votes (
            acta_id, candidate_id, candidate_name, organization_name, votes
          ) VALUES (?, ?, ?, ?, ?)`,
          draft.id,
          vote.candidateId,
          vote.candidateName,
          vote.organizationName,
          vote.votes,
        );
      }
    });

    const stored = await this.getDraft(
      draft.id,
      draft.ownerId,
    );
    if (stored) {
      return stored;
    }
    throw new Error("No se pudo crear el borrador local del acta.");
  }

  async getDraft(id: string, ownerId: string): Promise<ActaDraft | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync<DraftRow>(
      "SELECT * FROM acta_drafts WHERE id = ? AND observer_id = ?",
      id,
      ownerId,
    );
    if (!row) {
      return null;
    }
    return this.mapDraft(database, row);
  }

  async findDraftById(id: string): Promise<ActaDraft | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync<DraftRow>(
      "SELECT * FROM acta_drafts WHERE id = ?",
      id,
    );
    return row ? this.mapDraft(database, row) : null;
  }

  async findDraftForStation(
    ownerId: string,
    stationId: string,
    office: ElectoralOffice,
  ): Promise<ActaDraft | null> {
    const database = await openDatabase();
    const row = await database.getFirstAsync<DraftRow>(
      `SELECT * FROM acta_drafts
       WHERE observer_id = ? AND polling_station_id = ? AND office = ?`,
      ownerId,
      stationId,
      office,
    );
    return row ? this.mapDraft(database, row) : null;
  }

  async listDrafts(ownerId: string): Promise<ActaDraft[]> {
    const database = await openDatabase();
    const rows = await database.getAllAsync<DraftRow>(
      `SELECT * FROM acta_drafts
       WHERE observer_id = ?
       ORDER BY updated_at DESC`,
      ownerId,
    );
    const result: ActaDraft[] = [];
    for (const row of rows) {
      result.push(await this.mapDraft(database, row));
    }
    return result;
  }

  async saveDraft(draft: ActaDraft): Promise<void> {
    const database = await openDatabase();
    await withActaTransaction(database, async (transaction) => {
      await transaction.runAsync(
        `UPDATE acta_drafts SET
          photo_uri = ?, latitude = ?, longitude = ?, captured_at_device = ?,
          device_modified_at = ?, total_voters = ?, blank_votes = ?,
          null_votes = ?, status = ?, failure_stage = ?,
          correction_mode = ?, submission_authorized = ?,
          location_warning_meters = ?, updated_at = ?
         WHERE id = ? AND observer_id = ?`,
        draft.photoUri,
        draft.latitude,
        draft.longitude,
        draft.capturedAtDevice,
        draft.deviceModifiedAt,
        draft.totalVoters,
        draft.blankVotes,
        draft.nullVotes,
        draft.status,
        draft.failureStage,
        Number(draft.correctionMode),
        Number(draft.submissionAuthorized),
        draft.locationWarningMeters,
        draft.updatedAt,
        draft.id,
        draft.ownerId,
      );
      for (const vote of draft.candidateVotes) {
        await transaction.runAsync(
          `INSERT INTO acta_draft_votes (
            acta_id, candidate_id, candidate_name, organization_name, votes
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(acta_id, candidate_id) DO UPDATE SET
            candidate_name = excluded.candidate_name,
            organization_name = excluded.organization_name,
            votes = excluded.votes`,
          draft.id,
          vote.candidateId,
          vote.candidateName,
          vote.organizationName,
          vote.votes,
        );
      }
    });
  }

  private async cacheLocation(
    database: SQLite.SQLiteDatabase,
    location: LocationRow,
  ): Promise<void> {
    await database.runAsync(
      `INSERT INTO location_reference_cache (
        precinct_id, source_acta_id, latitude, longitude, captured_at_device
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(precinct_id) DO UPDATE SET
        source_acta_id = excluded.source_acta_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        captured_at_device = excluded.captured_at_device`,
      location.precinct_id,
      location.source_acta_id,
      location.latitude,
      location.longitude,
      location.captured_at_device,
    );
  }

  private async mapDraft(
    database: SQLite.SQLiteDatabase,
    row: DraftRow,
  ): Promise<ActaDraft> {
    const voteRows = await database.getAllAsync<VoteRow>(
      `SELECT acta_id, candidate_id, candidate_name, organization_name, votes
       FROM acta_draft_votes
       WHERE acta_id = ?
       ORDER BY candidate_name`,
      row.id,
    );
    const candidateVotes: CandidateVote[] = voteRows.map((vote) => ({
      candidateId: vote.candidate_id,
      candidateName: vote.candidate_name,
      organizationName: vote.organization_name,
      votes: vote.votes,
    }));
    return {
      id: row.id,
      ownerId: row.observer_id,
      pollingStationId: row.polling_station_id,
      stationNumber: row.station_number,
      stationSex: row.station_sex,
      precinctId: row.precinct_id,
      precinctName: row.precinct_name,
      office: row.office,
      photoUri: row.photo_uri,
      latitude: row.latitude,
      longitude: row.longitude,
      capturedAtDevice: row.captured_at_device,
      deviceModifiedAt: row.device_modified_at,
      totalVoters: row.total_voters,
      blankVotes: row.blank_votes,
      nullVotes: row.null_votes,
      candidateVotes,
      status: row.status,
      failureStage: row.failure_stage,
      correctionMode: row.correction_mode === 1,
      submissionAuthorized: row.submission_authorized === 1,
      locationWarningMeters: row.location_warning_meters,
      updatedAt: row.updated_at,
    };
  }
}
