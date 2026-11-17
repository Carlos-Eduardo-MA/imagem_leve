'use strict';

/* Frontend sem frameworks: fala com a API por fetch e usa o cookie httpOnly
   para autenticar. Nenhum token é lido ou guardado em JavaScript. */

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const EXTENSIONS = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const FORMAT_LABELS = { jpeg: 'JPEG (.jpg)', png: 'PNG (.png)', webp: 'WebP (.webp)' };

const el = {
  logoutButton: document.getElementById('logout-button'),

  authView: document.getElementById('auth-view'),
  googleButton: document.getElementById('google-button'),
  googleFallback: document.getElementById('google-fallback'),
  authMessage: document.getElementById('auth-message'),
  setupHint: document.getElementById('setup-hint'),
  authForm: document.getElementById('auth-form'),
  authTitle: document.getElementById('auth-title'),
  authSubtitle: document.getElementById('auth-subtitle'),
  authSwitchPrompt: document.getElementById('auth-switch-prompt'),
  authToggle: document.getElementById('auth-toggle'),
  authSubmit: document.getElementById('auth-submit'),
  nameField: document.getElementById('name-field'),
  authName: document.getElementById('auth-name'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  passwordHint: document.getElementById('password-hint'),

  appView: document.getElementById('app-view'),
  greeting: document.getElementById('greeting'),

  uploadForm: document.getElementById('upload-form'),
  fileInput: document.getElementById('file-input'),
  dropzone: document.querySelector('.dropzone'),
  dropzoneTitle: document.getElementById('dropzone-title'),
  uploadMessage: document.getElementById('upload-message'),
  compressButton: document.getElementById('compress-button'),

  resultView: document.getElementById('result-view'),
  newImageButton: document.getElementById('new-image-button'),
  resultPreview: document.getElementById('result-preview'),
  originalSize: document.getElementById('original-size'),
  compressedSize: document.getElementById('compressed-size'),
  savings: document.getElementById('savings'),
  dimensions: document.getElementById('dimensions'),
  formatSelect: document.getElementById('format-select'),
  downloadButton: document.getElementById('download-button'),
  resultMessage: document.getElementById('result-message'),
};

const state = {
  user: null,
  googleClientId: null,
  file: null,
  result: null,
  googleRendered: false,
  authMode: 'login',
};

/* ---------------- Utilidades ---------------- */

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível concluir a ação.');
    error.status = response.status;
    throw error;
  }

  return data;
}

function setMessage(element, text, type = 'error') {
  element.textContent = text || '';
  element.classList.toggle('is-success', type === 'success');
}

function setBusy(button, busy, busyLabel, idleLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resetFileSelection() {
  state.file = null;
  el.fileInput.value = '';
  el.dropzoneTitle.textContent = 'Escolha uma imagem';
  el.compressButton.disabled = true;
  setMessage(el.uploadMessage, '');
}

/* ---------------- Login com Google ---------------- */

function waitForGoogle() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve(true);

    let attempts = 0;
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        resolve(true);
      } else if (++attempts > 60) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

async function renderGoogleButton() {
  if (!state.googleClientId || state.googleRendered) return;

  const loaded = await waitForGoogle();
  if (!loaded) {
    setMessage(
      el.authMessage,
      'Não foi possível carregar o login do Google. Verifique sua conexão e recarregue a página.',
    );
    return;
  }

  window.google.accounts.id.initialize({
    client_id: state.googleClientId,
    callback: handleGoogleCredential,
    auto_select: false,
  });

  el.googleButton.replaceChildren();
  window.google.accounts.id.renderButton(el.googleButton, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    logo_alignment: 'left',
    locale: 'pt-BR',
    width: Math.min(336, Math.floor(el.googleButton.clientWidth)),
  });

  state.googleRendered = true;
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    setMessage(el.authMessage, 'O Google não retornou uma credencial. Tente novamente.');
    return;
  }

  setMessage(el.authMessage, '');
  el.googleButton.style.opacity = '0.6';
  el.googleButton.style.pointerEvents = 'none';

  try {
    const { user } = await api('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });

    state.user = user;
    showApp();
  } catch (error) {
    setMessage(el.authMessage, error.message);
  } finally {
    el.googleButton.style.opacity = '';
    el.googleButton.style.pointerEvents = '';
  }
}

/* ---------------- Navegação entre telas ---------------- */

