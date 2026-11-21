import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, CircleUserRound, LayoutDashboard, Radio, RefreshCw } from 'lucide-react';
import Admin from './Admin';
import Public from './Public';
import { getState } from './api';
import type { Snapshot } from './types';

const adminPage = window.location.pathname.startsWith('/admin');

export default function App() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const state = await getState();
      setData(state); setReceivedAt(Date.now()); setError('');
    } catch (e) { setError((e as Error).message); }
    finally { if (manual) setRefreshing(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const liveCount = data?.groups.flatMap(g => g.matches).concat(data.knockout)
    .filter(m => ['live', 'halftime', 'extra', 'penalties'].includes(m.status)).length || 0;

  return <div className="app">
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="/" aria-label="Salesianos FEST · Inicio">
          <img src="/images/logo.png" alt="Salesianos FEST" />
          <span className="brand-divider" />
          <span className="brand-sub">CAMPEONATO<br />INTERPROMOCIONES</span>
        </a>
        <div className="header-actions">
          {liveCount > 0 && <span className="top-live"><span className="pulse-dot" />{liveCount} EN JUEGO</span>}
          <button className="icon-button refresh-button" onClick={() => void refresh(true)} title="Actualizar datos" aria-label="Actualizar datos"><RefreshCw size={18} className={refreshing ? 'spin' : ''} /></button>
          <a className="header-link" href={adminPage ? '/' : '/admin'}>
            {adminPage ? <><LayoutDashboard size={17} /> Ver resultados <ArrowUpRight size={15} /></> : <><CircleUserRound size={18} /> Admin</>}
          </a>
        </div>
      </div>
    </header>

    {error && <div className="container"><div className="alert alert-error" role="alert">No se pudo actualizar: {error}. Mostramos los últimos datos recibidos.</div></div>}
    {!data ? <div className="loading-screen"><span className="loader" /><strong>Preparando el campeonato…</strong><span>Conectando con los resultados</span></div>
      : !data.ready ? <div className="container empty-state">El fixture todavía no está cargado en el servidor.</div>
        : adminPage ? <Admin data={data} refresh={refresh} receivedAt={receivedAt} /> : <Public data={data} receivedAt={receivedAt} />}

    <footer className="site-footer"><div className="container footer-inner"><span><b>///</b> SALESIANOS FEST 2026 <small>· AYACUCHO</small></span><span>Un encuentro entre promociones <CalendarDays size={15} /></span></div></footer>
  </div>;
}

export function Clock({ elapsed, running, receivedAt }: { elapsed: number; running: boolean; receivedAt: number }) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const seconds = Math.max(0, elapsed + (running ? Math.floor((tick - receivedAt) / 1000) : 0));
  return <span className="clock"><Radio size={14} /> {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>;
}
