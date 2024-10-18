// app/AuthProvider.js

import React, { createContext, useState, useEffect } from 'react';
import { auth } from '../configs/FirebaseConfig'; // Adjust the path if necessary
import { onAuthStateChanged } from 'firebase/auth';

// Create the AuthContext with default values
export const AuthContext = createContext({
  user: null,
  authLoading: true,
});

// Create the AuthProvider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
