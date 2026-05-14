// jide — Claude Code chat output panel (dominant view).
// Each worktree holds N parallel sessions; the SessionStrip at top switches
// between them and lets the user open new ones / close idle ones.
// Message types: 'user', 'claude', 'tool' (collapsible), 'diff', 'system'.

function ClaudeChat({
  theme, accent, density,
  sessions, activeSessionId,
  onSelectSession, onCloseSession, onNewSession,
  onAsk, onKill,
}) {
  const active = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  if (!active) return <EmptySessions theme={theme} accent={accent} onNewSession={onNewSession} />;
  const messages = active.messages || [];
  const awaitingApprove = active.claude === "awaiting";

  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active.id, messages.length]);

  return (
    <section style={{
      flex: 1, minWidth: 0, minHeight: 0,
      display: "flex", flexDirection: "column",
      background: theme.panelBg, color: theme.text,
    }}>
      <SessionStrip theme={theme} accent={accent}
        sessions={sessions} activeId={active.id}
        onSelect={onSelectSession}
        onClose={onCloseSession}
        onNew={onNewSession} />
      <SessionMeta theme={theme} accent={accent} session={active} onKill={onKill} />

      <div ref={scrollRef} style={{
        flex: 1, overflow: "auto",
        padding: "20px 24px 12px",
        display: "flex", flexDirection: "column", gap: density.gap * 2 + 4,
      }}>
        {messages.map((m, i) => <Msg key={i} m={m} theme={theme} accent={accent} density={density} />)}
        {active.claude === "running" && <StreamingIndicator theme={theme} accent={accent} />}
        {awaitingApprove && <ApprovalBar theme={theme} accent={accent} />}
      </div>

      <Composer theme={theme} accent={accent} density={density} onAsk={onAsk} session={active} />
    </section>
  );
}

// Strip of session tabs (chips) for the active worktree. Active chip has an
// accent underline + slight lift; idle chips fade close X until hover.
function SessionStrip({ theme, accent, sessions, activeId, onSelect, onClose, onNew }) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: theme.panelMuted,
      borderBottom: `1px solid ${theme.borderHair}`,
      paddingLeft: 12, paddingRight: 6,
      flexShrink: 0,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "stretch", flex: 1,
        overflowX: "auto", gap: 4, paddingTop: 6, paddingBottom: 0,
      }}>
        {sessions.map((s) => (
          <SessionChip key={s.id} s={s} theme={theme} accent={accent}
            active={s.id === activeId}
            onSelect={() => onSelect(s.id)}
            onClose={() => onClose(s.id)} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, paddingTop: 6 }}>
        <button onClick={onNew} title="Nueva sesión Claude (⌘T)" style={{
          height: 26, width: 26, borderRadius: 6,
          border: 0, background: "transparent", color: theme.textMed,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}>
          <JIcon name="plus" size={13} />
        </button>
      </div>
    </div>
  );
}

