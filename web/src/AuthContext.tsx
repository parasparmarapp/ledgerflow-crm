import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clearSession, notifySessionChanged, SESSION_CHANGED_EVENT } from './lib/session';

export interface UserAccount {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'staff' | string;
  isActive: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: UserAccount | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserAccount) => void;
  logout: () => void;
  updateUser: (updatedFields: Partial<UserAccount>) => void;
  switchRoleQuick: (role: 'admin' | 'staff') => Promise<void>;
  isRoleSwitching: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  switchRoleQuick: async () => {},
  isRoleSwitching: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<UserAccount | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isRoleSwitching, setIsRoleSwitching] = useState(false);

  const login = useCallback((newToken: string, newUser: UserAccount) => {
    try {
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
    } catch (e) {
      console.error('[AuthContext] Failed to persist session', e);
    }
    setToken(newToken);
    setUser(newUser);
    notifySessionChanged();
  }, []);

  const logout = useCallback(() => {
    clearSession();
    try {
      localStorage.removeItem('user');
    } catch {}
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedFields: Partial<UserAccount>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      try {
        localStorage.setItem('user', JSON.stringify(updated));
      } catch (e) {
        console.error('[AuthContext] Failed to persist user update', e);
      }
      return updated;
    });
    notifySessionChanged();
  }, []);

  // Quick switch between Admin and Staff for testing different panels and roles
  const switchRoleQuick = useCallback(async (targetRole: 'admin' | 'staff') => {
    setIsRoleSwitching(true);
    try {
      const activeSlug = user?.companySlug || 'brand-it';
      const domain = activeSlug === 'stoic' ? 'stoic.com' : 'brand-it.com';
      const email = targetRole === 'admin' 
        ? `admin@${domain}` 
        : `staff@${domain}`;
      const password = targetRole === 'admin' ? 'Admin!2026' : 'Staff!2026';

      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, companySlug: activeSlug }),
      });

      if (!res.ok) {
        throw new Error('Quick role switch failed');
      }

      const data = await res.json();
      if (data?.token && data?.user) {
        login(data.token, data.user);
      }
    } catch (err) {
      console.error('[AuthContext] Error switching role:', err);
    } finally {
      setIsRoleSwitching(false);
    }
  }, [login, user?.companySlug]);

  useEffect(() => {
    const handleSessionChange = () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user');
        setToken(storedToken);
        setUser(storedUser ? JSON.parse(storedUser) : null);
      } catch {
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener(SESSION_CHANGED_EVENT, handleSessionChange);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, handleSessionChange);
  }, []);

  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        login,
        logout,
        updateUser,
        switchRoleQuick,
        isRoleSwitching,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
