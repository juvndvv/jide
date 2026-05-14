// jide — terminal split (xterm.js-flavored output) + read-only file viewer.

function TerminalPanel({ theme, accent, density, lines, orientation, onClose, onToggleOrientation }) {
  return (
    <section style={{
      flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: theme.panelBg, color: theme.text,
      borderTop: orientation === "v" ? `1px solid ${theme.borderHair}` : undefined,
      borderLeft: orientation === "h" ? `1px solid ${theme.borderHair}` : undefined,
      width: orientation === "h" ? 480 : undefined,
      height: orientation === "v" ? 240 : undefined,
      minWidth: 0, minHeight: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px",
        borderBottom: `1px solid ${theme.borderHair}`,
        background: theme.panelMuted, flexShrink: 0,
      }}>
        <JIcon name="terminal" size={13} style={{ color: theme.textMed }} />
        <span style={{ fontFamily: "Geist, monospace", fontSize: 12, color: theme.text, fontWeight: 600 }}>
          zsh
        </span>
        <span style={{ color: theme.textLow }}>·</span>
        <span style={{ fontFamily: "Geist, monospace", fontSize: 12, color: theme.textLow }}>
          yurest-app/billing-v2
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: theme.textLow }}>
          <Kbd theme={theme}>⌘\</Kbd> ocultar
        </span>
        <button onClick={onToggleOrientation} title={orientation === "v" ? "Mover al lateral" : "Mover abajo"} style={iconBtn(theme)}>
          <JIcon name={orientation === "v" ? "split-v" : "split-h"} size={12} />
        </button>
        <button onClick={onClose} title="Cerrar terminal" style={iconBtn(theme)}>
          <JIcon name="x" size={12} />
        </button>
      </div>
      <div style={{
        flex: 1, overflow: "auto", padding: "10px 14px",
        fontFamily: "Geist, ui-monospace, monospace",
        fontSize: 12.5, lineHeight: 1.55,
        background: theme.codeBg, color: theme.text,
      }}>
        {lines.map((l, i) => {
          if (l.kind === "prompt") return (
            <div key={i} style={{ marginBottom: 2 }}>
              <span style={{ color: accent.value, fontWeight: 600 }}>{l.who}</span>
              <span style={{ color: theme.textMed }}> in </span>
              <span style={{ color: theme.success, fontWeight: 600 }}>{l.path}</span>
              <br/>
              <span style={{ color: accent.value }}>$ </span>
              <span style={{ color: theme.text }}>{l.cmd}</span>
            </div>
          );
          if (l.kind === "ok") return <div key={i} style={{ color: theme.success }}>{l.text}</div>;
          if (l.kind === "err") return <div key={i} style={{ color: theme.error }}>{l.text}</div>;
          if (l.kind === "cursor") return <span key={i} style={{ display: "inline-block", width: 8, height: 14, background: theme.text, animation: "jideBlink 1s steps(2) infinite", verticalAlign: "text-bottom" }} />;
          return <div key={i} style={{ color: theme.textMed }}>{l.text}</div>;
        })}
      </div>
    </section>
  );
}

