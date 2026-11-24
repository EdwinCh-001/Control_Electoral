import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

import { corsHeaders, getBearerToken, isRecord, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Usa el método POST." });
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse(401, { error: "Inicia sesión para cambiar la contraseña." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "La función de cambio de contraseña no está configurada.",
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "El cuerpo de la solicitud no es válido." });
  }

  if (
    !isRecord(payload) ||
    typeof payload.newPassword !== "string" ||
    payload.newPassword.length === 0
  ) {
    return jsonResponse(400, { error: "Ingresa una contraseña nueva." });
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
    return jsonResponse(401, { error: "La sesión expiró. Inicia sesión de nuevo." });
  }

  const { data: profile, error: profileReadError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileReadError || !profile) {
    return jsonResponse(403, {
      error: "La cuenta no tiene un perfil autorizado.",
    });
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(
    authData.user.id,
    { password: payload.newPassword },
  );
  if (passwordError) {
    return jsonResponse(400, {
      error: "Supabase rechazó la contraseña. Revisa la política configurada.",
    });
  }

  const { error: flagError } = await adminClient
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", authData.user.id);

  if (flagError) {
    return jsonResponse(500, {
      error: "La contraseña cambió, pero no se pudo actualizar el perfil. Intenta de nuevo.",
    });
  }

  return jsonResponse(200, { success: true });
});
