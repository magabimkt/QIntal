/* =====================================================================
   LOGIN E SINCRONIZAÇÃO COM O FIREBASE
   ---------------------------------------------------------------------
   - Só é ativado se firebase-config.js estiver preenchido.
   - Login obrigatório: e-mail e senha (com criação de conta e
     recuperação de senha) ou conta Google.
   - Cada pessoa tem um documento próprio: users/{uid}
     com { profile, history, updatedAt }.
   - Ao entrar, junta os resultados do aparelho com os da nuvem
     (nada é perdido). Ao sair, apaga os resultados do aparelho
     (eles continuam guardados na nuvem).
   ===================================================================== */

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

const cfg = window.GFLAB_FIREBASE_CONFIG || {};
const configured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

const $ = id => document.getElementById(id);

function setStatus(text) {
  const el = $('cloud-status');
  if (el) el.textContent = text;
}

function authMsg(text, kind) {
  const el = $('auth-msg');
  if (!text) { el.classList.add('hidden'); return; }
  el.textContent = text;
  el.className = `auth-msg ${kind || 'err'}`;
}

// Mensagens de erro do Firebase em português
function friendlyError(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/invalid-email': 'Esse e-mail não parece válido. Confira se digitou certo.',
    'auth/missing-email': 'Digite seu e-mail.',
    'auth/missing-password': 'Digite sua senha.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail. Toque em "Criar conta".',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Toque em "Entrar" ou recupere a senha.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet. Verifique e tente de novo.',
    'auth/popup-closed-by-user': 'A janela de login foi fechada antes de terminar.',
    'auth/account-exists-with-different-credential': 'Esse e-mail já está cadastrado com outra forma de login. Tente entrar com e-mail e senha.'
  };
  return map[code] || 'Não foi possível concluir. Tente de novo em instantes.';
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
    if (x === undefined) out[k] = y;
    else if (y === undefined) out[k] = x;
    else if (typeof x !== 'object' || typeof y !== 'object') out[k] = x;
    else out[k] = (x.date || '') >= (y.date || '') ? x : y;
  });
  return out;
}

async function start() {
  if (!configured) {
    $('cloud-card').classList.add('hidden');
    return;
  }

  const { initializeApp } = await import(SDK + 'firebase-app.js');
  const {
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
    onAuthStateChanged, signOut, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, sendPasswordResetEmail
  } = await import(SDK + 'firebase-auth.js');
  const {
    initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, serverTimestamp
  } = await import(SDK + 'firebase-firestore.js');

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  auth.languageCode = 'pt-BR';
  // Cache local: funciona sem internet e sincroniza quando a conexão voltar
  const db = initializeFirestore(app, { localCache: persistentLocalCache() });

  let user = null;
  let pushTimer = null;
  let applyingRemote = false;

  async function writeNow() {
    await setDoc(doc(db, 'users', user.uid), {
      profile: window.loadProfile(),
      history: window.loadHistory(),
      updatedAt: serverTimestamp()
    });
  }

  function push() {
    if (!user || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        await writeNow();
        setStatus(`Conectada(o) como ${user.email}. Resultados salvos na nuvem.`);
      } catch (e) {
        setStatus('Não foi possível salvar na nuvem agora. Os resultados continuam no aparelho e serão enviados quando a conexão voltar.');
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
      push();
    } catch (e) {
      applyingRemote = false;
      setStatus('Não foi possível ler a nuvem agora. Tente de novo mais tarde.');
    }
  }

  window.gfCloud = { push };

  /* ---------- Formulário de login ---------- */
  let mode = 'login'; // 'login' | 'signup' | 'reset'

  function setMode(m) {
    mode = m;
    authMsg('');
    const titles = { login: 'Entrar', signup: 'Criar conta', reset: 'Recuperar senha' };
    const buttons = { login: 'Entrar', signup: 'Criar conta', reset: 'Enviar link de recuperação' };
    $('auth-title').textContent = titles[m];
    $('b-auth-main').textContent = buttons[m];
    $('auth-pass-wrap').classList.toggle('hidden', m === 'reset');
    $('auth-pass').setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    $('a-auth-toggle').textContent = m === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar';
    $('a-auth-forgot').classList.toggle('hidden', m !== 'login');
  }

  $('a-auth-toggle').addEventListener('click', e => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); });
  $('a-auth-forgot').addEventListener('click', e => { e.preventDefault(); setMode('reset'); });

  async function submit() {
    const email = $('auth-email').value.trim();
    const pass = $('auth-pass').value;
    const btn = $('b-auth-main');
    btn.disabled = true;
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pass);
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, pass);
      } else {
        await sendPasswordResetEmail(auth, email);
        setMode('login');
        authMsg('Enviamos um link para criar uma nova senha. Confira sua caixa de entrada (e a pasta de spam).', 'ok');
      }
    } catch (e) {
      // Por segurança, a recuperação de senha não revela se o e-mail existe
      if (mode === 'reset' && e && e.code === 'auth/user-not-found') {
        setMode('login');
        authMsg('Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.', 'ok');
      } else {
        authMsg(friendlyError(e), 'err');
      }
    } finally {
      btn.disabled = false;
    }
  }

  $('b-auth-main').addEventListener('click', submit);
  ['auth-email', 'auth-pass'].forEach(id => {
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });

  const provider = new GoogleAuthProvider();
  $('b-auth-google').addEventListener('click', async () => {
    authMsg('');
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // Em alguns celulares e no app instalado, a janela pop-up é bloqueada
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/cancelled-popup-request')) {
        await signInWithRedirect(auth, provider);
      } else {
        authMsg(friendlyError(e), 'err');
      }
    }
  });

  getRedirectResult(auth).catch(e => authMsg(friendlyError(e), 'err'));

  /* ---------- Sair ---------- */
  $('b-logout').addEventListener('click', async () => {
    try { if (user) await writeNow(); } catch (e) { /* segue mesmo assim */ }
    await signOut(auth);
    // Apaga os resultados deste aparelho (continuam guardados na nuvem)
    window.saveProfile({});
    window.saveHistory([]);
  });

  /* ---------- Estado do login ---------- */
  onAuthStateChanged(auth, async u => {
    user = u;
    window.gfUserEmail = u ? u.email : null;
    $('auth-loading').classList.add('hidden');
    if (u) {
      $('cloud-card').classList.remove('hidden');
      setStatus('Sincronizando…');
      if (!$('s-auth').classList.contains('hidden')) window.show('s-home');
      $('auth-pass').value = '';
      await pullAndMerge();
    } else {
      $('cloud-card').classList.add('hidden');
      $('auth-box').classList.remove('hidden');
      setMode('login');
      window.show('s-auth');
    }
  });
}

start().catch(() => {
  // Sem conexão no primeiro acesso: libera o uso local e avisa
  $('auth-loading').innerHTML = '<p class="muted">Sem conexão com a internet. Você pode usar o QIntal agora; seus resultados ficam salvos no aparelho até você entrar na sua conta.</p><button class="btn" id="b-offline">Continuar</button>';
  const b = $('b-offline');
  if (b) b.addEventListener('click', () => window.show('s-home'));
});
