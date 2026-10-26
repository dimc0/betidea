import { notFound } from "next/navigation";
import { connection } from "next/server";
import TableauStatut from "@/components/TableauStatut";
import { estAdministrateur } from "@/lib/admin";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function Admin() {
  // Session lue à chaque requête (voir EnTete).
  await connection();

  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdministrateur(user?.email)) {
    notFound();
  }

  return <TableauStatut />;
}
