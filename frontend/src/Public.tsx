import { useState } from 'react';
import { ArrowRight, CalendarDays, ChevronRight, Clock3, MapPin, Radio, Trophy, Users, Zap } from 'lucide-react';
import { Clock } from './App';
import { dateLabel, isLive, scheduledSort, score, stageLabels, statusLabels, timeLabel } from './format';
import type { Group, Match, Snapshot } from './types';

type Section = 'overview' | 'groups' | 'schedule' | 'bracket';

export default function Public({ data, receivedAt }: { data: Snapshot; receivedAt: number }) {
  const [section, setSection] = useState<Section>('overview');
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [scheduleFilter, setScheduleFilter] = useState('Todos');
  const all = data.groups.flatMap(g => g.matches).concat(data.knockout);
  const live = all.filter(isLive).sort(scheduledSort);
  const upcoming = all.filter(m => m.status === 'scheduled' && m.home_id && m.away_id).sort(scheduledSort);
  const finished = all.filter(m => m.status === 'final').sort((a, b) => scheduledSort(b, a));
  const group = data.groups.find(g => g.id === selectedGroup) || data.groups[0];
  const champion = data.knockout.find(m => m.stage === 'final' && m.winner_id);
  const winnerName = champion?.winner_id === champion?.home_id ? champion?.home_name : champion?.away_name;

  return <main>
    <div className="public-hero">
      <div className="container public-hero-inner">
        <div className="hero-copy">
          <p className="eyebrow"><span className="slashes">///</span> SALESIANOS FEST · 2026</p>
          <h1>El encuentro<br /><em>se vive aquí.</em></h1>
          <p className="hero-description">Sigue cada partido, consulta la tabla de tu promoción y descubre quién avanza en el campeonato.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => setSection(live.length ? 'overview' : 'schedule')}>
              {live.length ? <Radio size={18} /> : <CalendarDays size={18} />}{live.length ? 'Ver partidos en vivo' : 'Ver programación'} <ArrowRight size={17} />
            </button>
            <button className="button button-outline" onClick={() => setSection('groups')}>Explorar grupos <ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="hero-stat"><span className="hero-stat-label">EN EL CAMPEONATO</span><strong>{data.groups.length.toString().padStart(2, '0')}</strong><span>grupos de promociones</span></div>
      </div>
    </div>

    <div className="container">
      <div className="info-strip"><span><Zap size={17} /> Marcadores actualizados durante la jornada</span><span><MapPin size={17} /> Asociación Okinawense del Perú</span><span><CalendarDays size={17} /> 21 NOV 2026</span></div>
      <nav className="section-nav" aria-label="Secciones de resultados">
        {([['overview', 'Resumen', Radio], ['groups', 'Grupos', Users], ['schedule', 'Partidos', CalendarDays], ['bracket', 'Llaves', Trophy]] as const).map(([key, label, Icon]) =>
          <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><Icon size={18} />{label}</button>)}
      </nav>

      {section === 'overview' && <div className="page-content">
        <SectionHeader kicker="AHORA MISMO" title="En juego" count={live.length} accent="pink" />
        {live.length ? <div className="live-grid">{live.map(m => <LiveCard key={m.id} match={m} group={data.groups.find(g => g.id === m.group_id)} receivedAt={receivedAt} />)}</div>
          : <div className="quiet-panel"><div className="quiet-icon"><Radio size={25} /></div><div><strong>La cancha está en pausa</strong><p>Cuando comience un partido, aparecerá aquí con su marcador y reloj en vivo.</p></div></div>}

        <div className="overview-columns">
          <section><SectionHeader kicker="A CONTINUACIÓN" title="Próximos partidos" action="Ver programación" onAction={() => setSection('schedule')} />
            <div className="stack-list">{upcoming.slice(0, 5).map(m => <CompactMatch key={m.id} match={m} />)}
              {!upcoming.length && <div className="empty-mini">No quedan partidos programados.</div>}</div></section>
          <section><SectionHeader kicker="RESULTADOS" title="Últimos finales" action="Ver todos" onAction={() => setSection('schedule')} />
            <div className="stack-list">{finished.slice(0, 5).map(m => <CompactMatch key={m.id} match={m} />)}
              {!finished.length && <div className="empty-mini">Los resultados finales aparecerán aquí.</div>}</div></section>
        </div>
        <div className="promo-panel"><div><span className="eyebrow">/// FASE DE GRUPOS</span><h2>Cada resultado<br />mueve la tabla.</h2><p>Conoce la posición actual de las promociones en los nueve grupos.</p></div><button className="button button-primary" onClick={() => setSection('groups')}>Ver tablas <ArrowRight size={17} /></button></div>
      </div>}

      {section === 'groups' && <div className="page-content">
        <SectionHeader kicker="CAMPEONATO INTERPROMOCIONES" title="Fase de grupos" count={data.groups.length} />
        <p className="section-lead">Los puntos oficiales se actualizan al finalizar cada partido. Los encuentros en curso muestran sus puntos provisionales en “En juego”.</p>
        <div className="pill-scroll" role="group" aria-label="Seleccionar grupo">{data.groups.map(g => <button key={g.id} className={`group-pill ${selectedGroup === g.id ? 'selected' : ''}`} onClick={() => setSelectedGroup(g.id)}>Grupo {g.id}</button>)}</div>
        <div className="group-layout">
          <div><StandingCard group={group} /></div>
          <div className="group-matches"><div className="inner-head"><span>ENCUENTROS DEL GRUPO</span><strong>{group.matches.length} partidos</strong></div>{group.matches.map(m => <CompactMatch key={m.id} match={m} />)}</div>
        </div>
      </div>}

      {section === 'schedule' && <div className="page-content">
        <SectionHeader kicker="LA JORNADA" title="Todos los partidos" count={all.filter(m => m.home_id && m.away_id).length} />
        <p className="section-lead">Horarios en hora de Perú. El administrador puede actualizarlos si cambia la programación.</p>
        <div className="pill-scroll" role="group" aria-label="Filtrar programación">{['Todos', 'En juego', 'Programados', 'Finalizados', ...data.groups.map(g => `Grupo ${g.id}`)].map(f => <button key={f} className={`group-pill ${scheduleFilter === f ? 'selected' : ''}`} onClick={() => setScheduleFilter(f)}>{f}</button>)}</div>
        <div className="schedule-list">{all.filter(m => m.home_id && m.away_id).filter(m => scheduleFilter === 'Todos' ||
          (scheduleFilter === 'En juego' && isLive(m)) || (scheduleFilter === 'Programados' && m.status === 'scheduled') ||
          (scheduleFilter === 'Finalizados' && m.status === 'final') || scheduleFilter === `Grupo ${m.group_id}`)
          .sort(scheduledSort).map(m => <CompactMatch key={m.id} match={m} expanded />)}</div>
      </div>}

      {section === 'bracket' && <div className="page-content">
        <SectionHeader kicker="CAMINO AL CAMPEÓN" title="Llaves finales" />
        <p className="section-lead">Los equipos de octavos se confirmarán al cerrar la fase de grupos. Cada ganador avanzará a la ronda siguiente.</p>
        <div className="bracket-scroll"><div className="bracket-grid">{(['round16', 'quarter', 'semi', 'final'] as const).map((stage, index) =>
          <div className="bracket-round" key={stage}><div className="bracket-round-title"><span>0{index + 1}</span><strong>{stageLabels[stage]}</strong></div>{data.knockout.filter(m => m.stage === stage).map(m =>
            <div className="bracket-match" key={m.id}><div className="bracket-match-label">PARTIDO {m.position + 1} <span>{statusLabels[m.status]}</span></div>
              <div className={`bracket-team ${m.winner_id && m.winner_id === m.home_id ? 'winner' : ''}`}><span>{m.home_name}</span><b>{score(m.home_score)}</b></div>
              <div className={`bracket-team ${m.winner_id && m.winner_id === m.away_id ? 'winner' : ''}`}><span>{m.away_name}</span><b>{score(m.away_score)}</b></div>
              {m.decision === 'penalties' && <small>Penales: {m.home_penalties} – {m.away_penalties}</small>}
              {m.decision === 'manual' && <small>Ganador definido por la organización</small>}</div>)}</div>)}</div></div>
        <div className="champion-banner"><Trophy size={31} /><div><span>CAMPEÓN SALESIANOS FEST 2026</span><strong>{winnerName || 'La historia se está escribiendo'}</strong></div></div>
      </div>}
    </div>
  </main>;
}

