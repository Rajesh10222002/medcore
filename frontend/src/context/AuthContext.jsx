/*
  AuthContext — Global auth state manager
  
  WHY: React components need to know who is logged in.
  Without this, every component would need to read
  localStorage separately. Context shares state globally.
  
  HOW IT WORKS:
  - AuthProvider wraps the whole app
  - Any component can call useAuth() to get user info
  - login() saves user to state + localStorage
  - logout() clears everything
*/

import { createContext, useContext, useState, useEffect } from "react";

// Create the context object
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  // loading = true while we check localStorage on page refresh

  useEffect(() => {
    // On every page refresh — restore session from localStorage
    const token    = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setUser(JSON.parse(userData));
      // JSON.parse converts string back to object
    }
    setLoading(false);
    // Done checking — set loading false so app renders
  }, []); // [] = run only once when app first loads

  const login = (userData, token) => {
    // Save to localStorage (survives page refresh)
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    // JSON.stringify converts object to string for storage
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
      {/* children = everything wrapped inside <AuthProvider> */}
    </AuthContext.Provider>
  );
}

// Custom hook — makes using context easier
// Instead of: const { user } = useContext(AuthContext)
// Just write:  const { user } = useAuth()
export function useAuth() {
  return useContext(AuthContext);
}