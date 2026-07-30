/**
 * Configuração do app Web exibida no Firebase Console.
 * Project settings > General > Your apps > SDK setup and configuration.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyB2_nr2Dgyrfhy7QN6EN6mSLgY74TtGVgM",
  authDomain: "my-skin-ritual.firebaseapp.com",
  projectId: "my-skin-ritual",
  storageBucket: "my-skin-ritual.firebasestorage.app",
  messagingSenderId: "442101112751",
  appId: "1:442101112751:web:c7d95b56aa0a8dbb40595a"
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(
  value => value && value !== "COLE_AQUI"
);
