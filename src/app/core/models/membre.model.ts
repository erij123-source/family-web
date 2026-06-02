import { User } from './user.model';
import { Famille } from './famille.model';

export type MembreRole = 'ADMINISTRATEUR' | 'GESTIONNAIRE' | 'CONSULTANT';

export interface Membre {
  id: number;
  user: Pick<User, 'id'> & Partial<User>;
  famille: Pick<Famille, 'id'> & Partial<Famille>;
  role: MembreRole;
  active?: boolean;
  budget?: number;
  remainingBudget?: number;
  carryoverBudget?: number;
}
