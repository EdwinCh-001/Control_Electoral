import type { ActaDraft, CandidateVote, Location } from "./acta";

function isNonnegativeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

export function validateActaTally(draft: ActaDraft): string[] {
  const errors: string[] = [];
  if (draft.candidateVotes.length !== 5) {
    errors.push("El acta debe tener exactamente cinco candidaturas.");
  }
  if (
    new Set(draft.candidateVotes.map((candidate) => candidate.candidateId)).size !==
    5
  ) {
    errors.push("Las cinco candidaturas deben ser distintas.");
  }

  const candidateCounts = draft.candidateVotes.map(
    (candidate) => candidate.votes,
  );
  const totalVoters = draft.totalVoters;
  const blankVotes = draft.blankVotes;
  const nullVotes = draft.nullVotes;
  if (
    !isNonnegativeInteger(totalVoters) ||
    !isNonnegativeInteger(blankVotes) ||
    !isNonnegativeInteger(nullVotes) ||
    candidateCounts.some((value) => !isNonnegativeInteger(value))
  ) {
    errors.push("Completa todos los números del acta antes de enviar.");
    return errors;
  }

  const sum =
    candidateCounts.reduce<number>(
      (total, value) => total + (isNonnegativeInteger(value) ? value : 0),
      0,
    ) +
    blankVotes +
    nullVotes;
  if (totalVoters !== sum) {
    errors.push(
      `El total de sufragantes (${totalVoters}) debe coincidir con la suma de votos (${sum}).`,
    );
  }
  return errors;
}

export function updateCandidateVotes(
  current: CandidateVote[],
  candidateId: string,
  votes: number | null,
): CandidateVote[] {
  return current.map((candidate) =>
    candidate.candidateId === candidateId
      ? { ...candidate, votes }
      : candidate,
  );
}

export function haversineMeters(first: Location, second: Location): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getLocationWarning(
  capturedLocation: Location,
  referenceLocation: Location | null,
): number | null {
  if (!referenceLocation) {
    return null;
  }
  const distance = haversineMeters(capturedLocation, referenceLocation);
  return distance > 300 ? distance : null;
}

export function getNextDeviceTimestamp(previous: string): string {
  const previousTime = Date.parse(previous);
  return new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
}
