import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const KEYS = {
  products: 'skinCustomV2',
  devices: 'skinRitualDevicesV1',
  routine: 'skinRoutineV2',
  queue: 'skinCloudQueueV1',
  migrationBackup: 'skinMigrationBackupV3',
  migrationState: 'skinMigrationStateV3'
};

const MIGRATION_VERSION = 3;
const MAX_BATCH_WRITES = 400;
const SAFE_DOC_BYTES = 900_000;

let auth;
let db;
let uid = null;
let ready = false;
let flushing = false;
let unsubscribe = [];

function emitStatus(state, message, extra = {}) {
  window.dispatchEvent(new CustomEvent('skin-cloud-status', {
    detail: { state, message, ...extra }
  }));
}

function emitData(type, value) {
  window.dispatchEvent(new CustomEvent('skin-cloud-data', {
    detail: { type, value }
  }));
}

function emitAuth(user) {
  window.dispatchEvent(new CustomEvent('skin-cloud-auth', {
    detail: user
      ? { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL }
      : null
  }));
}

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cleanFirestoreValue(value) {
  if (Array.isArray(value)) return value.map(cleanFirestoreValue);
  if (!value || typeof value !== 'object') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();

  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    if (key !== 'updatedAt') result[key] = cleanFirestoreValue(item);
  });
  return result;
}

function userDoc(...parts) {
  return doc(db, 'users', uid, ...parts);
}

function userCollection(name) {
  return collection(db, 'users', uid, name);
}

function queueOperation(operation) {
  const queue = readJSON(KEYS.queue, []);
  const key = `${operation.entity}:${operation.id || 'singleton'}`;
  const filtered = queue.filter(item => `${item.entity}:${item.id || 'singleton'}` !== key);
  filtered.push({ ...operation, queuedAt: new Date().toISOString() });
  writeJSON(KEYS.queue, filtered);
  emitStatus('pending', `${filtered.length} alteração(ões) aguardando conexão`, { pending: filtered.length });
}

