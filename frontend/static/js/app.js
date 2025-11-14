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
  chart: null,
  lastSnapshot: null,
  pollingInterval: 15000,
  timerId: null
};

const tableConfigs = {
  infobases: {
    element: document.getElementById('infobases-table'),
    columns: [
      { key: 'name', label: 'Имя' },
      { key: 'uuid', label: 'UUID' },
      { key: 'descr', label: 'Описание' }
    ]
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
      { key: 'last_active_at', label: 'Активность', formatter: formatDateTime }
    ]
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
    ]
  },
  processes: {
    element: document.getElementById('processes-table'),
    columns: [
      { key: 'uuid', label: 'UUID' },
      { key: 'host', label: 'Хост' },
      { key: 'port', label: 'Порт' },
      { key: 'pid', label: 'PID' },
      { key: 'running', label: 'Статус', formatter: (value) => (value === true || value === 'yes' ? 'Работает' : 'Остановлен') },
      { key: 'connections', label: 'Соединений' }
    ]
  },
  locks: {
    element: document.getElementById('locks-table'),
    columns: [
      { key: 'descr', label: 'Описание' },
      { key: 'connection', label: 'Соединение' },
      { key: 'session', label: 'Сеанс' },
      { key: 'locked', label: 'Заблокировано', formatter: formatDateTime }
    ]
  }
};

const renderTable = ({ element, columns }, rows) => {
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
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach(({ key, formatter }) => {
      const td = document.createElement('td');
      const value = row[key];
      td.textContent = formatter ? formatter(value) : value ?? '—';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  element.innerHTML = '';
  element.appendChild(thead);
  element.appendChild(tbody);
};

const updateMetrics = (snapshot) => {
  document.getElementById('metric-infobases').textContent = snapshot.infobases.length;
  document.getElementById('metric-sessions').textContent = snapshot.sessions.length;
  document.getElementById('metric-connections').textContent = snapshot.connections.length;
  document.getElementById('metric-locks').textContent = snapshot.locks.length;
  document.getElementById('cluster-name').textContent = snapshot.cluster?.name ?? '—';
};

const updateLicenses = (licenses) => {
  const list = document.getElementById('licenses-list');
  list.innerHTML = '';
  if (!licenses.length) {
    const li = document.createElement('li');
    li.textContent = 'Нет активных лицензий';
    list.appendChild(li);
    return;
  }
  licenses.forEach((license) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'text-slate-100 font-medium';
    name.textContent = license.full_presentation || license.user_name || license.session;

    const badge = document.createElement('span');
    badge.className = 'tag badge-purple mt-2';
    badge.textContent = license.license_type || 'Неизвестно';

    const details = document.createElement('span');
    details.className = 'text-sm text-slate-400 mt-1';
    details.textContent = `${license.host || '—'} • ${license.series || '—'}`;

    li.appendChild(name);
    li.appendChild(badge);
    li.appendChild(details);
    list.appendChild(li);
  });
};

const ensureChart = () => {
  if (state.chart) return state.chart;
  const options = {
    chart: {
      type: 'area',
      height: 320,
      toolbar: { show: false },
      foreColor: '#94a3b8'
    },
    grid: {
      borderColor: 'rgba(148, 163, 184, 0.2)'
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    dataLabels: {
      enabled: false
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0,
        stops: [0, 90, 100]
      }
    },
    series: [
      {
        name: 'Сеансы',
        data: []
      }
    ],
    xaxis: {
      type: 'datetime'
    },
    colors: ['#38bdf8']
  };
  state.chart = new ApexCharts(document.querySelector('#sessions-chart'), options);
  state.chart.render();
  return state.chart;
};

const updateChart = (snapshot) => {
  const chart = ensureChart();
  const timestamp = new Date().getTime();
  const existing = chart.w.globals.series[0].data || [];
  const nextData = [...existing, [timestamp, snapshot.sessions.length]].slice(-60);
  chart.updateSeries([{ name: 'Сеансы', data: nextData }]);
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
  updateMetrics(snapshot);
  updateChart(snapshot);
  updateLicenses(snapshot.licenses || []);
  document.getElementById('last-updated').textContent = `Обновлено ${formatDateTime(new Date().toISOString())}`;

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
  state.timerId = setInterval(fetchSnapshot, state.pollingInterval);
};

fetchSettings().then(fetchSnapshot).then(startPolling);
