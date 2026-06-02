import { Membre } from './membre.model';
import { Categorie } from './categorie.model';

/** Revenu kind — remplace l'ancienne `RevenuPeriodicite` (MENSUELLE/ANNUELLE/PONCTUELLE).
 *  FIXE     = revenu récurrent (ex : salaire mensuel)
 *  VARIABLE = revenu ponctuel (ex : prime, freelance one-shot) */
export type RevenuKind = 'FIXE' | 'VARIABLE';

/** Shape returned by GET /revenus/compte/{compteId} (RevenuDTO). */
export interface RevenuDTO {
  id: number;
  amount: number;
  kind: RevenuKind;
  perceptionDate: string;
  description?: string;
  membreId: number;
  membrePrenom: string;
  membreNom: string;
  /** UI-only: attached client-side after cross-referencing the categories list. */
  categorieName?: string;
  categorieId?: number;
}

/** Payload for POST /revenus/ajouter and PUT /revenus/edit/{id}. */
export interface RevenuPayload {
  compte: { id: number };
  membre: { id: number };
  categorie?: { id: number } | null;
  amount: number;
  kind: RevenuKind;
  perceptionDate: string;
  description?: string;
}

/** Full Revenu entity (used on POST/PUT responses). */
export interface Revenu {
  id: number;
  amount: number;
  kind: RevenuKind;
  perceptionDate: string;
  description?: string;
  membre?: Pick<Membre, 'id'> & Partial<Membre>;
  categorie?: Pick<Categorie, 'id'> & Partial<Categorie>;
  compte?: { id: number };
}