function SessionChip({ s, theme, accent, active, onSelect, onClose }) {
  const [hover, setHover] = React.useState(false);
  const [hoverX, setHoverX] = React.useState(false);
  const bg = active ? theme.panelBg : (hover ? theme.hoverBg : "transparent");
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      style={{
        position: "relative",
        display: "inline-flex", alignItems: "center", gap: 7,
        height: 30, padding: "0 10px",
        borderRadius: "6px 6px 0 0",
        background: bg,
        border: `1px solid ${active ? theme.borderHair : "transparent"}`,
        borderBottom: active ? `1px solid ${theme.panelBg}` : "1px solid transparent",
        marginBottom: -1,
        cursor: "pointer",
        fontSize: 12.5,
        color: active ? theme.text : theme.textMed,
        fontWeight: active ? 600 : 500,
        maxWidth: 240, minWidth: 130,
      }}>
      {active && (
        <span style={{
          position: "absolute", left: 8, right: 8, top: 0, height: 2,
          background: accent.value, borderRadius: 1,
        }} />
      )}
      <StatusDot state={s.claude} accent={accent} size={6} />
      <span style={{
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{s.title}</span>
      <button
        onMouseEnter={() => setHoverX(true)} onMouseLeave={() => setHoverX(false)}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Cerrar sesión"
        style={{
          width: 16, height: 16, borderRadius: 4,
          border: 0, background: hoverX ? theme.selectedBg : "transparent",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: theme.textMed, cursor: "pointer", padding: 0,
          opacity: hover || active ? 1 : 0,
          transition: "opacity 120ms ease",
        }}>
        <JIcon name="x" size={10} />
      </button>
    </div>
  );
}

function SessionMeta({ theme, accent, session, onKill }) {
  const stateLabel = {
    running: "Sesión activa", awaiting: "Esperando confirmación",
    idle: "En reposo", error: "Error",
  }[session.claude] || session.claude;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 20px", borderBottom: `1px solid ${theme.borderHair}`,
      flexShrink: 0, background: theme.panelBg,
    }}>
      <JIcon name="claude" size={14} style={{ color: accent.value }} />
      <div style={{ fontFamily: "Geist, ui-monospace, monospace", fontSize: 12, color: theme.text, fontWeight: 600 }}>
        claude-{session.model || "sonnet-4.5"}
      </div>
      <span style={{ color: theme.textLow }}>·</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: theme.textMed, fontSize: 12 }}>
        <StatusDot state={session.claude} accent={accent} />
        <span>{stateLabel}</span>
        {session.since && <span style={{ color: theme.textLow }}>· {session.since}</span>}
      </div>
      <div style={{ flex: 1 }} />
      <Stat theme={theme} label="ctx" value={`${session.ctxPct ?? 0}%`} />
      <Stat theme={theme} label="tok" value={fmtTokens(session.tokens || 0)} />
      <Stat theme={theme} label="$" value={(session.costUsd ?? 0).toFixed(2)} />
      <button onClick={onKill} title="Detener sesión (⌘⇧K)" style={{
        height: 24, padding: "0 9px", marginLeft: 4,
        display: "inline-flex", alignItems: "center", gap: 5,
        borderRadius: 5, border: `1px solid ${theme.border}`,
        background: "transparent", color: theme.textMed,
        cursor: "pointer", fontSize: 11.5, fontFamily: "inherit",
      }}>
        <JIcon name="stop" size={10} />
        Detener
      </button>
    </div>
  );
}

function fmtTokens(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function EmptySessions({ theme, accent, onNewSession }) {
  return (
    <section style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: theme.panelBg, color: theme.text, padding: 40,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: accent.darkBg || accent.bgDim, color: accent.value,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Bowlby One SC, sans-serif", fontSize: 26, marginBottom: 18,
      }}>C</div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Sin sesiones abiertas en este worktree</div>
      <div style={{ fontSize: 13, color: theme.textMed, marginBottom: 18, textAlign: "center", maxWidth: 360 }}>
        Cada worktree puede sostener varias sesiones Claude en paralelo — una por tarea.
      </div>
      <button onClick={onNewSession} style={{
        height: 36, padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 8,
        borderRadius: 8, background: accent.value, color: "#fff", border: 0,
        cursor: "pointer", fontSize: 13, fontWeight: 600,
      }}>
        <JIcon name="plus" size={13} />
        Lanzar sesión Claude
      </button>
    </section>
  );
}

