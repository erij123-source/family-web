export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  registrationDate?: string;
  active?: boolean;
  password?: string;
  /** Absolute URL of the profile photo persisted server-side (set via
   *  /users/upload-photo on web or mobile). Empty/undefined if none. */
  photo?: string;
}
