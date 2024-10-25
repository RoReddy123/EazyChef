// app/_layout.tsx

import React, { useEffect, useState } from 'react';
import { useFonts } from "expo-font";
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from "expo-router";
import { AuthProvider } from '../components/AuthProvider';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'outfit': require('./../assets/fonts/Outfit-Regular.ttf'),
    'outfit-medium': require('./../assets/fonts/Outfit-Medium.ttf'),
    'outfit-bold': require('./../assets/fonts/Outfit-Bold.ttf'),
  });

  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Perform any initial loading tasks here
        // Currently, no additional tasks are performed
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    async function hideSplash() {
      if (appIsReady && fontsLoaded) {
        // Hide the splash screen once the app is ready
        await SplashScreen.hideAsync();
      }
    }

    hideSplash();
  }, [appIsReady, fontsLoaded]);

  if (!appIsReady || !fontsLoaded) {
    return null; // Keep the splash screen visible
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="LoginScreen" />
        <Stack.Screen name="SignUp" />
        {/* Add other screens as needed */}
      </Stack>
    </AuthProvider>
  );
}
