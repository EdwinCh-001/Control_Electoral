import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

import { corsHeaders, getBearerToken, isRecord, jsonResponse } from "../_shared/http.ts";

interface CreateAccountPayload {
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  precinctId?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function makeTemporaryPassword(): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%_-";
  const alphabet = uppercase + lowercase + digits + symbols;
  const randomValues = crypto.getRandomValues(new Uint8Array(32));
  return [
    uppercase[randomValues[0] % uppercase.length],
    lowercase[randomValues[1] % lowercase.length],
    digits[randomValues[2] % digits.length],
    symbols[randomValues[3] % symbols.length],
    ...Array.from(
      randomValues.slice(4),
      (value) => alphabet[value % alphabet.length],
    ),
  ].join("");
}

function parsePayload(value: unknown): CreateAccountPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const { fullName, nationalId, phone, email, precinctId } = value;
  if (
    !isNonEmptyString(fullName) ||
    !isNonEmptyString(nationalId) ||
    !isNonEmptyString(phone) ||
    !isNonEmptyString(email) ||
    (precinctId !== undefined && !isNonEmptyString(precinctId))
  ) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return null;
  }

  return {
    fullName: fullName.trim(),
    nationalId: nationalId.trim(),
    phone: phone.trim(),
    email: normalizedEmail,
    ...(typeof precinctId === "string"
      ? { precinctId: precinctId.trim() }
      : {}),
  };
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
    return jsonResponse(401, { error: "Inicia sesión para crear cuentas." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "La función de administración no está configurada.",
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "El cuerpo de la solicitud no es válido." });
  }

  const input = parsePayload(payload);
  if (!input) {
    return jsonResponse(400, {
      error: "Completa nombres, cédula, teléfono y un correo válido.",
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(401, { error: "La sesión no es válida. Inicia sesión." });
  }

  const { data: actor, error: actorError } = await adminClient
    .from("profiles")
    .select("id, role, province_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (actorError || !actor) {
    return jsonResponse(403, {
      error: "Tu cuenta no tiene un perfil autorizado.",
    });
  }

  let newRole: "precinct_coordinator" | "observer";
  let precinctId: string | null = null;

  if (actor.role === "provincial_coordinator") {
    if (!input.precinctId) {
      return jsonResponse(400, {
        error: "Selecciona un recinto para el nuevo coordinador.",
      });
    }

    const { data: precinct, error: precinctError } = await adminClient
      .from("precincts")
      .select("id, canton_id")
      .eq("id", input.precinctId)
      .maybeSingle();

    if (precinctError || !precinct) {
      return jsonResponse(404, { error: "El recinto seleccionado no existe." });
    }

    const { data: canton, error: cantonError } = await adminClient
      .from("cantons")
      .select("province_id")
      .eq("id", precinct.canton_id)
      .maybeSingle();

    if (cantonError || !canton || canton.province_id !== actor.province_id) {
      return jsonResponse(403, {
        error: "El recinto está fuera de tu jurisdicción.",
      });
    }

    newRole = "precinct_coordinator";
    precinctId = precinct.id;
  } else if (actor.role === "precinct_coordinator") {
    const { data: assignment, error: assignmentError } = await adminClient
      .from("precinct_coordinators")
      .select("precinct_id")
      .eq("user_id", actor.id)
      .maybeSingle();

    if (assignmentError || !assignment) {
      return jsonResponse(403, {
        error: "Tu cuenta no tiene un recinto asignado.",
      });
    }

    const { data: precinct, error: precinctError } = await adminClient
      .from("precincts")
      .select("canton_id")
      .eq("id", assignment.precinct_id)
      .maybeSingle();
    if (precinctError || !precinct) {
      return jsonResponse(403, {
        error: "No se pudo validar el recinto de tu cuenta.",
      });
    }

    const { data: canton, error: cantonError } = await adminClient
      .from("cantons")
      .select("province_id")
      .eq("id", precinct.canton_id)
      .maybeSingle();
    if (cantonError || !canton || canton.province_id !== actor.province_id) {
      return jsonResponse(403, {
        error: "Tu recinto no pertenece a la provincia de tu perfil.",
      });
    }

    newRole = "observer";
    precinctId = assignment.precinct_id;
  } else {
    return jsonResponse(403, {
      error: "Solo los coordinadores autorizados pueden crear cuentas.",
    });
  }

  const temporaryPassword = makeTemporaryPassword();
  const { data: createdAuthUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: input.email,
      password: temporaryPassword,
      email_confirm: false,
      user_metadata: { full_name: input.fullName },
    });

  if (createUserError || !createdAuthUser.user) {
    return jsonResponse(409, {
      error: "No se pudo crear la cuenta. Verifica si el correo ya está registrado.",
    });
  }

  const newUserId = createdAuthUser.user.id;
  const { error: profileError } = await adminClient.from("profiles").insert({
    id: newUserId,
    role: newRole,
    province_id: actor.province_id,
    national_id: input.nationalId,
    full_name: input.fullName,
    phone: input.phone,
    email: input.email,
    created_by: actor.id,
    must_change_password: true,
  });

  if (profileError) {
    const { error: cleanupError } =
      await adminClient.auth.admin.deleteUser(newUserId);
    if (cleanupError) {
      return jsonResponse(500, {
        error: "Falló el perfil y no se pudo limpiar el usuario Auth; requiere revisión administrativa.",
      });
    }
    return jsonResponse(409, {
      error: "No se pudo guardar el perfil. Revisa si la cédula ya está registrada.",
    });
  }

  let coordinatorAssignmentCreated = false;
  if (newRole === "precinct_coordinator" && precinctId) {
    const { error: assignmentError } = await adminClient
      .from("precinct_coordinators")
      .insert({
        precinct_id: precinctId,
        user_id: newUserId,
        assigned_by: actor.id,
      });

    if (assignmentError) {
      const { error: cleanupError } =
        await adminClient.auth.admin.deleteUser(newUserId);
      if (cleanupError) {
        return jsonResponse(500, {
          error: "Falló la asignación y no se pudo limpiar la cuenta; requiere revisión administrativa.",
        });
      }
      return jsonResponse(409, {
        error: "No se pudo asignar el coordinador al recinto.",
      });
    }
    coordinatorAssignmentCreated = true;
  }

  const mailClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: emailError } = await mailClient.auth.resend({
    type: "signup",
    email: input.email,
  });

  if (emailError) {
    if (coordinatorAssignmentCreated && precinctId) {
      const { error: assignmentCleanupError } = await adminClient
        .from("precinct_coordinators")
        .delete()
        .eq("precinct_id", precinctId)
        .eq("user_id", newUserId);
      if (assignmentCleanupError) {
        return jsonResponse(500, {
          error: "Falló el envío y no se pudo limpiar la asignación; requiere revisión administrativa.",
        });
      }
    }
    const { error: userCleanupError } =
      await adminClient.auth.admin.deleteUser(newUserId);
    if (userCleanupError) {
      return jsonResponse(500, {
        error: "Falló el envío y no se pudo limpiar la cuenta; requiere revisión administrativa.",
      });
    }
    return jsonResponse(502, {
      error: "No se pudo enviar la confirmación. Verifica SMTP y vuelve a crear la cuenta.",
    });
  }

  return jsonResponse(201, {
    email: input.email,
    role: newRole,
    temporaryPassword,
  });
});
