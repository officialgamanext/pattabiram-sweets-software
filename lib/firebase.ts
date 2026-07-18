import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjcu09Z-1oxB8lsdeMZo2eTUqX5E1d10M",
  authDomain: "pattabiram-sweets-972d4.firebaseapp.com",
  projectId: "pattabiram-sweets-972d4",
  storageBucket: "pattabiram-sweets-972d4.firebasestorage.app",
  messagingSenderId: "84716058683",
  appId: "1:84716058683:web:be25fbc29ec25b9afa841e",
  measurementId: "G-4SLW0TSZDJ"
};

// Initialize Firebase app if not initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
