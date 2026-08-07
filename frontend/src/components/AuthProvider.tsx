"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAccount, useDisconnect } from "wagmi";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface AuthState {
  token: string | null;
  userId: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  userId: null,
  isAdmin: false,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { disconnect } = useDisconnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    const stored = localStorage.getItem("user_token");
    if (stored) {
      setToken(stored);
      fetchMe(stored);
    }
  }, []);

  const fetchMe = async (t: string) => {
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        const refreshed = await tryRefresh(t);
        if (!refreshed) clearAuth();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUserId(data.id);
        setIsAdmin(data.isAdmin || false);
      }
    } catch {
      // silent
    }
  };

  const tryRefresh = async (oldToken: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${oldToken}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("user_token", data.token);
        setToken(data.token);
        await fetchMe(data.token);
        return true;
      }
    } catch {
      // silent
    }
    return false;
  };

  const login = useCallback((t: string) => {
    localStorage.setItem("user_token", t);
    setToken(t);
    fetchMe(t);
  }, []);

  const clearAuth = () => {
    localStorage.removeItem("user_token");
    setToken(null);
    setUserId(null);
    setIsAdmin(false);
  };

  const logout = useCallback(() => {
    clearAuth();
    disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (!isConnected && token) {
      clearAuth();
    }
  }, [isConnected]);

  return (
    <AuthContext.Provider
      value={{ token, userId, isAdmin, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
