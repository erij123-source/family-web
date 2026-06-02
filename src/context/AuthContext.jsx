import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        // Restaurer le username dans sessionStorage s'il a disparu.
        // sessionStorage est effacé à la fermeture de l'onglet/navigateur,
        // alors que le token persiste dans localStorage : sans cette
        // restauration, PrivateRoute laisse entrer mais les pages qui lisent
        // sessionStorage.getItem('username') (stats budget, etc.) affichent
        // "Non connecté".
        if (parsed?.username && !sessionStorage.getItem('username')) {
          sessionStorage.setItem('username', parsed.username);
        }
      } catch {
        /* user corrompu en storage — on ignore */
      }
    }
  }, []);

  const login = (userData, authToken, refreshToken) => {
  setUser(userData);
  setToken(authToken);
  localStorage.setItem('user', JSON.stringify(userData));
  localStorage.setItem('token', authToken);
  localStorage.setItem('refreshToken', refreshToken); // ← ligne ajoutée
  // Garder sessionStorage aligné sur la source persistante.
  if (userData?.username) sessionStorage.setItem('username', userData.username);
};

  const logout = () => {
  setUser(null);
  setToken(null);
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken'); // ← ligne ajoutée
  sessionStorage.removeItem('username');
};

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);