import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyBFhTHQAMOiRIleNE-vF1OyP2GEHkpK2a4",
  authDomain: "lynx-mobile-7d96b.firebaseapp.com",
  projectId: "lynx-mobile-7d96b",
  storageBucket: "lynx-mobile-7d96b.firebasestorage.app",
  messagingSenderId: "21332565420",
  appId: "1:21332565420:web:ca6d53c235bf249058ae09",
};

export const firebaseApp = initializeApp(firebaseConfig);

export const firebaseStorage = getStorage(firebaseApp);
