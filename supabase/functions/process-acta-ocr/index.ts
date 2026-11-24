import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

import {
  corsHeaders,
  getBearerToken,
  isRecord,
  jsonResponse,
} from "../_shared/http.ts";

type Office = "mayor" | "prefect";

interface OCRInput {
  imageBase64: string;
  pollingStationId: string;
  office: Office;
}

interface ModelCandidateVote {
  candidateId: string;
  votes: number | null;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseInput(value: unknown): OCRInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const { imageBase64, pollingStationId, office } = value;
  if (
    typeof imageBase64 !== "string" ||
    imageBase64.length > 6 * 1024 * 1024 ||
    imageBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) ||
    typeof pollingStationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pollingStationId,
    ) ||
    (office !== "mayor" && office !== "prefect")
  ) {
    return null;
  }
  return { imageBase64, pollingStationId, office };
}

function parseModelText(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    return null;
  }
  const firstCandidate = value.candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content)) {
    return null;
  }
  const parts = firstCandidate.content.parts;
  if (!Array.isArray(parts)) {
    return null;
  }
  const textPart = parts.find(
    (part) => isRecord(part) && typeof part.text === "string",
  );
  if (!isRecord(textPart) || typeof textPart.text !== "string") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(textPart.text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseCandidateVotes(
  value: unknown,
  allowedIds: Set<string>,
): Map<string, number | null> {
  const votes = new Map<string, number | null>();
  if (!Array.isArray(value)) {
    return votes;
  }
  for (const entry of value) {
    if (
      isRecord(entry) &&
      typeof entry.candidateId === "string" &&
      allowedIds.has(entry.candidateId) &&
      !votes.has(entry.candidateId)
    ) {
      votes.set(
        entry.candidateId,
        entry.votes === null || !isNonnegativeInteger(entry.votes)
          ? null
          : entry.votes,
      );
    }
  }
  return votes;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Usa el método POST." });
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse(401, { error: "Inicia sesión para procesar el acta." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const geminiModel = Deno.env.get("GEMINI_MODEL");
  if (!supabaseUrl || !anonKey || !geminiApiKey || !geminiModel) {
    return jsonResponse(500, {
      error: "La función OCR no está configurada por el administrador.",
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "El cuerpo de la solicitud no es válido." });
  }
  const input = parseInput(payload);
  if (!input) {
    return jsonResponse(400, {
      error: "La imagen o la información de la mesa no es válida.",
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "La sesión expiró. Inicia sesión de nuevo." });
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "observer") {
    return jsonResponse(403, {
      error: "Solo un veedor autorizado puede procesar actas.",
    });
  }

  const { data: assignment, error: assignmentError } = await userClient
    .from("observer_assignments")
    .select("polling_station_id")
    .eq("observer_id", authData.user.id)
    .eq("polling_station_id", input.pollingStationId)
    .is("revoked_at", null)
    .maybeSingle();
  if (assignmentError || !assignment) {
    return jsonResponse(403, {
      error: "La mesa no está asignada a tu cuenta.",
    });
  }

  const { data: candidates, error: candidatesError } = await userClient
    .from("candidates")
    .select("id, full_name, organization_id")
    .eq("office", input.office);
  if (candidatesError || candidates.length !== 5) {
    return jsonResponse(409, {
      error: "No hay cinco candidaturas configuradas para esta dignidad.",
    });
  }

  const organizationIds = [
    ...new Set(candidates.map((candidate) => candidate.organization_id)),
  ];
  const { data: organizations, error: organizationsError } = await userClient
    .from("political_organizations")
    .select("id, name")
    .in("id", organizationIds);
  if (organizationsError) {
    return jsonResponse(500, {
      error: "No se pudieron cargar las organizaciones políticas.",
    });
  }

  const organizationNames = new Map(
    organizations.map((organization) => [organization.id, organization.name]),
  );
  const candidateLabels = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.full_name,
    organization: organizationNames.get(candidate.organization_id) ?? "",
  }));
  if (candidateLabels.some((candidate) => !candidate.organization)) {
    return jsonResponse(500, {
      error: "Una candidatura no tiene organización configurada.",
    });
  }

  const prompt = [
    "Extrae del acta electoral únicamente los valores que sean legibles.",
    "Devuelve un objeto JSON sin markdown con las claves totalVoters, blankVotes, nullVotes y candidateVotes.",
    "Cada cantidad debe ser un entero no negativo o null si no puede leerse con certeza.",
    "candidateVotes debe contener una entrada por cada candidatura proporcionada, usando exactamente su candidateId.",
    "No calcules, corrijas ni completes valores inferidos; deja null cualquier campo ilegible.",
    `Dignidad: ${input.office}.`,
    `Candidaturas: ${JSON.stringify(candidateLabels)}.`,
  ].join("\n");

  let modelResponse: Response;
  try {
    modelResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: input.imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
          },
        }),
      },
    );
  } catch {
    return jsonResponse(502, {
      error: "No se pudo conectar con el servicio OCR. El acta sigue guardada localmente.",
    });
  }

  if (!modelResponse.ok) {
    return jsonResponse(502, {
      error: "El servicio OCR no pudo procesar la imagen. Puedes reintentar o ingresar los resultados manualmente.",
    });
  }

  let modelPayload: unknown;
  try {
    modelPayload = await modelResponse.json();
  } catch {
    return jsonResponse(502, {
      error: "El servicio OCR devolvió una respuesta inválida.",
    });
  }
  const extracted = parseModelText(modelPayload);
  if (!extracted) {
    return jsonResponse(502, {
      error: "No se pudo interpretar el resultado OCR. Reintenta o ingresa los valores manualmente.",
    });
  }

  const allowedIds = new Set(candidates.map((candidate) => candidate.id));
  const votesById = parseCandidateVotes(
    extracted.candidateVotes,
    allowedIds,
  );
  const candidateVotes: ModelCandidateVote[] = candidates.map((candidate) => ({
    candidateId: candidate.id,
    votes: votesById.get(candidate.id) ?? null,
  }));

  return jsonResponse(200, {
    totalVoters: isNonnegativeInteger(extracted.totalVoters)
      ? extracted.totalVoters
      : null,
    blankVotes: isNonnegativeInteger(extracted.blankVotes)
      ? extracted.blankVotes
      : null,
    nullVotes: isNonnegativeInteger(extracted.nullVotes)
      ? extracted.nullVotes
      : null,
    candidateVotes,
  });
});
