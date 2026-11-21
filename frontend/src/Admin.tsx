import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, CircleAlert, Clock3, Flag, LockKeyhole, LogOut, Save, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Clock } from './App';
import { controlMatch, getSession, login, logout, saveGroup, saveKnockout } from './api';
import { isLive, stageLabels, statusLabels, timeLabel } from './format';
import type { Match, MatchDraft, Snapshot, Team } from './types';
import { makeDraft } from './types';

type AdminTab = 'groups' | 'bracket';

export default function Admin({ data, refresh, receivedAt }: { data: Snapshot; refresh: () => Promise<void>; receivedAt: number }) {
  const [csrf, setCsrf] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<AdminTab>('groups');
  const [groupId, setGroupId] = useState('A');
  const [drafts, setDrafts] = useState<MatchDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [decisions, setDecisions] = useState<Record<string, { decision: string; winner: string }>>({});
  const [knockoutId, setKnockoutId] = useState('round16-1');
  const [koDraft, setKoDraft] = useState<MatchDraft | null>(null);
  const [koDirty, setKoDirty] = useState(false);

  const group = data.groups.find(g => g.id === groupId) || data.groups[0];
  const knockout = data.knockout.find(m => m.id === knockoutId) || data.knockout[0];
  const allMatches = data.groups.flatMap(g => g.matches).concat(data.knockout);
  const liveCount = allMatches.filter(isLive).length;
  const finishedCount = allMatches.filter(m => m.status === 'final').length;

  useEffect(() => { void getSession().then(s => { if (s.authenticated) setCsrf(s.csrf || null); }).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (!dirty) setDrafts(group.matches.map(makeDraft)); }, [group, dirty]);
  useEffect(() => { if (!koDirty && knockout) setKoDraft(makeDraft(knockout)); }, [knockout, koDirty]);
  const draftById = useMemo(() => Object.fromEntries(drafts.map(d => [d.id, d])), [drafts]);

  function selectGroup(id: string) { if (dirty && !window.confirm('Hay cambios sin guardar en este grupo. ¿Descartarlos?')) return; setDirty(false); setGroupId(id); setError(''); setMessage(''); }
  function selectKnockout(id: string) { if (koDirty && !window.confirm('Hay cambios sin guardar en este partido. ¿Descartarlos?')) return; setKoDirty(false); setKnockoutId(id); setError(''); setMessage(''); }
  function updateDraft(id: string, field: keyof MatchDraft, value: string | number | null) {
    setDrafts(current => current.map(d => d.id === id ? { ...d, [field]: value } : d)); setDirty(true); setMessage('');
  }
  function updateKo(field: keyof MatchDraft, value: string | number | null) {
    setKoDraft(current => current ? { ...current, [field]: value } : current); setKoDirty(true); setMessage('');
  }
  async function execute(work: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); await refresh(); setMessage(success); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function persistGroup() {
    if (!csrf) return;
    await saveGroup(group, drafts, csrf);
    setDirty(false);
  }
  async function persistKnockout() {
    if (!csrf || !koDraft) return;
    await saveKnockout(koDraft, csrf);
    setKoDirty(false);
  }
  async function act(match: Match, action: string) {
    if (!csrf) return;
    const decision = decisions[match.id];
    if (action === 'reopen' && !window.confirm('¿Reabrir este partido? La tabla y la llave pueden cambiar.')) return;
    await execute(async () => {
      if (match.group_id && dirty) await persistGroup();
      if (!match.group_id && koDirty) await persistKnockout();
      await controlMatch(match.id, action, csrf, action === 'finish' ? decision?.winner || null : null,
                         action === 'finish' ? decision?.decision || null : null);
    }, action === 'finish' ? 'Resultado final publicado.' : 'Estado del partido actualizado.');
  }

  if (checking) return <div className="loading-screen"><span className="loader" />Verificando sesión…</div>;
  if (!csrf) return <main className="login-page"><div className="login-visual"><div className="login-visual-inner"><span className="eyebrow">/// MESA DE CONTROL</span><h1>Todo el campeonato<br /><em>en tus manos.</em></h1><p>Organiza los encuentros, registra cada gol y mantén a todos al tanto.</p><div className="login-caption"><ShieldCheck size={20} /> Resultados conectados a la base de datos</div></div></div>
    <div className="login-form-side"><form className="login-box" onSubmit={e => { e.preventDefault(); setBusy(true); setError(''); void login(password).then(s => { setCsrf(s.csrf); setPassword(''); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>
      <div className="login-icon"><LockKeyhole size={26} /></div><span className="eyebrow">ACCESO ADMINISTRADOR</span><h2>Bienvenido de nuevo</h2><p>Ingresa para actualizar partidos, grupos y resultados en vivo.</p>
      <label className="field-label" htmlFor="admin-password">Contraseña</label><input id="admin-password" className="text-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Tu contraseña" />
      {error && <div className="form-error"><CircleAlert size={17} />{error}</div>}
      <button className="button button-primary login-submit" disabled={busy}>Ingresar al panel <ArrowRight size={17} /></button><a className="back-link" href="/">← Volver a resultados</a>
    </form></div></main>;

  return <main className="container admin-page">
    <div className="admin-hero"><div><span className="eyebrow"><span className="slashes">///</span> MESA DE CONTROL · SALESIANOS FEST</span><h1>Panel de administración<span className="title-period">.</span></h1><p>Edita la jornada y publica cada actualización para todos los espectadores.</p></div><button className="button button-outline logout-button" onClick={() => void logout(csrf).then(() => setCsrf(null))}><LogOut size={16} /> Cerrar sesión</button></div>
    <div className="admin-stats"><Stat icon={<Users size={21} />} label="GRUPOS" value={data.groups.length} tone="blue" /><Stat icon={<Clock3 size={21} />} label="EN JUEGO" value={liveCount} tone="pink" /><Stat icon={<Flag size={21} />} label="FINALIZADOS" value={finishedCount} tone="light" /><Stat icon={<Trophy size={21} />} label="PARTIDOS TOTALES" value={allMatches.length} tone="blue" /></div>
    <div className="admin-tabs"><button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}><Users size={18} /> Fase de grupos</button><button className={tab === 'bracket' ? 'active' : ''} onClick={() => setTab('bracket')}><Trophy size={18} /> Llaves finales</button><a href="/">Vista pública <ArrowRight size={16} /></a></div>
    {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} />{error}</div>}
    {message && <div className="alert alert-success" role="status"><Check size={18} />{message}</div>}

    {tab === 'groups' ? <div className="admin-layout"><aside className="admin-sidebar"><span className="sidebar-title">SELECCIONAR GRUPO</span><div className="sidebar-list">{data.groups.map(g => <button key={g.id} className={groupId === g.id ? 'selected' : ''} onClick={() => selectGroup(g.id)}><span className="sidebar-letter">{g.id}</span><span>Grupo {g.id}<small>{g.teams.length} promociones · {g.matches.length} partidos</small></span><ChevronDown className="sidebar-chevron" size={16} /></button>)}</div></aside>
      <div className="admin-content"><div className="admin-section-head"><div><span className="eyebrow">EDITANDO FASE DE GRUPOS</span><h2>Grupo {group.id}</h2><p>Modifica rivales, marcadores, horarios y duración. Guarda el grupo para publicar los cambios.</p></div><span className="revision-tag">VERSIÓN {group.revision + 1}</span></div>
        <div className="admin-table"><div className="inner-head"><span>TABLA PÚBLICA ACTUAL</span><span>{group.matches.filter(m => m.status === 'final').length}/{group.matches.length} finalizados</span></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Promoción</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th></tr></thead><tbody>{group.table.map((t, i) => <tr key={t.id}><td>{i + 1}</td><td className="team-name">{t.name}</td><td>{t.pj}</td><td>{t.g}</td><td>{t.e}</td><td>{t.p}</td><td>{t.dg}</td><td className="point-cell">{t.pts}</td></tr>)}</tbody></table></div></div>
        <div className="admin-match-heading"><div><span className="eyebrow">FIXTURE & MARCADORES</span><h3>Partidos del grupo</h3></div><span>{group.matches.length} encuentros</span></div>
        <div className="editor-list">{group.matches.map((m, i) => <MatchEditor key={m.id} match={m} draft={draftById[m.id] || makeDraft(m)} teams={group.teams} number={i + 1} receivedAt={receivedAt} onChange={(f, v) => updateDraft(m.id, f, v)} onAct={a => void act(m, a)} busy={busy} decision={decisions[m.id]} setDecision={v => setDecisions(current => ({ ...current, [m.id]: { ...current[m.id], ...v } }))} />)}</div>
        <div className="save-panel"><div><strong>{dirty ? 'Tienes cambios sin publicar' : 'Grupo sincronizado'}</strong><span>{dirty ? 'Al actualizar, los marcadores se guardarán y aparecerán en resultados.' : 'Los espectadores están viendo la última versión guardada.'}</span></div><button className="button button-primary" disabled={busy || !dirty} onClick={() => void execute(persistGroup, `Grupo ${group.id} actualizado y publicado.`)}><Save size={18} /> Actualizar grupo</button></div>
      </div></div>
    : <div className="admin-layout"><aside className="admin-sidebar"><span className="sidebar-title">SELECCIONAR PARTIDO</span><div className="sidebar-list knockout-sidebar">{data.knockout.map(m => <button key={m.id} className={knockoutId === m.id ? 'selected' : ''} onClick={() => selectKnockout(m.id)}><span className="sidebar-letter">{m.position + 1}</span><span>{stageLabels[m.stage]}<small>{m.home_name} vs {m.away_name}</small></span></button>)}</div></aside>
      <div className="admin-content"><div className="admin-section-head"><div><span className="eyebrow">CAMINO AL CAMPEÓN</span><h2>{stageLabels[knockout.stage]} · Partido {knockout.position + 1}</h2><p>Asigna los equipos de octavos al confirmarse los clasificados. El ganador de cada llave avanzará automáticamente.</p></div></div>
        <div className="editor-list"><MatchEditor match={knockout} draft={koDraft || makeDraft(knockout)} teams={data.teams || []} number={knockout.position + 1} receivedAt={receivedAt} onChange={updateKo} onAct={a => void act(knockout, a)} busy={busy} decision={decisions[knockout.id]} setDecision={v => setDecisions(current => ({ ...current, [knockout.id]: { ...current[knockout.id], ...v } }))} /></div>
        <div className="save-panel"><div><strong>{koDirty ? 'Hay cambios sin publicar' : 'Partido sincronizado'}</strong><span>En eliminación puedes ir directamente a penales, usar tiempo extra o elegir al ganador.</span></div><button className="button button-primary" disabled={busy || !koDirty} onClick={() => void execute(persistKnockout, 'Partido de la llave actualizado.')}><Save size={18} /> Actualizar partido</button></div>
      </div></div>}
  </main>;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className={`admin-stat ${tone}`}><div>{icon}<span>{label}</span></div><strong>{String(value).padStart(2, '0')}</strong></div>;
}

function MatchEditor({ match: m, draft: d, teams, number, receivedAt, onChange, onAct, busy, decision, setDecision }: {
  match: Match; draft: MatchDraft; teams: Team[]; number: number; receivedAt: number;
  onChange: (field: keyof MatchDraft, value: string | number | null) => void;
  onAct: (action: string) => void; busy: boolean;
  decision?: { decision: string; winner: string };
  setDecision: (value: Partial<{ decision: string; winner: string }>) => void;
}) {
  const live = isLive(m);
  const canFinish = d.home_score !== null && d.away_score !== null && !!d.home_id && !!d.away_id;
  return <article className={`editor-card ${live ? 'playing' : ''}`}><div className="editor-card-head"><div><span className="match-index">{String(number).padStart(2, '0')}</span><div><strong>{m.group_id ? `Partido ${number}` : stageLabels[m.stage]}</strong><small>{timeLabel(m.scheduled_at)} · {m.court ? `Cancha ${m.court}` : 'Cancha pendiente'}</small></div></div><span className={`state-pill state-${m.status}`}>{live && <span className="pulse-dot" />}{statusLabels[m.status]}</span></div>
    <div className="editor-main"><div className="side-team"><label>LOCAL / EQUIPO A</label><select value={d.home_id || ''} onChange={e => onChange('home_id', e.target.value || null)}><option value="">Por definir</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div className="score-editor"><input aria-label="Marcador equipo A" type="number" min="0" max="999" inputMode="numeric" value={d.home_score ?? ''} onChange={e => onChange('home_score', e.target.value === '' ? null : Number(e.target.value))} placeholder="0" /><span>:</span><input aria-label="Marcador equipo B" type="number" min="0" max="999" inputMode="numeric" value={d.away_score ?? ''} onChange={e => onChange('away_score', e.target.value === '' ? null : Number(e.target.value))} placeholder="0" /></div>
      <div className="side-team"><label>VISITA / EQUIPO B</label><select value={d.away_id || ''} onChange={e => onChange('away_id', e.target.value || null)}><option value="">Por definir</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
    <div className="editor-meta"><label>HORA <input type="time" value={localTime(d.scheduled_at)} onChange={e => onChange('scheduled_at', withLocalTime(d.scheduled_at, e.target.value))} /></label><label>CANCHA <input value={d.court || ''} onChange={e => onChange('court', e.target.value)} placeholder="Por definir" /></label><label>DURACIÓN (MIN) <input type="number" min="1" max="300" value={d.duration_minutes} onChange={e => onChange('duration_minutes', Number(e.target.value))} /></label></div>
    <div className="editor-controls"><div className="control-heading"><span>CONTROL DEL PARTIDO</span><span>{live || m.status === 'final' ? <Clock elapsed={m.elapsed_seconds} running={m.running} receivedAt={receivedAt} /> : <Clock3 size={16} />}</span></div><div className="control-buttons">
      {m.status === 'scheduled' && <button disabled={busy} onClick={() => onAct('start')} className="control-primary"><span className="pulse-dot" /> Iniciar · En juego</button>}
      {['live', 'extra'].includes(m.status) && <button disabled={busy} onClick={() => onAct('halftime')}>Medio tiempo / Pausar</button>}
      {['halftime', 'penalties'].includes(m.status) && <button disabled={busy} onClick={() => onAct('resume')}>Reanudar</button>}
      {['live', 'halftime', 'penalties'].includes(m.status) && <button disabled={busy} onClick={() => onAct('extra')}>Tiempo extra</button>}
      {['live', 'halftime', 'extra'].includes(m.status) && <button disabled={busy} onClick={() => onAct('penalties')}>Ir a penales</button>}
      {m.status === 'final' && <button disabled={busy} onClick={() => onAct('reopen')}>Reabrir partido</button>}
    </div>
      {m.status !== 'final' && <div className="finish-row"><div className="finish-inputs"><label>DEFINICIÓN <select value={decision?.decision || ''} onChange={e => setDecision({ decision: e.target.value })}><option value="">Según marcador / empate</option><option value="penalties">Penales</option><option value="manual">Ganador elegido</option></select></label>
        {decision?.decision === 'penalties' && <div className="penalty-inputs"><label>PENALES A<input type="number" min="0" max="99" value={d.home_penalties ?? ''} onChange={e => onChange('home_penalties', e.target.value === '' ? null : Number(e.target.value))} /></label><span>—</span><label>PENALES B<input type="number" min="0" max="99" value={d.away_penalties ?? ''} onChange={e => onChange('away_penalties', e.target.value === '' ? null : Number(e.target.value))} /></label></div>}
        {decision?.decision === 'manual' && <label>GANADOR <select value={decision.winner || ''} onChange={e => setDecision({ winner: e.target.value })}><option value="">Elegir equipo</option><option value={d.home_id || ''}>{teams.find(t => t.id === d.home_id)?.name || 'Equipo A'}</option><option value={d.away_id || ''}>{teams.find(t => t.id === d.away_id)?.name || 'Equipo B'}</option></select></label>}</div>
        <button className="button button-finish" disabled={busy || !canFinish || (decision?.decision === 'manual' && !decision.winner)} onClick={() => onAct('finish')}><Check size={17} /> Finalizar partido</button></div>}
      {m.status === 'final' && <div className="final-note"><Check size={16} /> Resultado publicado {m.decision === 'manual' ? '· ganador definido por la organización' : m.decision === 'penalties' ? `· penales ${m.home_penalties}–${m.away_penalties}` : ''}</div>}
    </div></article>;
}

function localTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(new Date(value));
}
function withLocalTime(existing: string | null, time: string) {
  if (!time) return null;
  // The event is in Lima (UTC−5); retain the fixture's local date.
  const parts = existing ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Lima' }).formatToParts(new Date(existing)) : [];
  const part = (key: string) => parts.find(p => p.type === key)?.value || '';
  const date = existing ? `${part('year')}-${part('month')}-${part('day')}` : '2026-11-21';
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}
