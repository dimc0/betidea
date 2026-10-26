"use client";

import { useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

export default function FormulaireConnexion({ erreurLien }: { erreurLien: boolean }) {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(
    erreurLien ? "Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau." : ""
  );

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");

    const supabase = creerClientNavigateur();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setEnvoi(false);

    if (error) {
      console.error(error);
      setErreur("L'envoi du lien a échoué. Patientez quelques minutes avant de réessayer.");
      return;
    }

    setEnvoye(true);
  }

  if (envoye) {
    return (
      <p className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/60 p-4 text-emerald-200">
        Un lien de connexion vient d&apos;être envoyé à <strong>{email}</strong>. Ouvrez-le
        dans ce même navigateur.
      </p>
    );
  }

  return (
    <form onSubmit={envoyer} className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="block font-medium">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.com"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3"
        />
      </div>

      <button
        type="submit"
        disabled={envoi || email === ""}
        className="rounded-lg bg-emerald-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"
      >
        {envoi ? "Envoi en cours…" : "Recevoir un lien de connexion"}
      </button>

      {erreur && (
        <p className="rounded-lg border border-rose-900 bg-rose-950/60 p-3 text-rose-200">{erreur}</p>
      )}
    </form>
  );
}