function SectionHeader({ kicker, title, count, accent, action, onAction }: { kicker: string; title: string; count?: number; accent?: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><div><span className={`eyebrow ${accent === 'pink' ? 'pink' : ''}`}><span className="slashes">///</span> {kicker}</span><h2>{title} {count !== undefined && <span className="heading-count">{count}</span>}</h2></div>{action && <button className="text-link" onClick={onAction}>{action} <ArrowRight size={16} /></button>}</div>;
}

function LiveCard({ match: m, group, receivedAt }: { match: Match; group?: Group; receivedAt: number }) {
  const homeBase = group?.table.find(t => t.id === m.home_id)?.pts || 0;
  const awayBase = group?.table.find(t => t.id === m.away_id)?.pts || 0;
  return <article className="live-card"><div className="live-card-top"><span className="live-indicator"><span className="pulse-dot" /> {statusLabels[m.status]}</span><span>{m.group_id ? `GRUPO ${m.group_id}` : stageLabels[m.stage]} · CANCHA {m.court || 'POR DEFINIR'}</span></div>
    <div className="live-scoreboard"><div className="live-team"><small>PROMOCIÓN</small><strong>{m.home_name}</strong><span className="projected-points">+{m.live_points.home} pts · total proyectado {homeBase + m.live_points.home}</span></div>
      <div className="live-score"><b>{score(m.home_score)}</b><span>:</span><b>{score(m.away_score)}</b></div>
      <div className="live-team away"><small>PROMOCIÓN</small><strong>{m.away_name}</strong><span className="projected-points">+{m.live_points.away} pts · total proyectado {awayBase + m.live_points.away}</span></div></div>
    <div className="live-card-bottom"><Clock elapsed={m.elapsed_seconds} running={m.running} receivedAt={receivedAt} /><span>Duración prevista: {m.duration_minutes} min</span></div></article>;
}

function CompactMatch({ match: m, expanded = false }: { match: Match; expanded?: boolean }) {
  const active = isLive(m);
  return <article className={`compact-match ${active ? 'is-live' : ''} ${expanded ? 'expanded' : ''}`}>
    <div className="compact-time"><strong>{timeLabel(m.scheduled_at)}</strong><small>{m.court ? `Cancha ${m.court}` : 'Cancha pendiente'}</small></div>
    <div className="compact-teams"><span>{m.home_name}</span><span className="versus">{m.status === 'scheduled' ? 'VS' : `${score(m.home_score)} : ${score(m.away_score)}`}</span><span>{m.away_name}</span></div>
    <div className={`compact-status ${active ? 'active' : ''}`}>{active && <span className="pulse-dot" />}{statusLabels[m.status]}</div>
    {expanded && <div className="compact-extra"><span><CalendarDays size={14} /> {dateLabel(m.scheduled_at)}</span><span>{m.group_id ? `Grupo ${m.group_id}` : stageLabels[m.stage]}</span>{m.decision === 'penalties' && <span>Penales {m.home_penalties}–{m.away_penalties}</span>}{m.decision === 'manual' && <span>Ganador definido por la organización</span>}</div>}
  </article>;
}

function StandingCard({ group }: { group: Group }) {
  return <article className="standing-card"><div className="standing-top"><div><span>FASE DE GRUPOS</span><h3>GRUPO {group.id}</h3></div><span>{group.teams.length} promociones · {group.matches.length} partidos</span></div>
    <div className="table-wrap"><table><thead><tr><th>#</th><th>Promoción</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th></tr></thead><tbody>{group.table.map((t, index) =>
      <tr key={t.id}><td className="rank">{index + 1}</td><td className="team-name">{t.name}</td><td>{t.pj}</td><td>{t.g}</td><td>{t.e}</td><td>{t.p}</td><td>{t.dg > 0 ? `+${t.dg}` : t.dg}</td><td className="point-cell">{t.pts}</td></tr>)}</tbody></table></div>
    <div className="standing-note"><Clock3 size={15} /> Solo se cuentan los partidos finalizados.</div></article>;
}
