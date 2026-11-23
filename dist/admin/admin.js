const $ = selector => document.querySelector(selector);
const stateFilter = $('#state-filter');
const search = $('#filter');
const dashboard = $('#dashboard');
const login = $('#login');
const createDialog = $('#create');
const detailDialog = $('#details');
const confirmation = $('#confirmation');

let rows = [];
let audit = [];
let activeLicenseId;
let historyRequest = 0;
let activeView = 'licenses';
let authenticated = false;
let hasLoaded = false;
let batch = null;
let pendingRefresh;
let sessionVersion = 0;
let confirmOperation;
let signingOut = false;

if (location.pathname === '/admin') {
  history.replaceState(history.state, '', '/admin/' + location.search + location.hash);
}

function feedback(selector, message = '', tone = 'info') {
  const target = $(selector);
  target.textContent = message;
  target.dataset.tone = tone;
  target.hidden = !message;
}

class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(action, data = {}) {
  let response;
  try {
    response = await fetch('/api/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, ...data })
    });
  } catch {
    throw new RequestError('Could not reach the license service. Check your connection and try again.', 0);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new RequestError('The license service returned an unexpected response. Try again shortly.', response.status);
  }

  if (!response.ok || !body?.ok) {
    const message = body?.message === 'Admin requests require the site origin.'
      ? 'Sign-in is available at aqxmenu.vercel.app/admin/. Open that page and try again.'
      : body?.message || 'The request failed. Try again shortly.';
    throw new RequestError(message, response.status);
  }
  return body;
}

function showSignIn(message = '', tone = 'info', focus = false) {
  authenticated = false;
  hasLoaded = false;
  sessionVersion += 1;
  dashboard.hidden = true;
  $('#admin-nav').hidden = true;
  $('#logout').hidden = true;
  [confirmation, detailDialog, createDialog].forEach(dialog => {
    if (dialog.open) dialog.close();
  });
  rows = [];
  audit = [];
  $('#licenses').replaceChildren();
  $('#audit').replaceChildren();
  $('#detail-fields').replaceChildren();
  $('#detail-title').textContent = '';
  $('#detail-status').textContent = '';
  $('#confirm-text').textContent = '';
  confirmOperation = undefined;
  activeLicenseId = undefined;
  clearHistory();
  $('#key-output').value = '';
  $('#password').value = '';
  $('#session-check').hidden = true;
  login.hidden = false;
  feedback('#login-message', message, tone);
  if (focus) $('#email').focus();
}

function showWorkspace() {
  authenticated = true;
  $('#session-check').hidden = true;
  login.hidden = true;
  dashboard.hidden = false;
  $('#admin-nav').hidden = false;
  $('#logout').hidden = false;
  feedback('#login-message');
  if (batch && !$('#key-output').value) renderBatch();
}

function formatTime(value, showSeconds = false) {
  if (!value) return '—';
  return new Date(value).toISOString().slice(0, showSeconds ? 19 : 16).replace('T', ' ');
}

function state(license) {
  if (license.revoked) return 'Revoked';
  if (license.expires_at && Date.parse(license.expires_at) <= Date.now()) return 'Expired';
  if (!license.activated_at) return 'Unused';
  return license.device_hash ? 'Active' : 'Awaiting new device';
}

function duration(license) {
  if (license.duration_days === 0) return 'Permanent';
  return license.duration_days === 1 ? '1 day' : license.duration_days + ' days';
}

function expiry(license) {
  if (license.duration_days === 0) return 'Never';
  return license.expires_at ? formatTime(license.expires_at) : 'On activation';
}

