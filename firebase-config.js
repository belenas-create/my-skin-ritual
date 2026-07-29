/**
 * Cole aqui a configuração do app Web exibida no Firebase Console.
 * Project settings > General > Your apps > SDK setup and configuration.
 */
export const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(
  value => value && value !== "COLE_AQUI"
);