function Stat({ theme, label, value }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: 4,
      fontFamily: "Geist, ui-monospace, monospace", fontSize: 11,
      color: theme.textLow,
    }}>
      <span>{label}</span>
      <span style={{ color: theme.textMed, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function Msg({ m, theme, accent, density }) {
  if (m.type === "user") return <UserMsg m={m} theme={theme} accent={accent} />;
  if (m.type === "claude") return <ClaudeMsg m={m} theme={theme} accent={accent} />;
  if (m.type === "tool") return <ToolCard m={m} theme={theme} accent={accent} />;
  if (m.type === "diff") return <DiffCard m={m} theme={theme} accent={accent} />;
  if (m.type === "system") return <SystemMsg m={m} theme={theme} />;
  return null;
}

function UserMsg({ m, theme }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <div style={{
        maxWidth: "78%", padding: "10px 14px",
        background: theme.panelMuted,
        border: `1px solid ${theme.borderHair}`, borderRadius: 12,
        borderTopRightRadius: 4,
        fontSize: 14, lineHeight: 1.55, color: theme.text,
        whiteSpace: "pre-wrap",
      }}>{m.text}</div>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: theme.panelMuted, border: `1px solid ${theme.borderHair}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: theme.textMed, marginTop: 2,
      }}>
        <JIcon name="user" size={14} />
      </div>
    </div>
  );
}

function ClaudeMsg({ m, theme, accent }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: accent.darkBg || accent.bgDim, color: accent.value,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Bowlby One SC, sans-serif", fontSize: 13, marginTop: 2,
      }}>C</div>
      <div style={{
        flex: 1, maxWidth: "100%",
        fontSize: 14, lineHeight: 1.6, color: theme.text,
        whiteSpace: "pre-wrap",
      }}>{m.text}</div>
    </div>
  );
}

function SystemMsg({ m, theme }) {
  return (
    <div style={{
      fontFamily: "Geist, monospace", fontSize: 11, color: theme.textLow,
      padding: "4px 0", textAlign: "center",
    }}>— {m.text} —</div>
  );
}

function ToolCard({ m, theme, accent }) {
  const [open, setOpen] = React.useState(false);
  const statusColor = {
    done: theme.success, running: accent.value, error: theme.error,
  }[m.status] || theme.textLow;
  const title = m.file || m.cmd || m.name;
  return (
    <div style={{ marginLeft: 38 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: 8,
        border: `1px solid ${theme.borderHair}`, background: theme.panelMuted,
        color: theme.text, cursor: "pointer", textAlign: "left",
        fontFamily: "inherit", fontSize: 13,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: statusColor,
          animation: m.status === "running" ? "jidePulse 1.4s ease-out infinite" : "none",
          flexShrink: 0,
        }} />
        <JIcon name={
          m.name === "bash" || m.name === "shell" ? "terminal" :
          m.name === "read_file" ? "eye" :
          m.name === "edit_file" || m.name === "create_file" ? "file-code" :
          "wrench"
        } size={13} style={{ color: theme.textMed }} />
        <span style={{
          fontFamily: "Geist, monospace", fontWeight: 600, color: theme.text,
        }}>{m.name}</span>
        <span style={{
          fontFamily: "Geist, monospace", fontSize: 12, color: theme.textMed,
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</span>
        {m.lines && (
          <span style={{ fontFamily: "Geist, monospace", fontSize: 11, color: theme.textLow }}>
            {m.lines.added != null && <span style={{ color: theme.diffAddText }}>+{m.lines.added}</span>}
            {m.lines.added != null && m.lines.removed != null && <span style={{ margin: "0 4px", color: theme.textLow }}>·</span>}
            {m.lines.removed != null && <span style={{ color: theme.diffDelText }}>−{m.lines.removed}</span>}
            {m.lines.read != null && <span>read {m.lines.read}</span>}
          </span>
        )}
        <JIcon name={open ? "chev-d" : "chev-r"} size={12} style={{ color: theme.textLow }} />
      </button>
      {open && (m.output || m.cmd) && (
        <pre style={{
          margin: "4px 0 0", padding: "10px 12px",
          background: theme.codeBg, borderRadius: 8, border: `1px solid ${theme.borderHair}`,
          fontFamily: "Geist, ui-monospace, monospace", fontSize: 12,
          color: theme.textMed, lineHeight: 1.5, whiteSpace: "pre-wrap",
          overflowX: "auto",
        }}>{m.cmd ? `$ ${m.cmd}\n${m.output || ""}` : m.output}</pre>
      )}
    </div>
  );
}

function DiffCard({ m, theme }) {
  return (
    <div style={{
      marginLeft: 38,
      border: `1px solid ${theme.borderHair}`, borderRadius: 8, overflow: "hidden",
      background: theme.codeBg,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px",
        background: theme.panelMuted,
        borderBottom: `1px solid ${theme.borderHair}`,
        fontFamily: "Geist, monospace", fontSize: 12, color: theme.textMed,
      }}>
        <JIcon name="diff" size={12} style={{ color: theme.textLow }} />
        <span style={{ color: theme.text, fontWeight: 600 }}>{m.file}</span>
      </div>
      <div style={{ fontFamily: "Geist, ui-monospace, monospace", fontSize: 12, lineHeight: 1.55 }}>
        {m.lines.map((ln, i) => {
          const bg = ln.sign === "+" ? theme.diffAddBg
                   : ln.sign === "-" ? theme.diffDelBg
                   : "transparent";
          const fg = ln.sign === "+" ? theme.diffAddText
                   : ln.sign === "-" ? theme.diffDelText
                   : theme.textMed;
          return (
            <div key={i} style={{
              display: "flex", padding: "0 12px",
              background: bg, color: fg,
            }}>
              <span style={{ width: 14, color: fg, opacity: 0.8 }}>{ln.sign}</span>
              <span style={{ flex: 1, whiteSpace: "pre" }}>{ln.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StreamingIndicator({ theme, accent }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: -4 }}>
      <div style={{ width: 28, flexShrink: 0 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: theme.textLow, fontSize: 12 }}>
        <span style={{ display: "inline-flex", gap: 3 }}>
          {[0,1,2].map((i) => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: 999, background: accent.value,
              animation: `jideBounce 1s ${i*0.12}s infinite ease-in-out`,
              display: "inline-block",
            }} />
          ))}
        </span>
        <span style={{ fontFamily: "Geist, monospace" }}>generando…</span>
      </div>
    </div>
  );
}

function ApprovalBar({ theme, accent }) {
  return (
    <div style={{
      marginLeft: 38,
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 8,
      background: theme.warning + "14",
      border: `1px solid ${theme.warning}40`,
      color: theme.text, fontSize: 13,
    }}>
      <JIcon name="warning" size={14} style={{ color: theme.warning }} />
      <span style={{ flex: 1 }}>Claude espera tu aprobación para editar <code style={{
        fontFamily: "Geist, monospace", fontSize: 12, padding: "1px 5px", borderRadius: 4,
        background: theme.codeBg, border: `1px solid ${theme.borderHair}`,
      }}>apps/web/src/App.tsx</code></span>
      <button style={{
        height: 26, padding: "0 10px", borderRadius: 6,
        background: "transparent", color: theme.text,
        border: `1px solid ${theme.border}`, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12,
      }}>Rechazar</button>
      <button style={{
        height: 26, padding: "0 12px", borderRadius: 6,
        background: accent.value, color: "#fff", border: 0,
        cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
      }}>Aprobar <Kbd theme={{...theme, panelMuted: "rgba(255,255,255,0.16)", textMed: "#fff", border: "rgba(255,255,255,0.25)"}}>⏎</Kbd></button>
    </div>
  );
}

function Composer({ theme, accent, density, onAsk, session }) {
  const [text, setText] = React.useState("");
  const submit = () => { if (text.trim()) { onAsk?.(text.trim()); setText(""); } };
  const ph = session?.claude === "running"
    ? "Envía otra instrucción a esta sesión…"
    : session?.claude === "awaiting"
    ? "Responde a Claude o pídele otra cosa…"
    : "Pídele a Claude…   ⌘⏎ para enviar";
  return (
    <div style={{
      padding: "12px 20px 16px",
      borderTop: `1px solid ${theme.borderHair}`,
      background: theme.panelBg, flexShrink: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 10,
        background: theme.inputBg, border: `1px solid ${theme.border}`,
        borderRadius: 12, padding: "10px 12px",
      }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
          placeholder={ph}
          rows={2}
          style={{
            flex: 1, resize: "none", border: 0, outline: 0,
            background: "transparent", color: theme.text,
            fontFamily: "inherit", fontSize: 14, lineHeight: 1.5,
            minHeight: 40, maxHeight: 120,
          }} />
        <button onClick={submit} style={{
          height: 32, padding: "0 12px",
          display: "inline-flex", alignItems: "center", gap: 6,
          borderRadius: 8, background: accent.value, color: "#fff", border: 0,
          cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
        }}>
          <JIcon name="send" size={13} />
          Enviar
        </button>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginTop: 8, fontSize: 11, color: theme.textLow,
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <JIcon name="bolt" size={10} /> auto-apply
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <JIcon name="check" size={10} /> tests al guardar
        </span>
        <div style={{ flex: 1 }} />
        <span><Kbd theme={theme}>⌘T</Kbd> nueva sesión</span>
        <span><Kbd theme={theme}>⌘⏎</Kbd> enviar</span>
      </div>
    </div>
  );
}

Object.assign(window, { ClaudeChat });
