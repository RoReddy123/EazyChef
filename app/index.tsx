// app/index.tsx

import React, { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { auth } from '../configs/FirebaseConfig'; // Ensure Firebase is properly set up
import { onAuthStateChanged, User } from 'firebase/auth'; // Import Firebase User type
import Splash1 from './../components/Splash/Splash1'; // Import the Splash1 component
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let authTimeout: NodeJS.Timeout;
    let errorTimeout: NodeJS.Timeout;

    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (authenticatedUser) => {
        if (authenticatedUser) {
          setUser(authenticatedUser); // User is authenticated
          console.log('User authenticated:', authenticatedUser.uid);
        } else {
          setUser(null); // No user is authenticated
          console.log('No user authenticated.');
        }

        // Introduce a delay before setting loading to false
        authTimeout = setTimeout(() => {
          setLoading(false);
          console.log('Loading set to false.');
        }, 2750); // 2.75-second delay
      },
      (authError) => {
        console.error('Authentication Error:', authError);
        setError('Failed to authenticate. Please try again.');

        // Introduce a delay before setting loading to false
        errorTimeout = setTimeout(() => {
          setLoading(false);
          console.log('Loading set to false after error.');
        }, 2750); // 2.75-second delay
      }
    );

    // Cleanup subscription and clear timeouts on unmount
    return () => {
      unsubscribe();
      clearTimeout(authTimeout);
      clearTimeout(errorTimeout);
    };
  }, []);

  // Show the Splash1 component while loading
  if (loading) {
    return <Splash1 />;
  }

  // Show an error message if authentication failed
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        {/* Optionally, add a retry button or navigation options */}
      </View>
    );
  }

  // Redirect based on authentication status
  return user ? <Redirect href="/Dashboard" /> : <Redirect href="/SignUp" />;
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff0000',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'outfit-bold',
  },
});
