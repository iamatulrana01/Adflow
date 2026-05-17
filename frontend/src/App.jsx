import { useCallback, useEffect, useState } from 'react';
import {
  fetchCampaigns,
  fetchStats,
  fetchAnalytics,
  fetchFailures,
  createCampaign,
  processCampaign,
  bulkIngest,
  connectMetricsWebSocket,
  login,
  logout,
} from './api';
import './App.css';

const STATUS_COLORS = {
  pending: 'var(--muted)',
  classifying: 'var(--warning)',
  routed: 'var(--accent)',
  active: 'var(--success)',
  failed: 'var(--danger)',
  paused: 'var(--muted)',
  completed: 'var(--success)',
};

function MetricCard({ label, value, sub, variant }) {
  return (
    <div className={`metric-card ${variant || ''}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

function ServiceHealthPanel({ health }) {
  if (!health?.services) return <p className="muted">Checking services…</p>;
  return (
    <div className="service-grid">
      {health.services.map((s) => (
        <div key={s.name} className={`service-card ${s.healthy ? 'up' : 'down'}`}>
          <span className="service-name">{s.name}</span>
          <span className={`service-status ${s.status}`}>{s.status}</span>
          <span className="service-latency">{s.latencyMs}ms</span>
        </div>
      ))}
      <div className="uptime-banner">
        Platform uptime: <strong>{health.summary?.uptimePercent ?? 0}%</strong> (
        {health.summary?.healthy}/{health.summary?.total} services healthy)
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState('overview');
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [failures, setFailures] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ name: '', description: '', budget: '', channel: 'social' });
  const [loginForm, setLoginForm] = useState({ email: 'admin@adflow.local', password: 'admin123' });
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const params = filter === 'failed' ? { failed: 'true' } : filter !== 'all' ? { status: filter } : {};
      const [campRes, statsRes, analyticsRes, failRes] = await Promise.all([
        fetchCampaigns(params),
        fetchStats(),
        fetchAnalytics().catch(() => null),
        fetchFailures().catch(() => ({ data: [] })),
      ]);
      setCampaigns(campRes.data || []);
      setStats(statsRes);
      setAnalytics(analyticsRes);
      setFailures(failRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const ws = connectMetricsWebSocket((msg) => {
      if (msg.type === 'metrics') {
        setMetrics(msg.data);
        setWsStatus('connected');
      }
      if (msg.type === 'error') setWsStatus('error');
    });
    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    return () => ws.close();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const created = await createCampaign({ ...form, budget: parseFloat(form.budget) });
      await processCampaign(created._id);
      setForm({ name: '', description: '', budget: '', channel: 'social' });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDemoIngest() {
    const demo = [
      { name: 'Enterprise Q4 Launch', budget: 80000, channel: 'display', description: 'enterprise brand push' },
      { name: 'Cart Abandon Retarget', budget: 4000, channel: 'social', description: 'retarget cart abandoners' },
      { name: 'Pilot A/B Test', budget: 800, channel: 'search', description: 'pilot test campaign' },
    ];
    try {
      await bulkIngest(demo);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const data = await login(loginForm.email, loginForm.password);
      setUser(data.user);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  const sys = metrics?.system;
  const kpis = metrics?.campaignKpis || stats;
  const health = metrics?.serviceHealth;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◆</span>
          <div>
            <h1>AdFlow</h1>
            <p>AI Campaign Automation & Monitoring</p>
          </div>
        </div>
        <div className="header-actions">
          <div className={`ws-badge ${wsStatus}`}>
            <span className="dot" />
            Live {wsStatus}
          </div>
          {user ? (
            <button className="secondary" onClick={() => { logout(); setUser(null); }}>
              Logout {user.email}
            </button>
          ) : (
            <form className="login-form" onSubmit={handleLogin}>
              <input
                placeholder="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
              <input
                type="password"
                placeholder="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
              <button type="submit" className="secondary">
                Login
              </button>
            </form>
          )}
        </div>
      </header>

      <nav className="tabs">
        {['overview', 'campaigns', 'services', 'analytics', 'failures'].map((t) => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'failures' && failures.length > 0 ? ` (${failures.length})` : ''}
          </button>
        ))}
      </nav>

      {error && <div className="banner error">{error}</div>}

      {tab === 'overview' && (
        <>
          <section className="metrics-grid">
            <MetricCard label="Total Campaigns" value={kpis?.total ?? '—'} />
            <MetricCard label="Failed" value={kpis?.failed ?? stats?.failed ?? 0} variant="danger" />
            <MetricCard label="CTR" value={kpis?.ctr != null ? `${kpis.ctr.toFixed(2)}%` : '—'} />
            <MetricCard
              label="Error Rate"
              value={sys ? `${sys.errorRatePercent}%` : '—'}
              variant={sys?.errorRatePercent > 5 ? 'danger' : ''}
            />
            <MetricCard
              label="Avg Latency"
              value={sys ? `${sys.avgLatencyMs}ms` : '—'}
              sub={sys?.avgLatencyMs < 200 ? 'under 200ms target' : 'above target'}
            />
            <MetricCard
              label="Uptime"
              value={health?.summary ? `${health.summary.uptimePercent}%` : '—'}
              variant="success"
            />
          </section>
          <div className="main-grid">
            <section className="panel">
              <h2>Create Campaign</h2>
              <form onSubmit={handleCreate} className="form">
                <input placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="form-row">
                  <input type="number" placeholder="Budget ($)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} required min="0" />
                  <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                    <option value="search">Search</option>
                    <option value="social">Social</option>
                    <option value="display">Display</option>
                    <option value="email">Email</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button type="submit" className="primary">Create & Auto-Process</button>
                  <button type="button" className="secondary" onClick={handleDemoIngest}>Demo Bulk Ingest</button>
                </div>
              </form>
            </section>
            <section className="panel alerts-panel">
              <h2>Alerts & Events</h2>
              <div className="alerts-list">
                {(metrics?.alerts || []).length === 0 ? (
                  <p className="muted">No threshold breaches</p>
                ) : (
                  metrics.alerts.map((a) => (
                    <div key={a.id} className={`alert-item ${a.severity}`}>
                      <strong>{a.severity}</strong>
                      <span>{a.message}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === 'services' && (
        <section className="panel">
          <h2>Service Health</h2>
          <ServiceHealthPanel health={health} />
          {sys?.host && (
            <div className="host-metrics">
              <h3>Host Metrics</h3>
              <p>Memory: {sys.host.memory?.usedPercent}% used ({sys.host.memory?.usedMb}MB / {sys.host.memory?.totalMb}MB)</p>
              <p>CPU cores: {sys.host.cpuCount} | Load: {sys.host.loadAvg?.map((l) => l.toFixed(2)).join(', ')}</p>
            </div>
          )}
        </section>
      )}

      {tab === 'analytics' && analytics && (
        <section className="panel">
          <h2>Analytics Overview</h2>
          <div className="metrics-grid">
            <MetricCard label="Impressions" value={analytics.totals?.impressions?.toLocaleString() ?? 0} />
            <MetricCard label="Conversions" value={analytics.totals?.conversions ?? 0} />
            <MetricCard label="Spend" value={`$${analytics.totals?.spend?.toLocaleString() ?? 0}`} />
            <MetricCard label="Conv. Rate" value={`${analytics.conversionRate?.toFixed(2) ?? 0}%`} />
          </div>
          <h3 className="sub-heading">By Category</h3>
          <pre className="code-block">{JSON.stringify(analytics.byCategory, null, 2)}</pre>
        </section>
      )}

      {tab === 'failures' && (
        <section className="panel">
          <h2>Failed Campaigns ({failures.length})</h2>
          {failures.length === 0 ? (
            <p className="muted">No failed campaigns</p>
          ) : (
            <ul className="failure-list">
              {failures.map((c) => (
                <li key={c._id}>
                  <strong>{c.name}</strong> — {c.status} — ${c.budget}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(tab === 'campaigns' || tab === 'overview') && (
        <section className="panel campaigns-panel">
          <div className="panel-header">
            <h2>Campaigns {loading && <span className="muted">(loading…)</span>}</h2>
            <div className="filters">
              {['all', 'active', 'failed', 'pending'].map((f) => (
                <button key={f} className={filter === f ? 'filter active' : 'filter'} onClick={() => setFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Platform</th>
                  <th>Objective</th>
                  <th>Approval</th>
                  <th>Route</th>
                  <th>Budget</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">No campaigns — create one or run demo ingest</td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c._id}>
                      <td>{c.name}</td>
                      <td>
                        <span className="status-pill" style={{ '--pill-color': STATUS_COLORS[c.status] }}>
                          {c.status}
                        </span>
                      </td>
                      <td>{c.classification?.target_platform || '—'}</td>
                      <td>{c.classification?.objective || '—'}</td>
                      <td>{c.classification?.approval_flow || '—'}</td>
                      <td className="mono">{c.classification?.route || '—'}</td>
                      <td>${c.budget?.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
