/* =====================================================================
   SINCRONIZAÇÃO COM O FIREBASE (login Google + Firestore)
   ---------------------------------------------------------------------
   - Só é ativada se firebase-config.js estiver preenchido.
   - Cada pessoa tem um documento próprio: users/{uid}
     com { profile, history, updatedAt }.
   - Ao entrar, junta os resultados do aparelho com os da nuvem
     (nada é perdido) e mantém os dois iguais a partir daí.
   ===================================================================== */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

const cfg = window.GFLAB_FIREBASE_CONFIG || {};
const configured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

const $ = id => document.getElementById(id);

function setStatus(text) {
  const el = $('cloud-status');
  if (el) el.textContent = text;
}

// Junta dois históricos sem duplicar (a data de cada teste é a chave)
function mergeHistory(a, b) {
  const byDate = new Map();
  [...(a || []), ...(b || [])].forEach(h => { if (h && h.date) byDate.set(h.date, h); });
  const list = [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
  list.forEach((h, i) => { h.attempt = i + 1; });
  return list;
}

// Junta dois perfis: para cada etapa, fica o resultado mais recente
function mergeProfile(a, b) {
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  keys.forEach(k => {
    const x = (a || {})[k], y = (b || {})[k];
    if (!x) out[k] = y;
    else if (!y) out[k] = x;
    else out[k] = (x.date || '') >= (y.date || '') ? x : y;
  });
  return out;
}

async function start() {
  const card = $('cloud-card');
  if (!configured) {
    if (card) card.classList.add('hidden');
    return;
  }
  if (card) card.classList.remove('hidden');

  const { initializeApp } = await import(SDK + 'firebase-app.js');
  const {
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
    getRedirectResult, onAuthStateChanged, signOut
  } = await import(SDK + 'firebase-auth.js');
  const {
    initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, serverTimestamp
  } = await import(SDK + 'firebase-firestore.js');

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  // Cache local: funciona sem internet e sincroniza quando a conexão voltar
  const db = initializeFirestore(app, { localCache: persistentLocalCache() });

  let user = null;
  let pushTimer = null;
  let applyingRemote = false;

  async function push() {
    if (!user || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          profile: window.loadProfile(),
          history: window.loadHistory(),
          updatedAt: serverTimestamp()
        });
        setStatus(`Conectada(o) como ${user.email}. Resultados salvos na nuvem.`);
      } catch (e) {
        setStatus('Não foi possível salvar na nuvem agora. Os resultados continuam salvos no aparelho.');
      }
    }, 400);
  }

  async function pullAndMerge() {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const remote = snap.exists() ? snap.data() : {};
      applyingRemote = true;
      window.saveProfile(mergeProfile(window.loadProfile(), remote.profile));
      window.saveHistory(mergeHistory(window.loadHistory(), remote.history));
      applyingRemote = false;
      await push();
    } catch (e) {
      applyingRemote = false;
      setStatus('Não foi possível ler a nuvem agora. Tente de novo mais tarde.');
    }
  }

  // Expõe para o app avisar quando um resultado novo for salvo
  window.gfCloud = { push };

  const provider = new GoogleAuthProvider();
  $('b-login').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // Em alguns celulares e no app instalado, a janela pop-up é bloqueada
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/cancelled-popup-request')) {
        await signInWithRedirect(auth, provider);
      } else if (e && e.code !== 'auth/popup-closed-by-user') {
        setStatus('Não foi possível entrar. Verifique a conexão e tente de novo.');
      }
    }
  });
  $('b-logout').addEventListener('click', () => signOut(auth));

  getRedirectResult(auth).catch(() => {});

  onAuthStateChanged(auth, async u => {
    user = u;
    $('b-login').classList.toggle('hidden', Boolean(u));
    $('b-logout').classList.toggle('hidden', !u);
    if (u) {
      setStatus('Sincronizando…');
      await pullAndMerge();
    } else {
      setStatus('Entre com sua conta Google para guardar os resultados na nuvem e acessá-los em qualquer aparelho.');
    }
  });
}

start().catch(() => setStatus('Nuvem indisponível no momento. Os resultados continuam salvos no aparelho.'));
