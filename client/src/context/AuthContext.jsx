import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // sessionStorage is scoped to one browser tab, so separate tabs can use separate accounts.
  const [token, setToken] = useState(sessionStorage.getItem('campusbid_token') || '');
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
        .catch(() => {
          sessionStorage.removeItem('campusbid_token');
          setToken('');
          setUser(null);
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
    sessionStorage.setItem('campusbid_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    sessionStorage.removeItem('campusbid_token');
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
