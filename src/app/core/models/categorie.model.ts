export type CategorieType = 'REVENU' | 'CHARGE' | 'FACTURE';

export interface Categorie {
  id: number;
  name: string;
  type: CategorieType;
  isDefault?: boolean;
}
