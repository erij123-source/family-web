export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  registrationDate?: string;
  active?: boolean;
  password?: string;
}
