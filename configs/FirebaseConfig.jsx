// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCGdrTocA5X4ma0hghD4AH53XIR37QTfHA",
  authDomain: "eazychef-equovi.firebaseapp.com",
  projectId: "eazychef-equovi",
  storageBucket: "eazychef-equovi.appspot.com",
  messagingSenderId: "949681909228",
  appId: "1:949681909228:web:cbab34821aad21a4e264c9",
  measurementId: "G-HQM3RVZ1P4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };