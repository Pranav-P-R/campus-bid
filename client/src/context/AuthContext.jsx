import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'campusbid_token';

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken);
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState([]);

  // Fetch current user if token exists
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session expired');
        })
        .then((data) => {
          setUser(data.user);
          setLoading(false);
        })
        .catch((error) => {
          if (error.message === 'Session expired') {
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            setToken('');
            setUser(null);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    // Also fetch demo users for easy testing
    fetch('/api/auth/demo-users')
      .then(async (res) => {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      })
      .then((data) => {
        if (data.users) setDemoUsers(data.users);
      })
      .catch((e) => console.error(e));
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setUser(null);
  };

  const switchUser = async (userId) => {
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        return data.user;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Error switching user:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        demoUsers,
        login,
        logout,
        switchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
