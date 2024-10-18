import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Button, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../configs/FirebaseConfig'; // Adjust the path if necessary
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithCredential, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { AuthContext } from './../components/AuthProvider'; // Adjust the path if necessary

// Handle the auth session
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Configure Google Sign-In
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;

      // Create a Firebase credential with the Google ID token
      const credential = GoogleAuthProvider.credential(id_token);

      // Sign in with the credential from the Google user
      signInWithCredential(auth, credential)
        .then(() => {
          router.replace('/home');
        })
        .catch(error => {
          Alert.alert('Firebase Sign-In Error', error.message);
        });
    }
  }, [response]);

  const handleSignIn = async () => {
    if (email === '' || password === '') {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Email Sign-In Successful, User ID:', user.uid);
      Alert.alert('Success', 'Signed in successfully!');
      router.replace('/home'); // Navigate to Home after successful sign-in
    } catch (error) {
      console.error('Sign In Error:', error);
      Alert.alert('Sign-In Error', error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (email === '') {
      Alert.alert('Error', 'Please enter your email address to reset your password.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Success', 'Password reset email sent! Please check your inbox.');
    } catch (error) {
      console.error('Password Reset Error:', error);
      Alert.alert('Password Reset Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title="Sign In" onPress={handleSignIn} />

      <Button
        title="Sign In with Google"
        onPress={() => {
          promptAsync();
        }}
        disabled={!request}
      />

      <TouchableOpacity onPress={handleForgotPassword}>
        <Text style={styles.link}>Forgot your password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/sign-up')}>
        <Text style={styles.link}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  link: {
    marginTop: 15,
    color: 'blue',
    textAlign: 'center',
  },
});
