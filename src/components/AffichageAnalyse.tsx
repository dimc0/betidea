
import type {
  Affiche,
  AnalyseStructuree,
} from "@/lib/affiche";

const NOMS_SPORTS = {
  football: "Football",
};

export default function AffichageAnalyse({
  affiche,
  analyse,
}: {
  affiche: Affiche;
  analyse: AnalyseStructuree;
}) {
  return (
    <article className="mt-6 rounded-lg border p-6">
      <h2 className="text-2xl font-bold">
        {affiche.equipe_dom} contre {affiche.equipe_ext}
      </h2>

      <p className="mt-2 text-sm text-gray-600">
        {NOMS_SPORTS[affiche.sport]} · {affiche.competition} ·{" "}
        {affiche.date_match}
      </p>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Résumé</h3>
        <p className="mt-2 whitespace-pre-line">
          {analyse.resume}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Forme récente</h3>
        <p className="mt-2 whitespace-pre-line">
          {analyse.forme_recente}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Facteurs clés</h3>

        {analyse.facteurs_cles.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analyse.facteurs_cles.map((facteur, index) => (
              <li key={index}>{facteur}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-gray-600">
            Aucun facteur clé identifié.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Conclusion</h3>
        <p className="mt-2">{analyse.justification}</p>

        <p className="mt-3">
          <strong>Orientation :</strong> {analyse.type_pari}
        </p>

        <p className="mt-1 text-sm text-gray-600">
          Niveau de confiance : {analyse.confiance}/5
        </p>
      </section>

      {analyse.donnees_manquantes.length > 0 && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold">
            Informations manquantes ou à confirmer
          </h3>

          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analyse.donnees_manquantes.map((element, index) => (
              <li key={index}>{element}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Sources</h3>

        {analyse.sources.length > 0 ? (
          <ul className="mt-2 list-disc space-y-2 pl-5">
            {analyse.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                {source.titre || source.url}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            Aucune source vérifiable n&apos;a été conservée pour cette analyse.
          </p>
        )}
      </section>
    </article>
  );
}