function showAuth() {
  state.user = null;
  state.result = null;
  el.authForm.reset();
  setAuthMode('login');
  resetFileSelection();
  el.resultView.classList.add('hidden');
  el.uploadForm.classList.remove('hidden');
  el.appView.classList.add('hidden');
  el.authView.classList.remove('hidden');
  el.logoutButton.classList.add('hidden');
  setMessage(el.authMessage, '');

  if (state.googleClientId) {
    el.setupHint.classList.add('hidden');
    renderGoogleButton();
  } else {
    el.setupHint.classList.remove('hidden');
  }
}

function setAuthMode(mode) {
  const isRegister = mode === 'register';
  state.authMode = mode;
  el.authTitle.textContent = isRegister ? 'Crie sua conta' : 'Acesse sua conta';
  el.authSubtitle.textContent = isRegister
    ? 'Cadastre-se para começar a otimizar suas imagens.'
    : 'Entre para continuar no compactador.';
  el.authSwitchPrompt.textContent = isRegister
    ? 'Já tem uma conta?'
    : 'Ainda não tem conta?';
  el.authToggle.textContent = isRegister ? 'Entrar' : 'Criar conta';
  el.nameField.classList.toggle('hidden', !isRegister);
  el.authName.required = isRegister;
  el.authPassword.autocomplete = isRegister ? 'new-password' : 'current-password';
  el.authPassword.minLength = isRegister ? 12 : 1;
  el.passwordHint.classList.toggle('hidden', !isRegister);
  el.authSubmit.textContent = isRegister ? 'Criar conta' : 'Entrar';
  setMessage(el.authMessage, '');
}

function toggleAuthMode() {
  el.authForm.reset();
  setAuthMode(state.authMode === 'login' ? 'register' : 'login');
}

async function handleEmailAuth(event) {
  event.preventDefault();

  if (!el.authForm.reportValidity()) return;

  const isRegister = state.authMode === 'register';
  const path = isRegister ? '/api/auth/register' : '/api/auth/login';
  const body = {
    email: el.authEmail.value.trim(),
    password: el.authPassword.value,
  };

  if (isRegister) body.name = el.authName.value.trim();

  setMessage(el.authMessage, '');
  el.authToggle.disabled = true;
  setBusy(el.authSubmit, true, isRegister ? 'Criando conta…' : 'Entrando…', '');

  try {
    const { user } = await api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    state.user = user;
    showApp();
  } catch (error) {
    setMessage(el.authMessage, error.message);
  } finally {
    el.authToggle.disabled = false;
    setBusy(
      el.authSubmit,
      false,
      isRegister ? 'Criando conta…' : 'Entrando…',
      isRegister ? 'Criar conta' : 'Entrar',
    );
  }
}

function showApp() {
  el.authView.classList.add('hidden');
  el.appView.classList.remove('hidden');
  el.logoutButton.classList.remove('hidden');

  const firstName = (state.user?.name || '').split(' ')[0] || 'bem-vindo';
  el.greeting.textContent = `Olá, ${firstName}`;

  el.resultView.classList.add('hidden');
  el.uploadForm.classList.remove('hidden');
  resetFileSelection();
}

async function handleLogout() {
  el.logoutButton.disabled = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    showAuth();
  } catch (error) {
    const messageElement = el.resultView.classList.contains('hidden')
      ? el.uploadMessage
      : el.resultMessage;
    setMessage(messageElement, error.message);
  } finally {
    el.logoutButton.disabled = false;
  }
}

/* ---------------- Upload e compressão ---------------- */

function selectFile(file) {
  setMessage(el.uploadMessage, '');

  if (!file) {
    resetFileSelection();
    return;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    resetFileSelection();
    setMessage(el.uploadMessage, 'Formato não suportado. Envie JPEG, PNG, WebP ou AVIF.');
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    resetFileSelection();
    setMessage(el.uploadMessage, 'A imagem passa do limite de 15 MB. Envie um arquivo menor.');
    return;
  }

  state.file = file;
  el.dropzoneTitle.textContent = `${file.name} · ${formatBytes(file.size)}`;
  el.compressButton.disabled = false;
}

