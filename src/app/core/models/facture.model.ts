import { Categorie } from './categorie.model';
import { Membre } from './membre.model';

/** Backend enum (Facture.Statut). */
export type FactureStatut = 'PAYEE' | 'NON_PAYEE' | 'EN_RETARD';

/** Backend enum (Facture.Type). Persisté en BDD — indépendant de la catégorie. */
export type FactureType = 'FIXE' | 'VARIABLE';

/** Full Facture entity shape returned by the backend.
 *  datePaiement = date à laquelle l'argent sort du compte. Renseignée
 *  automatiquement quand la facture passe en PAYEE, ou saisie par
 *  l'utilisateur dans le modal. C'est elle qui décide à quel mois la
 *  facture est imputée pour le reste à vivre. */
export interface Facture {
  id: number;
  title: string;
  amount: number;
  issueDate: string; // ISO yyyy-mm-dd
  dueDate?: string;
  datePaiement?: string;
  statut: FactureStatut;
  /** Type Fixe / Variable — saisi par l'utilisateur, persisté en BDD.
   *  Peut être absent pour les factures créées avant l'ajout du champ. */
  type?: FactureType;
  /** Data URL (Base64) du fichier de facture téléchargé par l'utilisateur. */
  fileUrl?: string;
  /** Nom de fichier original (pour téléchargement et affichage). */
  fileName?: string;
  compte?: { id: number };
  membre?: Pick<Membre, 'id'> & Partial<Membre>;
  categorie?: Pick<Categorie, 'id'> & Partial<Categorie>;
}

/** Payload for POST /factures/add and PUT /factures/edit/{id}.
 *  Le fichier (PDF/image) n'est PAS dans ce payload — il est uploadé en
 *  multipart séparément via PUT /factures/upload/{id}. */
export interface FacturePayload {
  compte: { id: number };
  membre: { id: number };
  categorie?: { id: number } | null;
  title: string;
  amount: number;
  issueDate: string;
  dueDate?: string;
  datePaiement?: string;
  statut: FactureStatut;
  /** Type Fixe / Variable — saisi par l'utilisateur, persisté en BDD. */
  type: FactureType;
}
