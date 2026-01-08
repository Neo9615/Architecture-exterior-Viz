
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAOsq1nTwOlLCmS0JMRklrVUtYaFFIlmkE",
  authDomain: "ozarchviz-8d83a.firebaseapp.com",
  projectId: "ozarchviz-8d83a",
  storageBucket: "ozarchviz-8d83a.firebasestorage.app",
  messagingSenderId: "729115135826",
  appId: "1:729115135826:web:c6dbd91fc6ea031d1d748b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app, "gs://ozarchviz-8d83a.firebasestorage.app");
