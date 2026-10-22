// Tests du moteur de contrôle de la page /admin (aucun appel réseau).
import assert from "node:assert/strict";
import test from "node:test";
import { executerControle } from "../src/lib/statut.ts";

test("un contrôle qui réussit vite est opérationnel", async () => {
  const resultat = await executerControle({
    service: "Test",
    description: "Service de test",
    verifier: async () => "Tout va bien",
  });
  assert.equal(resultat.statut, "operationnel");
  assert.equal(resultat.message, "Tout va bien");
});

test("un contrôle qui lève une erreur est en panne, avec son message", async () => {
  const resultat = await executerControle({
    service: "Test",
    description: "Service de test",
    verifier: async () => {
      throw new Error("Clé refusée");
    },
  });
  assert.equal(resultat.statut, "en_panne");
  assert.equal(resultat.message, "Clé refusée");
});