function FileViewerPanel({ theme, accent, density, tree, openPath, content, onSelect, onClose }) {
  return (
    <section style={{
      flexShrink: 0, width: 380,
      display: "flex", flexDirection: "column",
      background: theme.panelBg, color: theme.text,
      borderLeft: `1px solid ${theme.borderHair}`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderBottom: `1px solid ${theme.borderHair}`,
        background: theme.panelMuted, flexShrink: 0,
      }}>
        <JIcon name="eye" size={13} style={{ color: theme.textMed }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>Visor</span>
        <span style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 4,
          background: theme.panelBg, color: theme.textMed,
          border: `1px solid ${theme.borderHair}`, fontFamily: "Geist, monospace",
        }}>read-only</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} title="Cerrar visor" style={iconBtn(theme)}>
          <JIcon name="x" size={12} />
        </button>
      </div>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      }}>
        {/* Mini tree */}
        <div style={{
          flex: "0 0 38%", overflow: "auto",
          padding: "6px 4px", borderBottom: `1px solid ${theme.borderHair}`,
          fontFamily: "Geist, monospace", fontSize: 12,
        }}>
          {tree.map((n) => <FileNode key={n.path} n={n} depth={0} theme={theme} accent={accent} openPath={openPath} onSelect={onSelect} />)}
        </div>
        {/* Content */}
        <div style={{
          flex: 1, overflow: "auto",
          background: theme.codeBg,
          fontFamily: "Geist, ui-monospace, monospace", fontSize: 12, lineHeight: 1.6,
          padding: "10px 0",
          minHeight: 0,
        }}>
          {content ? content.map((line, i) => (
            <div key={i} style={{ display: "flex", padding: "0 14px 0 0" }}>
              <span style={{
                width: 38, paddingRight: 12, textAlign: "right",
                color: theme.textLow, userSelect: "none", flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}>{i + 1}</span>
              <span style={{ color: colorizeSQL(line, theme), whiteSpace: "pre", flex: 1 }}>
                {tokenizeSQL(line, theme)}
              </span>
            </div>
          )) : (
            <div style={{ padding: 20, color: theme.textLow, textAlign: "center" }}>
              Selecciona un archivo del árbol
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FileNode({ n, depth, theme, accent, openPath, onSelect }) {
  const isOpen = !!n.expanded;
  if (n.type === "dir") {
    return (
      <div>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "2px 6px", paddingLeft: 8 + depth * 14,
          color: theme.textMed, cursor: "pointer",
        }}>
          <JIcon name={isOpen ? "chev-d" : "chev-r"} size={10} style={{ color: theme.textLow }} />
          <JIcon name={isOpen ? "folder-open" : "folder"} size={11} style={{ color: theme.textMed }} />
          <span>{n.path.split("/").pop()}</span>
        </div>
        {isOpen && n.children.map((c) => (
          <FileNode key={c.path} n={c} depth={depth + 1} theme={theme} accent={accent} openPath={openPath} onSelect={onSelect} />
        ))}
      </div>
    );
  }
  const active = n.path === openPath;
  return (
    <button onClick={() => onSelect(n.path)} style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "2px 8px", paddingLeft: 8 + depth * 14,
      width: "100%", textAlign: "left",
      border: 0, background: active ? accent.value + "14" : "transparent",
      color: active ? accent.value : theme.text,
      cursor: "pointer", fontFamily: "inherit", fontSize: "inherit",
    }}>
      <span style={{ width: 10, flexShrink: 0 }} />
      <JIcon name="file" size={11} style={{ color: active ? accent.value : theme.textLow }} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {n.path.split("/").pop()}
      </span>
      {n.status && (
        <span style={{
          fontSize: 10, color: n.status === "A" ? theme.diffAddText : n.status === "M" ? theme.warning : theme.textLow,
          fontWeight: 700,
        }}>{n.status}</span>
      )}
    </button>
  );
}

// Lightweight SQL syntax tokenizer for display.
const SQL_KEYWORDS = new Set("CREATE,TABLE,INDEX,VIEW,SCHEMA,IF,NOT,EXISTS,PRIMARY,KEY,REFERENCES,UNIQUE,DEFAULT,DESC,SELECT,FROM,OR,REPLACE,ON".split(","));
const SQL_TYPES = new Set("uuid,text,integer,char,timestamptz,boolean,jsonb".split(","));
function tokenizeSQL(line, theme) {
  if (line.startsWith("--")) return <span style={{ color: theme.textLow, fontStyle: "italic" }}>{line}</span>;
  // simple split on words/punctuation
  const re = /([A-Za-z_]+|'[^']*'|[(),;]|\s+)/g;
  const out = [];
  let m, idx = 0, key = 0;
  while ((m = re.exec(line)) !== null) {
    const tok = m[0];
    if (/^\s+$/.test(tok)) { out.push(<span key={key++}>{tok}</span>); continue; }
    if (/^'.*'$/.test(tok)) { out.push(<span key={key++} style={{ color: theme.diffAddText }}>{tok}</span>); continue; }
    if (SQL_KEYWORDS.has(tok.toUpperCase())) { out.push(<span key={key++} style={{ color: theme.info, fontWeight: 600 }}>{tok}</span>); continue; }
    if (SQL_TYPES.has(tok.toLowerCase())) { out.push(<span key={key++} style={{ color: theme.warning }}>{tok}</span>); continue; }
    if (/^[(),;]$/.test(tok)) { out.push(<span key={key++} style={{ color: theme.textMed }}>{tok}</span>); continue; }
    out.push(<span key={key++} style={{ color: theme.text }}>{tok}</span>);
  }
  return out;
}
function colorizeSQL() { return undefined; }

function iconBtn(theme) {
  return {
    width: 22, height: 22, borderRadius: 4,
    border: 0, background: "transparent", color: theme.textMed,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", padding: 0,
  };
}

Object.assign(window, { TerminalPanel, FileViewerPanel });