function licenseLabel(license) {
  return license.label || 'Unlabelled';
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function setBadge(node, licenseState) {
  node.dataset.state = licenseState;
  node.textContent = licenseState;
}

function renderLicenses() {
  const query = search.value.trim().toLowerCase();
  const selectedState = stateFilter.value;
  const records = rows.map(license => ({ license, state: state(license) }));
  const matches = records.filter(({ license, state }) =>
    (!selectedState || state === selectedState) &&
    [licenseLabel(license), license.id, state].join(' ').toLowerCase().includes(query)
  );
  const buttons = matches.map(({ license, state }) => {
    const item = element('li', 'record-item');
    const button = element('button', 'record');
    const badge = element('span', 'badge');
    const chevron = element('span', 'record-chevron');
    button.type = 'button';
    button.dataset.id = license.id;
    button.setAttribute('aria-haspopup', 'dialog');
    chevron.setAttribute('aria-hidden', 'true');
    setBadge(badge, state);
    const expiryLabel = element('span', 'sr-only', 'Expires (UTC) ');
    const expiration = element('span', 'record-meta record-expiry');
    expiration.append(expiryLabel, expiry(license));
    button.append(element('span', 'record-label', licenseLabel(license)), badge,
      element('span', 'record-meta record-duration', duration(license)), expiration, chevron);
    item.append(button);
    return item;
  });
  $('#licenses').replaceChildren(...buttons);
  const noun = rows.length === 1 ? ' license' : ' licenses';
  $('#totals').textContent = rows.length + noun + (rows.length === 1000 ? ' loaded' : '') + ' · ' +
    records.filter(record => record.state === 'Unused').length + ' unused · ' +
    records.filter(record => record.state === 'Active').length + ' active';
  const filtered = Boolean(query || selectedState);
  $('#list-empty').hidden = matches.length > 0;
  $('#clear-filters').hidden = !filtered;
  $('#empty-message').textContent = filtered
    ? 'No licenses match your search and filters.'
    : 'No licenses yet. Generate a batch to get started.';
  $('#results-count').textContent = filtered
    ? 'Showing ' + matches.length + ' of ' + rows.length + (rows.length === 1000 ? ' loaded licenses' : '')
    : '';
}

const auditLabels = {
  create: 'Keys generated',
  activate: 'License activated',
  revoke: 'License revoked',
  restore: 'License restored',
  reset_device: 'Device binding reset'
};

function renderAudit() {
  const byId = new Map(rows.map(license => [license.id, license]));
  const events = audit.map(event => {
    const item = element('li', 'audit-item');
    const timestamp = element('time', '', formatTime(event.created_at));
    const license = byId.get(event.license_id);
    const reference = element('div', 'audit-license');
    timestamp.dateTime = event.created_at;
    if (license) {
      const link = element('button', 'audit-link', licenseLabel(license));
      link.type = 'button';
      link.dataset.id = license.id;
      link.setAttribute('aria-haspopup', 'dialog');
      reference.append(link);
    } else {
      reference.textContent = event.license_id || 'Batch';
    }
    item.append(element('span', 'audit-event', auditLabels[event.action] || event.action), reference, timestamp);
    return item;
  });
  $('#audit').replaceChildren(...events);
  $('#audit').hidden = !events.length;
  $('#audit-empty').hidden = Boolean(events.length);
}

function showView(view, focus = false) {
  activeView = view;
  $('#licenses-view').hidden = view !== 'licenses';
  $('#activity-view').hidden = view !== 'activity';
  document.querySelectorAll('[data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (focus) $('#' + view + '-title').focus();
}

function handleSessionError(error) {
  if (error.status !== 401) return false;
  showSignIn('Your session expired. Sign in again to continue.', 'error', true);
  return true;
}

function setRefreshing(refreshing) {
  dashboard.setAttribute('aria-busy', String(refreshing));
  document.querySelectorAll('[data-refresh]').forEach(button => {
    button.disabled = refreshing;
    button.textContent = refreshing ? 'Refreshing…' : 'Refresh';
  });
}

async function loadWorkspace(version, justSignedIn) {
  try {
    const data = await api('list');
    if (version !== sessionVersion || signingOut) return false;
    rows = data.licenses;
    audit = data.audit;
    hasLoaded = true;
    renderLicenses();
    renderAudit();
    showWorkspace();
    feedback('#dashboard-message');
    if (justSignedIn) {
      showView(activeView, true);
      if (batch) createDialog.showModal();
    }
    return true;
  } catch (error) {
    if (version !== sessionVersion || signingOut) return false;
    if (error.status === 401) {
      const message = justSignedIn
        ? 'Sign-in was accepted, but this browser did not keep the session. Allow cookies for this site and try again.'
        : authenticated ? 'Your session expired. Sign in again to continue.' : '';
      showSignIn(message, 'error', justSignedIn || authenticated);
    } else if (hasLoaded) {
      feedback('#dashboard-message', 'Could not refresh. Showing the last loaded license data. ' + error.message, 'error');
    } else {
      showSignIn(error.message, 'error', justSignedIn);
    }
    return false;
  }
}

function refresh(justSignedIn = false) {
  if (pendingRefresh) return pendingRefresh;
  setRefreshing(true);
  pendingRefresh = loadWorkspace(sessionVersion, justSignedIn).finally(() => {
    pendingRefresh = undefined;
    setRefreshing(false);
  });
  return pendingRefresh;
}

async function refreshAfterChange() {
  if (pendingRefresh) await pendingRefresh;
  if (!authenticated) return false;
  return refresh();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#sign-in');
  button.disabled = true;
  button.textContent = 'Signing in…';
  feedback('#login-message');
  try {
    await api('login', { email: $('#email').value, password: $('#password').value });
    $('#password').value = '';
    await refresh(true);
  } catch (error) {
    feedback('#login-message', error.message, 'error');
    if (error.status === 401) {
      $('#password').select();
      $('#password').focus();
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});

async function signOut() {
  signingOut = true;
  sessionVersion += 1;
  try {
    await api('logout');
    clearBatch();
    search.value = '';
    stateFilter.value = '';
    $('#create-form').reset();
    $('#login-form').reset();
    showView('licenses');
    feedback('#dashboard-message');
    showSignIn('You’re signed out.', 'info', true);
  } finally {
    signingOut = false;
  }
}

$('#logout').addEventListener('click', async event => {
  const button = event.currentTarget;
  if (batch && !batch.exported) {
    askConfirmation('Sign out and clear keys?', 'This batch has not been copied or downloaded. Signing out clears the displayed keys.', 'Sign out', signOut, true);
    return;
  }
  button.disabled = true;
  try {
    await signOut();
  } catch (error) {
    feedback('#dashboard-message', error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.view, true));
});
document.querySelectorAll('[data-refresh]').forEach(button => {
  button.addEventListener('click', () => refresh());
});
search.addEventListener('input', renderLicenses);
stateFilter.addEventListener('change', renderLicenses);
$('#clear-filters').addEventListener('click', () => {
  search.value = '';
  stateFilter.value = '';
  renderLicenses();
  search.focus();
});

function renderDetails(license) {
  $('#detail-title').textContent = licenseLabel(license);
  setBadge($('#detail-status'), state(license));
  const values = [
    ['License ID', license.id],
    ['Duration', duration(license)],
    ['Created (UTC)', formatTime(license.created_at)],
    ['Activated (UTC)', formatTime(license.activated_at)],
    ['Expires (UTC)', expiry(license)],
    ['Device binding', license.device_hash ? 'Bound · ' + license.device_hash.slice(0, 8) : 'Not bound'],
    ['Latest launcher check (UTC)', formatTime(license.last_seen_at, true)],
    ['Previous launcher check (UTC)', formatTime(license.previous_seen_at, true)],
    ['Checks recorded since tracking began', String(license.successful_checks ?? 0)],
    ['Device resets', String(license.reset_count ?? 0)]
  ];
  $('#detail-fields').replaceChildren(...values.map(([label, value]) => {
    const pair = document.createElement('div');
    pair.append(element('dt', '', label), element('dd', '', value));
    return pair;
  }));
  const access = $('#change-access');
  access.textContent = license.revoked ? 'Restore license' : 'Revoke license';
  access.className = 'button ' + (license.revoked ? 'button-secondary' : 'button-danger');
}

function openDetails(event) {
  const trigger = event.target.closest('button[data-id]');
  if (!trigger) return;
  const license = rows.find(row => row.id === trigger.dataset.id);
  if (!license) return;
  activeLicenseId = license.id;
  feedback('#detail-message');
  renderDetails(license);
  detailDialog.showModal();
  loadHistory(license.id);
}

function clearHistory(message = '') {
  $('#checks-message').textContent = message;
  $('#checks').replaceChildren();
  $('#retry-checks').hidden = true;
}

async function loadHistory(id) {
  const request = ++historyRequest;
  const isCurrent = () => request === historyRequest && detailDialog.open && activeLicenseId === id;
  clearHistory('Loading launcher history…');
  try {
    const { checks } = await api('history', { id });
    if (!isCurrent()) return;
    const list = $('#checks');
    $('#checks-message').textContent = checks.length
      ? 'Up to 50 recent successful checks · UTC'
      : 'No checks recorded in the timeline yet.';
    list.replaceChildren(...checks.map(check => {
      const item = document.createElement('li');
      const time = element('time', '', formatTime(check, true));
      time.dateTime = check;
      item.append(time);
      return item;
    }));
  } catch (error) {
    if (!isCurrent() || handleSessionError(error)) return;
    clearHistory(error.message);
    $('#retry-checks').hidden = false;
  }
}

$('#retry-checks').addEventListener('click', () => {
  if (activeLicenseId) loadHistory(activeLicenseId);
});

$('#licenses').addEventListener('click', openDetails);
$('#audit').addEventListener('click', openDetails);
detailDialog.addEventListener('close', () => {
  if (detailDialog.open) return;
  const previousId = activeLicenseId;
  activeLicenseId = undefined;
  historyRequest += 1;
  clearHistory();
  if (authenticated && document.activeElement === document.body) {
    const trigger = Array.from(document.querySelectorAll('#' + activeView + '-view button[data-id]'))
      .find(button => button.dataset.id === previousId);
    (trigger || $('#' + activeView + '-title')).focus();
  }
});

function askConfirmation(title, message, label, operation, dangerous = false) {
  confirmOperation = operation;
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = message;
  const action = $('#confirm-action');
  action.textContent = label;
  action.className = 'button ' + (dangerous ? 'button-danger' : 'button-primary');
  feedback('#confirm-message');
  confirmation.showModal();
}

const actions = {
  revoke: {
    title: 'Revoke license',
    explanation: 'Future online launcher checks will reject this key. You can restore it later.',
    done: 'License revoked.'
  },
  restore: {
    title: 'Restore license',
    explanation: 'This removes the revocation. An expired license will stay expired.',
    done: 'License restored.'
  },
  reset_device: {
    title: 'Reset device',
    explanation: 'The next PC to use this key will be bound to it. Its original activation and expiry stay the same.',
    done: 'Device binding reset.'
  }
};

function manage(action) {
  const license = rows.find(row => row.id === activeLicenseId);
  if (!license) return;
  const { title, explanation, done } = actions[action];
  askConfirmation(title + '?', licenseLabel(license) + ' · ' + explanation, title, async () => {
    await api(action, { id: license.id });
    if (action === 'reset_device') {
      license.device_hash = null;
      license.reset_count = (license.reset_count ?? 0) + 1;
    } else {
      license.revoked = action === 'revoke';
    }
    feedback('#detail-message', done);
    renderDetails(license);
    renderLicenses();
    if (await refreshAfterChange()) {
      const latest = rows.find(row => row.id === license.id);
      if (latest && detailDialog.open) renderDetails(latest);
    }
  }, action === 'revoke');
}

$('#reset-device').addEventListener('click', () => manage('reset_device'));
$('#change-access').addEventListener('click', () => {
  const license = rows.find(row => row.id === activeLicenseId);
  if (license) manage(license.revoked ? 'restore' : 'revoke');
});

$('#confirm-action').addEventListener('click', async event => {
  if (!confirmOperation) return;
  const button = event.currentTarget;
  button.disabled = true;
  $('#cancel-action').disabled = true;
  feedback('#confirm-message');
  try {
    await confirmOperation();
    if (confirmation.open) confirmation.close();
  } catch (error) {
    if (!handleSessionError(error)) feedback('#confirm-message', error.message, 'error');
  } finally {
    button.disabled = false;
    $('#cancel-action').disabled = false;
  }
});

confirmation.addEventListener('close', () => { confirmOperation = undefined; });
confirmation.addEventListener('cancel', event => {
  if ($('#confirm-action').disabled) event.preventDefault();
});

document.querySelectorAll('dialog [data-close]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

function renderBatch() {
  const hasBatch = Boolean(batch);
  $('#create-title').textContent = hasBatch ? 'Save generated keys' : 'Generate keys';
  $('#create-label').textContent = hasBatch ? 'View generated keys' : 'Generate keys';
  $('#create-form').hidden = hasBatch;
  $('#create-actions').hidden = hasBatch;
  $('#new-keys').hidden = !hasBatch;
  $('#export-actions').hidden = !hasBatch;
  $('#key-output').value = batch ? batch.keys.join('\n') : '';
}

function warnAboutBatch(event) {
  if (batch && !batch.exported) {
    event.preventDefault();
    event.returnValue = '';
  }
}

function markExported() {
  batch.exported = true;
  window.removeEventListener('beforeunload', warnAboutBatch);
}

function clearBatch() {
  batch = null;
  window.removeEventListener('beforeunload', warnAboutBatch);
  renderBatch();
  feedback('#create-message');
}

$('#open-create').addEventListener('click', () => {
  renderBatch();
  feedback('#create-message');
  createDialog.showModal();
});

$('#create-form').addEventListener('submit', async event => {
  event.preventDefault();
  const generate = $('#generate');
  if (batch || generate.disabled) return;
  generate.disabled = true;
  generate.textContent = 'Generating…';
  $('#close-create').disabled = true;
  feedback('#create-message');
  try {
    const data = await api('create', {
      days: Number($('#days').value),
      count: Number($('#count').value),
      label: $('#label').value
    });
    batch = { keys: data.keys, days: data.days, exported: false };
    window.addEventListener('beforeunload', warnAboutBatch);
    if (!authenticated) return;
    renderBatch();
    $('#create-title').focus();
    feedback('#create-message', batch.keys.length + (batch.keys.length === 1 ? ' key ready to save.' : ' keys ready to save.'));
    await refreshAfterChange();
  } catch (error) {
    if (!handleSessionError(error)) {
      const uncertain = error.status === 0 || error.status >= 500 || error.status === 200;
      feedback('#create-message', uncertain
        ? 'Generation could not be confirmed. Refresh Licenses and check for the batch before retrying.'
        : error.message, 'error');
    }
  } finally {
    generate.disabled = false;
    generate.textContent = 'Generate keys';
    $('#close-create').disabled = false;
  }
});

createDialog.addEventListener('cancel', event => {
  if ($('#generate').disabled) event.preventDefault();
});

$('#download').addEventListener('click', () => {
  if (!batch) return;
  const csv = 'Key,Days\r\n' + batch.keys.map(key => key + ',' + (batch.days || 'Forever')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'AQx-' + (batch.days || 'permanent') + '-day-keys-' + Date.now() + '.csv';
  createDialog.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markExported();
  feedback('#create-message', 'CSV download started.');
});

$('#copy').addEventListener('click', async () => {
  if (!batch) return;
  const current = batch;
  try {
    await navigator.clipboard.writeText(current.keys.join('\n'));
    if (batch === current) {
      markExported();
      feedback('#create-message', 'Keys copied.');
    }
  } catch {
    if (batch === current && authenticated) {
      const output = $('#key-output');
      output.focus();
      output.select();
      feedback('#create-message', 'Clipboard access failed. The keys are selected for manual copying.', 'error');
    }
  }
});

$('#clear-export').addEventListener('click', () => {
  const clear = () => {
    if (confirmation.open) confirmation.close();
    clearBatch();
    $('#create-title').focus();
  };
  if (batch && !batch.exported) {
    askConfirmation('Clear generated keys?', 'The keys will disappear from this tab. Download or copy them first if you still need them.', 'Clear keys', clear, true);
  } else {
    clear();
  }
});

refresh();
