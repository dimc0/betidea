import { notFound } from "next/navigation";
import TableauStatut from "@/components/TableauStatut";
import { estAdministrateur } from "@/lib/admin";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function Admin() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdministrateur(user?.email)) {
    notFound();
  }

  return <TableauStatut />;
}
