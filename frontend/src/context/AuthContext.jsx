import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, setAuthToken, getAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const userData = await authAPI.getMe();
        setUser(userData);
      } catch (err) {
        setAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    setAuthToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await authAPI.register(name, email, password);
    setAuthToken(data.access_token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
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