async function executeOperation(operation) {
  if (operation.entity === 'product') {
    if (operation.action === 'delete') return deleteDoc(userDoc('products', operation.id));
    return setDoc(userDoc('products', operation.id), {
      ...operation.value,
      clientUpdatedAt: operation.clientUpdatedAt,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  if (operation.entity === 'device') {
    if (operation.action === 'delete') return deleteDoc(userDoc('devices', operation.id));
    return setDoc(userDoc('devices', operation.id), {
      ...operation.value,
      clientUpdatedAt: operation.clientUpdatedAt,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  if (operation.entity === 'routine') {
    return setDoc(userDoc('settings', 'routine'), {
      value: operation.value,
      clientUpdatedAt: operation.clientUpdatedAt,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function sendOrQueue(operation) {
  const completeOperation = {
    ...operation,
    clientUpdatedAt: new Date().toISOString()
  };

  if (!ready || !navigator.onLine) {
    queueOperation(completeOperation);
    return { queued: true };
  }

  try {
    emitStatus('syncing', 'Salvando alterações…');
    await executeOperation(completeOperation);
    emitStatus('online', 'Sincronizado na nuvem');
    return { queued: false };
  } catch (error) {
    console.error('Cloud write failed; queued locally:', error);
    queueOperation(completeOperation);
    return { queued: true, error };
  }
}

export async function flushCloudQueue() {
  if (!ready || !navigator.onLine || flushing) return;

  const queue = readJSON(KEYS.queue, []);
  if (!queue.length) {
    emitStatus('online', 'Sincronizado na nuvem');
    return;
  }

  flushing = true;
  emitStatus('syncing', `Enviando ${queue.length} alteração(ões)…`);
  const remaining = [];

  for (const operation of queue) {
    try {
      await executeOperation(operation);
    } catch (error) {
      console.error('Queued operation failed:', operation, error);
      remaining.push(operation);
    }
  }

  writeJSON(KEYS.queue, remaining);
  flushing = false;

  if (remaining.length) {
    emitStatus('pending', `${remaining.length} alteração(ões) ainda pendente(s)`, { pending: remaining.length });
  } else {
    emitStatus('online', 'Tudo sincronizado');
  }
}

function ensureIds(items, prefix) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(Boolean).map((item, index) => {
    let id = String(item.id || `${prefix}-${Date.now()}-${index}`);
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return { ...item, id };
  });
}

function valueTime(value) {
  const raw = value?.clientUpdatedAt || value?.updatedAt || value?.modifiedAt || '';
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function shouldUseLocal(localValue, remoteValue) {
  if (!remoteValue) return true;
  const localTime = valueTime(localValue);
  const remoteTime = valueTime(remoteValue);
  if (!localTime && !remoteTime) return false; // existing cloud data wins on first migration
  return localTime > remoteTime;
}

function byteSize(value) {
  return new Blob([JSON.stringify(value)]).size;
}

async function commitInBatches(operations) {
  for (let start = 0; start < operations.length; start += MAX_BATCH_WRITES) {
    const chunk = operations.slice(start, start + MAX_BATCH_WRITES);
    const batch = writeBatch(db);
    chunk.forEach(operation => batch.set(operation.ref, operation.data, { merge: true }));
    await batch.commit();
  }
}

/**
 * Migração segura e idempotente de localStorage para Firestore.
 * - cria backup local antes de qualquer escrita;
 * - não apaga o localStorage;
 * - não substitui dados de nuvem mais novos;
 * - registra versão, contagens e itens ignorados;
 * - pode ser executada novamente sem duplicar documentos.
 */
async function migrateLocalDataOnce() {
  const metaRef = userDoc('settings', 'migration');
  const metaSnap = await getDoc(metaRef);
  const meta = metaSnap.exists() ? metaSnap.data() : {};
  if (Number(meta.version || 0) >= MIGRATION_VERSION && meta.status === 'complete') return meta;

  const localProducts = ensureIds(readJSON(KEYS.products, []), 'migrated-product');
  const localDevices = ensureIds(readJSON(KEYS.devices, []), 'migrated-device');
  const localRoutine = readJSON(KEYS.routine, {});
  const startedAt = new Date().toISOString();

  writeJSON(KEYS.migrationBackup, {
    version: MIGRATION_VERSION,
    createdAt: startedAt,
    products: localProducts,
    devices: localDevices,
    routine: localRoutine
  });
  writeJSON(KEYS.migrationState, { status: 'running', version: MIGRATION_VERSION, startedAt });

  emitStatus('syncing', 'Migrando dados deste aparelho para a nuvem…', { migration: true });

  const [remoteProductsSnap, remoteDevicesSnap, remoteRoutineSnap] = await Promise.all([
    getDocs(userCollection('products')),
    getDocs(userCollection('devices')),
    getDoc(userDoc('settings', 'routine'))
  ]);

  const remoteProducts = new Map(remoteProductsSnap.docs.map(item => [item.id, cleanFirestoreValue(item.data())]));
  const remoteDevices = new Map(remoteDevicesSnap.docs.map(item => [item.id, cleanFirestoreValue(item.data())]));
  const operations = [];
  const skipped = [];

  localProducts.forEach(item => {
    if (!shouldUseLocal(item, remoteProducts.get(item.id))) return;
    const data = { ...item, clientUpdatedAt: item.clientUpdatedAt || startedAt, migratedFrom: KEYS.products, migrationVersion: MIGRATION_VERSION, updatedAt: serverTimestamp() };
    if (byteSize(data) > SAFE_DOC_BYTES) {
      skipped.push({ type: 'product', id: item.id, reason: 'document-too-large' });
      return;
    }
    operations.push({ ref: userDoc('products', item.id), data });
  });

  localDevices.forEach(item => {
    if (!shouldUseLocal(item, remoteDevices.get(item.id))) return;
    const data = { ...item, clientUpdatedAt: item.clientUpdatedAt || startedAt, migratedFrom: KEYS.devices, migrationVersion: MIGRATION_VERSION, updatedAt: serverTimestamp() };
    if (byteSize(data) > SAFE_DOC_BYTES) {
      skipped.push({ type: 'device', id: item.id, reason: 'document-too-large' });
      return;
    }
    operations.push({ ref: userDoc('devices', item.id), data });
  });

  const remoteRoutine = remoteRoutineSnap.exists() ? cleanFirestoreValue(remoteRoutineSnap.data()) : null;
  const localHasRoutine = localRoutine && typeof localRoutine === 'object' && Object.keys(localRoutine).length > 0;
  if (localHasRoutine && shouldUseLocal({ ...localRoutine, clientUpdatedAt: startedAt }, remoteRoutine)) {
    operations.push({
      ref: userDoc('settings', 'routine'),
      data: {
        value: localRoutine,
        clientUpdatedAt: startedAt,
        migratedFrom: KEYS.routine,
        migrationVersion: MIGRATION_VERSION,
        updatedAt: serverTimestamp()
      }
    });
  }

  await commitInBatches(operations);

  const result = {
    version: MIGRATION_VERSION,
    status: skipped.length ? 'complete-with-warnings' : 'complete',
    localStorageV2Complete: true,
    migratedAt: serverTimestamp(),
    counts: {
      localProducts: localProducts.length,
      localDevices: localDevices.length,
      writes: operations.length,
      skipped: skipped.length
    },
    skipped
  };

  await setDoc(metaRef, result, { merge: true });
  writeJSON(KEYS.migrationState, {
    ...result,
    migratedAt: new Date().toISOString()
  });

  if (skipped.length) {
    emitStatus('pending', `Migração concluída com ${skipped.length} item(ns) mantido(s) apenas neste aparelho`, { migration: true, skipped });
  } else {
    emitStatus('online', 'Dados locais migrados para o Firestore', { migration: true });
  }
  return result;
}

async function hydrateLocalStorage() {
  const [productsSnap, devicesSnap, routineSnap] = await Promise.all([
    getDocs(userCollection('products')),
    getDocs(userCollection('devices')),
    getDoc(userDoc('settings', 'routine'))
  ]);

  // Após a migração, a nuvem passa a ser a fonte principal. O localStorage continua como cache offline.
  writeJSON(KEYS.products, productsSnap.docs.map(item => cleanFirestoreValue({ id: item.id, ...item.data() })));
  writeJSON(KEYS.devices, devicesSnap.docs.map(item => cleanFirestoreValue({ id: item.id, ...item.data() })));
  if (routineSnap.exists()) {
    writeJSON(KEYS.routine, cleanFirestoreValue(routineSnap.data().value || {}));
  }
}

function startRealtimeListeners() {
  unsubscribe.forEach(stop => stop());
  unsubscribe = [];

  unsubscribe.push(onSnapshot(userCollection('products'), snapshot => {
    const products = snapshot.docs.map(item => cleanFirestoreValue({ id: item.id, ...item.data() }));
    writeJSON(KEYS.products, products);
    emitData('products', products);
  }, error => {
    console.error('Products listener error:', error);
    emitStatus('error', 'Não foi possível atualizar os produtos em tempo real');
  }));

  unsubscribe.push(onSnapshot(userCollection('devices'), snapshot => {
    const devices = snapshot.docs.map(item => cleanFirestoreValue({ id: item.id, ...item.data() }));
    writeJSON(KEYS.devices, devices);
    emitData('devices', devices);
  }, error => {
    console.error('Devices listener error:', error);
    emitStatus('error', 'Não foi possível atualizar os dispositivos em tempo real');
  }));

  unsubscribe.push(onSnapshot(userDoc('settings', 'routine'), snapshot => {
    if (!snapshot.exists()) return;
    const routine = cleanFirestoreValue(snapshot.data().value || {});
    writeJSON(KEYS.routine, routine);
    emitData('routine', routine);
  }, error => {
    console.error('Routine listener error:', error);
    emitStatus('error', 'Não foi possível atualizar a rotina em tempo real');
  }));
}

function bindConnectionEvents() {
  window.addEventListener('online', () => {
    emitStatus('syncing', 'Conexão restaurada. Sincronizando…');
    flushCloudQueue().catch(console.error);
  });

  window.addEventListener('offline', () => {
    const pending = readJSON(KEYS.queue, []).length;
    emitStatus('offline', pending
      ? `Sem internet — ${pending} alteração(ões) salva(s) neste aparelho`
      : 'Sem internet — modo local ativo', { pending });
  });
}

async function handleSignedIn(user) {
  uid = user.uid;
  try {
    emitStatus('syncing', 'Conectando à sua conta…');
    const migration = await migrateLocalDataOnce();
    await hydrateLocalStorage();
    ready = true;
    startRealtimeListeners();
    await flushCloudQueue();
    emitStatus('online', 'Sincronizado na nuvem');
    return migration;
  } catch (error) {
    console.error('Firebase sync error:', error);
    writeJSON(KEYS.migrationState, {
      status: 'error',
      version: MIGRATION_VERSION,
      message: error?.message || String(error),
      failedAt: new Date().toISOString()
    });
    emitStatus('error', 'Falha na nuvem — dados mantidos neste aparelho');
  }
}

function handleSignedOut() {
  unsubscribe.forEach(stop => stop());
  unsubscribe = [];
  ready = false;
  uid = null;
  emitStatus('local', 'Modo local — entre com sua conta Google para sincronizar entre aparelhos');
}

export async function initializeCloudSync() {
  bindConnectionEvents();

  if (!hasFirebaseConfig) {
    emitStatus('local', 'Modo local — falta inserir a configuração do Firebase');
    emitAuth(null);
    return { enabled: false };
  }

  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, user => {
      emitAuth(user);
      if (user) {
        handleSignedIn(user);
      } else {
        handleSignedOut();
      }
    });

    return { enabled: true };
  } catch (error) {
    console.error('Firebase init error:', error);
    emitStatus('error', 'Falha ao iniciar o Firebase');
    emitAuth(null);
    return { enabled: false, error };
  }
}

export async function signInWithGoogleAccount() {
  if (!auth) throw new Error('Firebase não inicializado');
  emitStatus('syncing', 'Entrando com o Google…');
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Google sign-in failed:', error);
    emitStatus('error', 'Não foi possível entrar com o Google');
    throw error;
  }
}

export async function signOutOfCloud() {
  if (!auth) return;
  await signOut(auth);
}

export function stopCloudSync() {
  unsubscribe.forEach(stop => stop());
  unsubscribe = [];
  ready = false;
}

export function getCloudSyncState() {
  return {
    enabled: ready,
    uid,
    online: navigator.onLine,
    pending: readJSON(KEYS.queue, []).length,
    migration: readJSON(KEYS.migrationState, null)
  };
}

export function saveCloudProduct(item) {
  return sendOrQueue({ entity: 'product', action: 'set', id: item.id, value: item });
}

export function deleteCloudProduct(id) {
  return sendOrQueue({ entity: 'product', action: 'delete', id });
}

export function saveCloudDevice(item) {
  return sendOrQueue({ entity: 'device', action: 'set', id: item.id, value: item });
}

export function deleteCloudDevice(id) {
  return sendOrQueue({ entity: 'device', action: 'delete', id });
}

export function saveCloudRoutine(value) {
  return sendOrQueue({ entity: 'routine', action: 'set', value });
}
