import { Membre } from './membre.model';
import { Categorie } from './categorie.model';

export type ChargeType = 'FIXE' | 'VARIABLE';

// Backend entity shape. Note: the Java field is `budget_limit` but its JavaBean
// getter is `getCeiling`, so Jackson exposes it as `ceiling` in JSON.
//
// chargeDate = mois auquel la charge est rattachée (affichage/tri).
// paymentDate = date à laquelle l'argent sort du compte — c'est elle qui
// décide à quel mois la charge est imputée pour le reste à vivre.
export interface Charge {
  id: number;
  type: ChargeType;
  amount: number;
  ceiling?: number;
  chargeDate: string;
  paymentDate?: string;
  description?: string;
  membre?: Pick<Membre, 'id'> & Partial<Membre>;
  categorie?: Pick<Categorie, 'id'> & Partial<Categorie>;
  compte?: { id: number };
}

// Payload for POST /charges/add and PUT /charges/edit/{id}.
export interface ChargePayload {
  compte: { id: number };
  membre: { id: number };
  categorie?: { id: number } | null;
  type: ChargeType;
  amount: number;
  ceiling?: number;
  chargeDate: string;
  paymentDate?: string;
  description?: string;
}