async function handleUpload(event) {
  event.preventDefault();

  if (!state.file) {
    setMessage(el.uploadMessage, 'Escolha uma imagem para continuar.');
    return;
  }

  setMessage(el.uploadMessage, '');
  setBusy(el.compressButton, true, 'Diminuindo…', 'Diminuir imagem');
  el.compressButton.classList.add('is-busy');

  const formData = new FormData();
  formData.append('image', state.file);

  try {
    const { image } = await api('/api/images/compress', {
      method: 'POST',
      body: formData,
    });

    state.result = image;
    renderResult(image);
  } catch (error) {
    if (error.status === 401) {
      showAuth();
      return;
    }
    setMessage(el.uploadMessage, error.message);
  } finally {
    setBusy(el.compressButton, false, 'Diminuindo…', 'Diminuir imagem');
    el.compressButton.classList.remove('is-busy');
    el.compressButton.disabled = !state.file;
  }
}

function renderResult(image) {
  el.resultPreview.src = image.preview;
  el.originalSize.textContent = formatBytes(image.originalSize);
  el.dimensions.textContent = `${image.width} × ${image.height} px`;

  // Cada opção já mostra o tamanho real do arquivo que será baixado.
  el.formatSelect.replaceChildren();
  for (const [format, size] of Object.entries(image.formats)) {
    const option = document.createElement('option');
    option.value = format;
    option.textContent = `${FORMAT_LABELS[format] || format} · ${formatBytes(size)}`;
    el.formatSelect.append(option);
  }

  el.formatSelect.value = 'jpeg';
  updateResultStats();
  setMessage(el.resultMessage, '');

  el.uploadForm.classList.add('hidden');
  el.resultView.classList.remove('hidden');
  el.resultView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateResultStats() {
  if (!state.result) return;

  const size = state.result.formats?.[el.formatSelect.value] ?? null;
  el.compressedSize.textContent = formatBytes(size);

  if (!size) {
    el.savings.textContent = '—';
    return;
  }

  const percent = Math.round((1 - size / state.result.originalSize) * 100);

  if (percent >= 1) {
    el.savings.textContent = `${percent}% menor`;
  } else if (percent <= -1) {
    el.savings.textContent = `${Math.abs(percent)}% maior`;
  } else {
    el.savings.textContent = 'Tamanho similar';
  }
}

function resetResult() {
  state.result = null;
  el.resultView.classList.add('hidden');
  el.uploadForm.classList.remove('hidden');
  resetFileSelection();
  setMessage(el.resultMessage, '');
}

async function handleDownload() {
  if (!state.result) return;

  const format = el.formatSelect.value;
  setMessage(el.resultMessage, '');
  setBusy(el.downloadButton, true, 'Preparando download…', 'Baixar imagem');

  try {
    const response = await fetch(
      `/api/images/${state.result.id}/download?format=${encodeURIComponent(format)}`,
      { credentials: 'same-origin' },
    );

    if (!response.ok) {
      if (response.status === 401) {
        showAuth();
        return;
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Não foi possível baixar a imagem.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.result.suggestedName}-otimizada.${EXTENSIONS[format] || format}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);

    setMessage(el.resultMessage, 'Download iniciado.', 'success');
  } catch (error) {
    setMessage(el.resultMessage, error.message);
  } finally {
    setBusy(el.downloadButton, false, 'Preparando download…', 'Baixar imagem');
  }
}

/* ---------------- Inicialização ---------------- */

function bindEvents() {
  el.logoutButton.addEventListener('click', handleLogout);
  el.authForm.addEventListener('submit', handleEmailAuth);
  el.authToggle.addEventListener('click', toggleAuthMode);
  el.uploadForm.addEventListener('submit', handleUpload);
  el.fileInput.addEventListener('change', () => selectFile(el.fileInput.files?.[0]));
  el.newImageButton.addEventListener('click', resetResult);
  el.downloadButton.addEventListener('click', handleDownload);
  el.formatSelect.addEventListener('change', updateResultStats);

  el.dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    el.dropzone.classList.add('is-active');
  });
  el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('is-active'));
  el.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    el.dropzone.classList.remove('is-active');
    selectFile(event.dataTransfer?.files?.[0]);
  });
}

async function init() {
  bindEvents();

  const [configResult, meResult] = await Promise.allSettled([
    api('/api/auth/config'),
    api('/api/auth/me'),
  ]);

  if (configResult.status === 'fulfilled') {
    state.googleClientId = configResult.value.googleClientId;
  }

  if (meResult.status === 'fulfilled') {
    state.user = meResult.value.user;
    showApp();
    return;
  }

  showAuth();
}

init();
