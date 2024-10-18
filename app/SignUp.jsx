// app/sign-up.js

import React, { useState, useContext } from 'react';
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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../configs/FirebaseConfig'; // Adjust the path if necessary
import { AuthContext } from './../components/AuthProvider'; // Adjust the path if necessary

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { user } = useContext(AuthContext); // Optional: Access user if needed

  const handleSignUp = async () => {
    if (email === '' || password === '') {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      Alert.alert('Success', 'Account created successfully!');
      router.replace('/home'); // Navigate to Home after successful sign-up
    } catch (error) {
      console.error('Sign Up Error:', error);
      Alert.alert('Sign Up Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      
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
      
      <Button title="Sign Up" onPress={handleSignUp} />
      
      <TouchableOpacity onPress={() => router.replace('/LoginScreen')}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
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
