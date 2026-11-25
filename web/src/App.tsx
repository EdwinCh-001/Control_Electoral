import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { supabase, supabaseConfigurationError } from "./supabase";

type PageMode = "checking" | "update" | "done" | "confirmed" | "invalid";

const passwordSchema = z
  .object({
    password: z.string().min(1, "Ingresa una contraseña nueva."),
    confirmPassword: z.string().min(1, "Confirma la contraseña nueva."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

async function getFunctionError(error: {
  message: string;
  context?: unknown;
}): Promise<string> {
  if (error.context instanceof Response) {
    try {
      const body: unknown = await error.context.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
    } catch {
      return "No se pudo completar el cambio de contraseña.";
    }
  }

  return "No se pudo completar el cambio de contraseña. Intenta de nuevo.";
}

export default function App() {
  const [mode, setMode] = useState<PageMode>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const isResetPasswordRoute = path === "/reset-password";
    const isEmailVerifiedRoute = path === "/email-verified";
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const recoveryInUrl =
      (searchParams.get("type") === "recovery" &&
        (searchParams.has("code") || searchParams.has("access_token"))) ||
      (hashParams.get("type") === "recovery" &&
        (hashParams.has("code") || hashParams.has("access_token")));
    const linkError =
      searchParams.has("error") ||
      searchParams.has("error_description") ||
      searchParams.has("error_code") ||
      hashParams.has("error") ||
      hashParams.has("error_description") ||
      hashParams.has("error_code");

    if (linkError) {
      setErrorMessage(
        "El enlace es inválido o venció. Solicita uno nuevo desde la aplicación.",
      );
      setMode("invalid");
      return () => {
        active = false;
      };
    }

    if (isEmailVerifiedRoute) {
      setMode("confirmed");
      return () => {
        active = false;
      };
    }

    if (!isResetPasswordRoute) {
      setMode("invalid");
      return () => {
        active = false;
      };
    }

    let recoverySessionDetected = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }
      if (event === "PASSWORD_RECOVERY" && session) {
        recoverySessionDetected = true;
        setMode("update");
        setErrorMessage(null);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }
        if (error) {
          setErrorMessage(
            "El enlace de recuperación pudo haber vencido. Solicita uno nuevo desde la aplicación.",
          );
          setMode("invalid");
          return;
        }

        if (
          data.session &&
          (recoveryInUrl || recoverySessionDetected)
        ) {
          setMode("update");
        } else {
          setErrorMessage(
            "Abre un enlace de recuperación válido enviado a tu correo.",
          );
          setMode("invalid");
        }
      })
      .catch(() => {
        if (active) {
          setErrorMessage("No se pudo comprobar el enlace de recuperación.");
          setMode("invalid");
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const updatePassword = passwordForm.handleSubmit(async ({ password }) => {
    if (!supabase) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("El enlace expiró. Solicita uno nuevo.");
      }

      const { error } = await supabase.functions.invoke(
        "complete-password-change",
        { body: { newPassword: password } },
      );
      if (error) {
        throw new Error(await getFunctionError(error));
      }

      await supabase.auth.signOut();
      setMode("done");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la contraseña.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  if (supabaseConfigurationError) {
    return (
      <main className="page">
        <section className="card" aria-labelledby="page-title">
          <p className="eyebrow">Control Electoral</p>
          <h1 id="page-title">Acceso no configurado</h1>
          <p role="status">{supabaseConfigurationError}</p>
          <p>
            El administrador debe configurar las variables públicas de Supabase
            en el proyecto de Vercel.
          </p>
        </section>
      </main>
    );
  }

  if (mode === "checking") {
    return (
      <main className="page">
        <section className="card" role="status">
          <p className="eyebrow">Control Electoral</p>
          <p>Comprobando el enlace…</p>
        </section>
      </main>
    );
  }

  if (mode === "done") {
    return (
      <main className="page">
        <section className="card" aria-labelledby="page-title">
          <p className="eyebrow">Control Electoral</p>
          <h1 id="page-title">Contraseña actualizada</h1>
          <p>
            Ya puedes volver a la aplicación e ingresar con tu contraseña
            nueva.
          </p>
        </section>
      </main>
    );
  }

  if (mode === "confirmed") {
    return (
      <main className="page">
        <section className="card" aria-labelledby="page-title">
          <p className="eyebrow">Control Electoral</p>
          <h1 id="page-title">Correo confirmado</h1>
          <p>Tu correo se verificó correctamente.</p>
        </section>
      </main>
    );
  }

  if (mode === "invalid") {
    return (
      <main className="page">
        <section className="card" aria-labelledby="page-title">
          <p className="eyebrow">Control Electoral</p>
          <h1 id="page-title">Enlace inválido</h1>
          <p role="alert">
            {errorMessage ??
              "Abre desde tu correo el enlace de verificación o recuperación."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Control Electoral</p>
        <h1 id="page-title">Crear contraseña nueva</h1>
        <p>Elige una contraseña y confírmala para recuperar el acceso.</p>

        {errorMessage ? (
          <p className="feedback error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <form onSubmit={updatePassword} noValidate>
          <label htmlFor="password">Contraseña nueva</label>
          <input
            autoComplete="new-password"
            id="password"
            type="password"
            {...passwordForm.register("password")}
          />
          {passwordForm.formState.errors.password?.message ? (
            <span className="field-error">
              {passwordForm.formState.errors.password.message}
            </span>
          ) : null}

          <label htmlFor="confirmPassword">Confirmar contraseña</label>
          <input
            autoComplete="new-password"
            id="confirmPassword"
            type="password"
            {...passwordForm.register("confirmPassword")}
          />
          {passwordForm.formState.errors.confirmPassword?.message ? (
            <span className="field-error">
              {passwordForm.formState.errors.confirmPassword.message}
            </span>
          ) : null}

          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
