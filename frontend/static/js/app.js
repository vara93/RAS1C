const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('ru-RU', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (err) {
    return value;
  }
};

const state = {
  lastSnapshot: null,
  pollingInterval: 15000,
  timerId: null,
  autoRefresh: true
};

const tableConfigs = {
  infobases: {
    element: document.getElementById('infobases-table'),
    columns: [
      { key: 'name', label: 'Имя' },
      { key: 'uuid', label: 'UUID' },
      { key: 'descr', label: 'Описание' }
    ],
    emptyMessage: 'Нет информационных баз'
  },
  sessions: {
    element: document.getElementById('sessions-table'),
    columns: [
      { key: 'session_id', label: 'ID' },
      { key: 'user_name', label: 'Пользователь' },
      { key: 'infobase', label: 'ИБ' },
      { key: 'host', label: 'Хост' },
      { key: 'app_id', label: 'Приложение' },
      { key: 'started_at', label: 'Старт', formatter: formatDateTime },
      { key: 'last_active_at', label: 'Последняя активность', formatter: formatDateTime }
    ],
    emptyMessage: 'Нет активных сеансов'
  },
  connections: {
    element: document.getElementById('connections-table'),
    columns: [
      { key: 'conn_id', label: 'ID' },
      { key: 'application', label: 'Приложение' },
      { key: 'infobase', label: 'ИБ' },
      { key: 'host', label: 'Хост' },
      { key: 'process', label: 'Процесс' },
      { key: 'connected_at', label: 'Подключен', formatter: formatDateTime }
    ],
    emptyMessage: 'Нет подключений'
  },
  processes: {
    element: document.getElementById('processes-table'),
    columns: [
      { key: 'uuid', label: 'UUID' },
      { key: 'host', label: 'Хост' },
      { key: 'port', label: 'Порт' },
      { key: 'pid', label: 'PID' },
      {
        key: 'running',
        label: 'Статус',
        formatter: (value) => (value === true || value === 'yes' ? 'Работает' : 'Остановлен')
      },
      { key: 'connections', label: 'Соединений' }
    ],
    emptyMessage: 'Нет активных процессов'
  },
  locks: {
    element: document.getElementById('locks-table'),
    columns: [
      { key: 'descr', label: 'Описание' },
      { key: 'connection', label: 'Соединение' },
      { key: 'session', label: 'Сеанс' },
      { key: 'locked', label: 'Заблокировано', formatter: formatDateTime }
    ],
    emptyMessage: 'Блокировки отсутствуют'
  }
};

const renderTable = ({ element, columns, emptyMessage }, rows) => {
  if (!element) return;

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  columns.forEach(({ label }) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = columns.length;
    td.textContent = emptyMessage;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach(({ key, formatter }) => {
        const td = document.createElement('td');
        const rawValue = row[key];
        const value = formatter ? formatter(rawValue) : rawValue;
        td.textContent = value ?? '—';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  element.innerHTML = '';
  element.appendChild(thead);
  element.appendChild(tbody);
};

const normalizeMode = (mode) => {
  if (!mode) return '—';
  switch (mode) {
    case 'performance':
      return 'Производительность';
    case 'fault-tolerance':
      return 'Отказоустойчивость';
    default:
      return mode;
  }
};

const updateClusterMeta = (snapshot) => {
  const cluster = snapshot.cluster || {};
  document.getElementById('cluster-title').textContent = cluster.name || 'Кластер не определен';
  document.getElementById('cluster-uuid').textContent = cluster.uuid || '—';
  document.getElementById('cluster-host').textContent = cluster.host || '—';
  document.getElementById('cluster-port').textContent = cluster.port ?? '—';
  document.getElementById('cluster-mode').textContent = normalizeMode(cluster.load_balancing_mode);
  document.getElementById('cluster-processes').textContent = snapshot.processes.length;
};

const updateMetrics = (snapshot) => {
  document.getElementById('metric-infobases').textContent = snapshot.infobases.length;
  document.getElementById('metric-sessions').textContent = snapshot.sessions.length;
  document.getElementById('metric-connections').textContent = snapshot.connections.length;
  document.getElementById('metric-processes').textContent = snapshot.processes.length;
  document.getElementById('metric-locks').textContent = snapshot.locks.length;
  document.getElementById('metric-licenses').textContent = snapshot.licenses.length;
};

const updateLicenses = (licenses) => {
  const list = document.getElementById('licenses-list');
  list.innerHTML = '';

  if (!licenses.length) {
    const li = document.createElement('li');
    li.textContent = 'Нет активных лицензий';
    li.className = 'license-empty';
    list.appendChild(li);
    return;
  }

  licenses.forEach((license) => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'license-name';
    name.textContent = license.full_presentation || license.user_name || license.session;

    const badge = document.createElement('span');
    badge.className = 'badge badge--violet';
    badge.textContent = license.license_type || 'Неизвестно';

    const meta = document.createElement('div');
    meta.className = 'license-meta';

    const host = document.createElement('span');
    host.textContent = `Хост: ${license.host || '—'}`;

    const series = document.createElement('span');
    series.textContent = `Серия: ${license.series || '—'}`;

    meta.appendChild(host);
    meta.appendChild(series);

    li.appendChild(name);
    li.appendChild(badge);
    li.appendChild(meta);
    list.appendChild(li);
  });
};

const fetchSettings = async () => {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Не удалось загрузить настройки');
    const settings = await response.json();
    document.getElementById('ras-address').textContent = `${settings.ras_host}:${settings.ras_port}`;
  } catch (error) {
    console.error(error);
    document.getElementById('ras-address').textContent = 'Ошибка загрузки';
  }
};

const updateSnapshot = (snapshot) => {
  state.lastSnapshot = snapshot;
  updateClusterMeta(snapshot);
  updateMetrics(snapshot);
  updateLicenses(snapshot.licenses || []);
  document.getElementById('last-updated').textContent = `Последнее обновление: ${formatDateTime(
    new Date().toISOString()
  )}`;

  Object.entries(tableConfigs).forEach(([key, config]) => {
    renderTable(config, snapshot[key] || []);
  });
};

const fetchSnapshot = async () => {
  try {
    const response = await fetch('/api/snapshot');
    if (!response.ok) throw new Error('Не удалось получить данные RAS');
    const snapshot = await response.json();
    updateSnapshot(snapshot);
  } catch (error) {
    console.error(error);
    document.getElementById('last-updated').textContent = 'Ошибка обновления данных';
  }
};

const startPolling = () => {
  clearInterval(state.timerId);
  if (!state.autoRefresh) return;
  state.timerId = setInterval(fetchSnapshot, state.pollingInterval);
};

const initControls = () => {
  const refreshButton = document.getElementById('refresh-button');
  const autoRefreshToggle = document.getElementById('auto-refresh-toggle');

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      fetchSnapshot();
    });
  }

  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', (event) => {
      state.autoRefresh = event.target.checked;
      if (state.autoRefresh) {
        fetchSnapshot();
        startPolling();
      } else {
        clearInterval(state.timerId);
      }
    });
  }
};

initControls();
fetchSettings().then(fetchSnapshot).then(startPolling);
