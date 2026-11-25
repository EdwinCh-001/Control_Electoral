export type NoticeKind = "info" | "success" | "warning" | "error";

export interface HumanMessage {
  title?: string;
  message: string;
  technicalDetails?: string;
}

function textOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

function withTechnical(
  title: string,
  message: string,
  raw: string,
): HumanMessage {
  const technicalDetails = raw.trim();
  return {
    title,
    message,
    ...(technicalDetails ? { technicalDetails } : {}),
  };
}

/**
 * Convierte errores de servicios en mensajes accionables para campo.
 * El texto original queda disponible como detalle técnico para soporte.
 */
export function humanizeErrorMessage(error: unknown): HumanMessage {
  const raw = textOf(error).trim();
  const normalized = raw.toLowerCase();

  if (!raw) {
    return {
      title: "No se pudo completar",
      message: "Intenta de nuevo. Si el problema sigue, avisa a tu coordinador.",
    };
  }

  if (
    /device modification time|same device capture time|gps reference needs review|misma hora de captura|referencia gps/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "Necesitamos revisar dos actas",
      "Hay dos revisiones del acta con horarios que no permiten decidir cuál es la última. Un coordinador debe revisarlas; no se eligió ninguna automáticamente.",
      raw,
    );
  }

  if (
    /network|failed to fetch|fetch failed|offline|internet|connection|conexión|conexion|en línea|en linea/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "Sin conexión",
      "Revisa tu internet y vuelve a intentar. Lo que ya escribiste sigue guardado en este dispositivo.",
      raw,
    );
  }

  if (/timed? ?out|timeout|tardó|tardo demasiado/.test(normalized)) {
    return withTechnical(
      "La conexión tardó demasiado",
      "Espera unos segundos y vuelve a intentar. Tus datos siguen guardados.",
      raw,
    );
  }

  if (
    /invalid login credentials|invalid credentials|credenciales inválidas|credenciales invalidas|wrong password|contraseña incorrecta/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "No pudimos iniciar sesión",
      "El correo o la contraseña no coinciden. Verifica tus datos e intenta de nuevo.",
      raw,
    );
  }

  if (/email not confirmed|correo no confirmado|confirm your email/.test(normalized)) {
    return withTechnical(
      "Falta confirmar tu correo",
      "Revisa el correo que recibiste y confirma tu cuenta antes de ingresar.",
      raw,
    );
  }

  if (
    /\bjwt\b|refresh token|invalid token|token (?:has )?expired|auth session missing|session (?:has )?expired|sesión expirada|sesion expirada|expired|expirad/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "Tu sesión venció",
      "Vuelve a iniciar sesión para continuar. No se perdió nada de lo que guardaste.",
      raw,
    );
  }

  if (
    /permission|not authorized|unauthorized|forbidden|denied|row-level security|policy|política|politica|no autorizado/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "No tienes acceso a esta acción",
      "Pide apoyo a tu coordinador para continuar con esta tarea.",
      raw,
    );
  }

  if (
    /user already registered|already registered|duplicate key|unique constraint|correo ya registrado|ya existe/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "Ese correo ya tiene una cuenta",
      "Usa otro correo o inicia sesión con la cuenta existente.",
      raw,
    );
  }

  if (/password should be|weak password|contraseña débil|password too short/.test(normalized)) {
    return withTechnical(
      "La contraseña no cumple los requisitos",
      "Usa una contraseña más larga y difícil de adivinar.",
      raw,
    );
  }

  if (/camera|cámara|camara/.test(normalized)) {
    return withTechnical(
      "Necesitamos la cámara",
      "Habilita el permiso de cámara para fotografiar el acta.",
      raw,
    );
  }

  if (/location|ubicación|ubicacion|gps/.test(normalized)) {
    return withTechnical(
      "Necesitamos la ubicación",
      "Activa la ubicación para registrar dónde se tomó la foto del acta.",
      raw,
    );
  }

  if (/ya est[aá] procesando|est[aá] procesando|procesando esta fotograf/.test(normalized)) {
    return withTechnical(
      "Ya estamos leyendo la foto",
      "Espera un momento antes de volver a intentar. El resultado aparecerá aquí cuando termine.",
      raw,
    );
  }

  if (/sharpness|nitidez|blur|borros|threshold|umbral/.test(normalized)) {
    return withTechnical(
      "La foto no se ve clara",
      "Toma otra foto con más luz y sin mover el teléfono. Si no puedes, escribe los datos manualmente.",
      raw,
    );
  }

  if (/ocr|gemini|model|modelo|lectura de la fotografía|lectura de la fotografia/.test(normalized)) {
    return withTechnical(
      "No pudimos leer la foto",
      "Puedes intentar de nuevo o escribir los datos manualmente. El acta sigue guardada.",
      raw,
    );
  }

  if (/sqlite|storage|database|base de datos|disk|disco|espacio|file system|filesystem/.test(normalized)) {
    return withTechnical(
      "No pudimos guardar en el dispositivo",
      "Revisa el espacio disponible y vuelve a intentar. El acta no se ha perdido.",
      raw,
    );
  }

  if (
    /debe coincidir con la suma|suma de votos|cuadre matemático|cuadre matematico/.test(
      normalized,
    )
  ) {
    return withTechnical(
      "Los números no cuadran",
      "Revisa los sufragantes y la suma de votos. Corrige el dato que no coincide antes de enviar.",
      raw,
    );
  }

  if (/500|502|503|504|server error|internal server|supabase|postgres|database error/.test(normalized)) {
    return withTechnical(
      "El sistema no respondió",
      "Intenta de nuevo en unos minutos. Si sigue igual, avisa a soporte con el detalle técnico.",
      raw,
    );
  }

  const looksTechnical =
    /error:|exception|undefined|null|stack|sql|http|status code|failed|failure|\b[a-z]+_[a-z_]+\b/i.test(
      raw,
    );

  if (looksTechnical) {
    return withTechnical(
      "No se pudo completar",
      "Intenta de nuevo. Si el problema sigue, avisa a soporte con el detalle técnico.",
      raw,
    );
  }

  return { message: raw };
}

export function errorText(error: unknown, fallback: string): string {
  const message = humanizeErrorMessage(error).message;
  return message || fallback;
}
