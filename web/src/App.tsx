import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { supabase, supabaseConfigurationError } from "./supabase";

type PageMode = "checking" | "request" | "update" | "done" | "confirmed";

const emailSchema = z.object({
  email: z.email("Ingresa un correo válido.").trim().toLowerCase(),
});

const passwordSchema = z
  .object({
    password: z.string().min(1, "Ingresa una contraseña nueva."),
    confirmPassword: z.string().min(1, "Confirma la contraseña nueva."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type EmailValues = z.infer<typeof emailSchema>;
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
  const [mode, setMode] = useState<PageMode>(
    supabaseConfigurationError ? "request" : "checking",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const recoveryInUrl =
      window.location.pathname.endsWith("/reset-password") ||
      hashParams.get("type") === "recovery";
    const signupConfirmationInUrl =
      searchParams.get("type") === "signup" ||
      hashParams.get("type") === "signup" ||
      (searchParams.has("code") && !recoveryInUrl);
    const linkError =
      searchParams.has("error") ||
      searchParams.has("error_description") ||
      hashParams.has("error");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setErrorMessage(null);
      } else if (event === "SIGNED_OUT") {
        setMode("request");
      } else if (session) {
        if (recoveryInUrl) {
          setMode("update");
        } else if (signupConfirmationInUrl) {
          setMode("confirmed");
        }
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
            "El enlace pudo haber vencido. Solicita un enlace nuevo desde la aplicación.",
          );
          setMode("request");
          return;
        }

        if (data.session && recoveryInUrl) {
          setMode("update");
        } else if (data.session && signupConfirmationInUrl) {
          setMode("confirmed");
        } else {
          if (linkError) {
            setErrorMessage(
              "El enlace es inválido o venció. Solicita uno nuevo desde la aplicación.",
            );
          }
          setMode("request");
        }
      })
      .catch(() => {
        if (active) {
          setErrorMessage("No se pudo comprobar el enlace de recuperación.");
          setMode("request");
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const requestReset = emailForm.handleSubmit(async ({ email }) => {
    if (!supabase) {
      return;
    }

    setErrorMessage(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const redirectTo = new URL("/reset-password", window.location.origin);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo.toString(),
      });
      if (error) {
        throw error;
      }
      setMessage(
        "Si la cuenta existe, recibirás un correo con instrucciones para restablecer la contraseña.",
      );
    } catch (requestError) {
      const requestMessage =
        requestError instanceof Error ? requestError.message.toLowerCase() : "";
      setErrorMessage(
        requestMessage.includes("rate limit") ||
          requestMessage.includes("too many")
          ? "Se alcanzó el límite de correos. Espera antes de solicitar otro enlace."
          : requestMessage.includes("network") ||
              requestMessage.includes("fetch")
            ? "No se pudo conectar. Revisa internet e inténtalo de nuevo."
            : "Auth no pudo enviar el enlace. Verifica SMTP y las URLs permitidas en Supabase.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const updatePassword = passwordForm.handleSubmit(async ({ password }) => {
    if (!supabase) {
      return;
    }

    setErrorMessage(null);
    setMessage(null);
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
          <h1 id="page-title">Recuperar acceso</h1>
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
          <a className="button" href="examen1://login">
            Abrir la aplicación
          </a>
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
          <p>
            Tu cuenta ya puede usarse. Vuelve a la aplicación e ingresa con la
            contraseña temporal que te entregó tu coordinador.
          </p>
          <a className="button" href="examen1://login">
            Abrir la aplicación
          </a>
        </section>
      </main>
    );
  }

  const isUpdating = mode === "update";

  return (
    <main className="page">
      <section className="card" aria-labelledby="page-title">
        <p className="eyebrow">Control Electoral</p>
        <h1 id="page-title">
          {isUpdating ? "Crear contraseña nueva" : "Recuperar contraseña"}
        </h1>
        <p>
          {isUpdating
            ? "Elige una contraseña y confírmala para recuperar el acceso."
            : "Ingresa el correo de tu cuenta. Si existe, recibirás un enlace de recuperación."}
        </p>

        {errorMessage ? (
          <p className="feedback error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {message ? (
          <p className="feedback success" role="status">
            {message}
          </p>
        ) : null}

        {isUpdating ? (
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
        ) : (
          <form onSubmit={requestReset} noValidate>
            <label htmlFor="email">Correo electrónico</label>
            <input
              autoComplete="email"
              id="email"
              inputMode="email"
              type="email"
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email?.message ? (
              <span className="field-error">
                {emailForm.formState.errors.email.message}
              </span>
            ) : null}

            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Enviando…" : "Enviar enlace"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
