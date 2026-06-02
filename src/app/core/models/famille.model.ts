import { User } from './user.model';

export interface Famille {
  id: number;
  name: string;
  creationDate?: string;
  creator?: Pick<User, 'id'>;
}
