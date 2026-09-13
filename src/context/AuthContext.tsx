import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  api,
  setActiveUserSession,
  clearActiveUserSession,
  getActiveUserId,
  getActiveUserEmail,
  getCachedUser,
} from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  availableUsers: User[];
  signIn: (email: string) => Promise<void>;
  signUp: (email: string, displayName: string, avatarUrl?: string) => Promise<void>;
  googleLogin: (email: string, displayName?: string, avatarUrl?: string, mode?: 'signin' | 'signup') => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  updateProfile: (displayName?: string, avatarUrl?: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore immediately from local cache so closing and reopening browser never kicks user out!
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [loading, setLoading] = useState<boolean>(() => !getCachedUser());
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  const refreshAuth = async () => {
    try {
      const storedId = getActiveUserId();
      const storedEmail = getActiveUserEmail();
      if (!storedId && !storedEmail) {
        setUser(null);
        clearActiveUserSession();
        setLoading(false);
        return;
      }

      const res = await api.getMe();
      if (res.user) {
        setUser(res.user);
        setActiveUserSession(res.user);
      } else {
        // Server explicitly said no active user found
        setUser(null);
        clearActiveUserSession();
      }
    } catch (err: any) {
      console.warn('Network issue during session check, retaining local login:', err);
      // Only discard session if server explicitly returned 401 or 403 (unauthorized/forbidden)
      if (err?.status === 401 || err?.status === 403) {
        setUser(null);
        clearActiveUserSession();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await api.getUsers();
      setAvailableUsers(res.users);
    } catch {
      // If regular user, may fail or return empty
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      loadAllUsers();
    }
  }, [user]);

  const signIn = async (email: string) => {
    setLoading(true);
    try {
      const res = await api.signIn(email);
      setUser(res.user);
      setActiveUserSession(res.user);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, displayName: string, avatarUrl?: string) => {
    setLoading(true);
    try {
      const res = await api.signUp({ email, display_name: displayName, avatar_url: avatarUrl });
      setUser(res.user);
      setActiveUserSession(res.user);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (email: string, displayName?: string, avatarUrl?: string, mode?: 'signin' | 'signup') => {
    setLoading(true);
    try {
      const res = await api.googleLogin({
        email,
        display_name: displayName,
        avatar_url: avatarUrl,
        mode,
      });
      setUser(res.user);
      setActiveUserSession(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      clearActiveUserSession();
      setUser(null);
    }
  };

  const switchUser = async (userId: string) => {
    setLoading(true);
    try {
      const res = await api.switchUser(userId);
      setUser(res.user);
      setActiveUserSession(res.user);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (displayName?: string, avatarUrl?: string) => {
    if (!user) return;
    const res = await api.updateProfile({ display_name: displayName, avatar_url: avatarUrl });
    setUser(res.user);
    setActiveUserSession(res.user);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        availableUsers,
        signIn,
        signUp,
        googleLogin,
        logout,
        switchUser,
        updateProfile,
        refreshAuth,
        isSuperAdmin,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
