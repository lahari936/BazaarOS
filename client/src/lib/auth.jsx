import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: !!localStorage.getItem('bz_token'), user: null, business: null });

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('bz_token')) return setState({ loading: false, user: null, business: null });
    try {
      const { data } = await api.get('/auth/me');
      setState({ loading: false, ...data });
    } catch {
      localStorage.removeItem('bz_token');
      setState({ loading: false, user: null, business: null });
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const signIn = (data) => {
    localStorage.setItem('bz_token', data.token);
    setState({ loading: false, user: data.user, business: data.business });
  };
  const signOut = () => {
    localStorage.removeItem('bz_token');
    setState({ loading: false, user: null, business: null });
  };
  const setBusiness = (business) => setState((s) => ({ ...s, business }));
  return <Ctx.Provider value={{ ...state, signIn, signOut, setBusiness, refresh }}>{children}</Ctx.Provider>;
}
