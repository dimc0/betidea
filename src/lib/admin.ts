import "server-only";

export function estAdministrateur(email: string | null | undefined): boolean {
  if (!email) return false;

  const administrateurs = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((adresse) => adresse.trim().toLowerCase())
    .filter(Boolean);

  return administrateurs.includes(email.toLowerCase());
}
