import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Attaches the JWT Bearer token (stored in localStorage by the login flow)
// to every outgoing request targeted at our backend API.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiCall = req.url.startsWith(environment.apiBaseUrl);
  if (!isApiCall) {
    return next(req);
  }

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
