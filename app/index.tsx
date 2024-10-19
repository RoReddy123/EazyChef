import React, { useState, useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { auth } from '../configs/FirebaseConfig'; // Ensure Firebase is properly set up
import { onAuthStateChanged } from 'firebase/auth';
import { User } from 'firebase/auth'; // Import Firebase User type



export default function Index() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if a user is already authenticated
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      if (authenticatedUser) {
        setUser(authenticatedUser); // If the user is authenticated, save the user
      } else {
        setUser(null); // If no user is authenticated, set user to null
      }
      setLoading(false); // Loading is done once we know the auth state
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Show a loading spinner while we check the authentication state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // If user is authenticated, redirect to the home page, otherwise redirect to the signup page
  return user ? <Redirect href="/Dashboard" /> : <Redirect href="/SignUp" />;
}
