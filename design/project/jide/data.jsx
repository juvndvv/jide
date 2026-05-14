// jide — mock data: projects, worktrees, claude sessions, chat history.
// Spanish, dev-tools tone. Keep terse and realistic.

const JIDE_PROJECTS = [
  {
    id: "yurest-app",
    name: "yurest-app",
    path: "~/code/yurest/yurest-app",
    expanded: true,
    worktrees: [
      { id: "yu-main",     branch: "main",                  status: "clean",      claude: "idle",     changes: 0,  ahead: 0, behind: 0, lastMsg: "Listo." },
      { id: "yu-billing",  branch: "feat/billing-v2",       status: "modified",   claude: "running",  changes: 3,  ahead: 2, behind: 0, lastMsg: "Aplicando migración a stripe_invoices…" },
      { id: "yu-scroll",   branch: "fix/scrollbar-overflow",status: "modified",   claude: "awaiting", changes: 12, ahead: 1, behind: 4, lastMsg: "¿Apruebas el cambio en App.tsx?" },
      { id: "yu-mobile",   branch: "feat/mobile-onboarding",status: "modified",   claude: "idle",     changes: 7,  ahead: 5, behind: 0, lastMsg: "Tests verdes (47/47)." },
    ],
  },
  {
    id: "jide",
    name: "jide",
    path: "~/code/jide",
    expanded: true,
    worktrees: [
      { id: "ji-main",     branch: "main",                  status: "clean",      claude: "idle",     changes: 0,  ahead: 0, behind: 0, lastMsg: "" },
      { id: "ji-kbd",      branch: "feat/keyboard-shortcuts", status: "modified", claude: "running",  changes: 5,  ahead: 1, behind: 0, lastMsg: "Probando ⌘P para palette de archivos…" },
    ],
  },
  {
    id: "internal-cms",
    name: "internal-cms",
    path: "~/code/yurest/internal-cms",
    expanded: false,
    worktrees: [
      { id: "ic-main",   branch: "main",         status: "clean",    claude: "idle", changes: 0, ahead: 0, behind: 0, lastMsg: "" },
      { id: "ic-audit",  branch: "chore/audit",  status: "modified", claude: "idle", changes: 2, ahead: 0, behind: 1, lastMsg: "" },
    ],
  },
  {
    id: "appcc-engine",
    name: "appcc-engine",
    path: "~/code/yurest/appcc-engine",
    expanded: false,
    worktrees: [
      { id: "ap-main",   branch: "main",   status: "clean", claude: "idle", changes: 0, ahead: 0, behind: 0, lastMsg: "" },
    ],
  },
];

// Active tabs — what the user has open in the tab bar.
const JIDE_INITIAL_TABS = [
  { worktreeId: "yu-billing", projectId: "yurest-app" },
  { worktreeId: "yu-scroll",  projectId: "yurest-app" },
  { worktreeId: "ji-kbd",     projectId: "jide" },
];

// Sessions per worktree. Each worktree can hold N parallel Claude Code sessions —
// each is its own process, its own conversation, its own state.
// Session: { id, title, claude: 'running'|'awaiting'|'idle'|'error', since, messages: [...] }
// Message types: 'user', 'claude', 'tool' (collapsible card), 'diff', 'system'.
const JIDE_CHATS = {
  "yu-billing": [
    {
      id: "yu-billing-s1", title: "Migración billing → invoices",
      claude: "running", since: "12 min", model: "sonnet-4.5",
      tokens: 38200, ctxPct: 42, costUsd: 0.12,
      messages: [
        { type: "user", text: "Migra `stripe_invoices` a la nueva tabla `billing.invoices` y crea índices por `restaurant_id` y `created_at`. Conserva la columna legacy `stripe_id` por compatibilidad." },
        { type: "claude", text: "Voy a:\n1. Crear la migración Postgres con los dos índices.\n2. Mover el modelo en `apps/api/src/billing/invoice.entity.ts`.\n3. Mantener `stripe_id` con un alias para no romper consumidores actuales.\n\nEmpiezo." },
        { type: "tool", name: "bash", status: "done", cmd: "git status --short", output: "M  apps/api/prisma/schema.prisma\nM  apps/api/src/billing/" },
        { type: "tool", name: "edit_file", status: "done", file: "apps/api/prisma/migrations/20260514_billing/migration.sql", lines: { added: 24, removed: 0 } },
        { type: "diff", file: "apps/api/prisma/migrations/20260514_billing/migration.sql", lines: [
          { sign: "+", text: "CREATE TABLE billing.invoices (" },
          { sign: "+", text: "  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()," },
          { sign: "+", text: "  restaurant_id uuid NOT NULL REFERENCES restaurants(id)," },
          { sign: "+", text: "  stripe_id     text UNIQUE NOT NULL," },
          { sign: "+", text: "  amount_cents  integer NOT NULL," },
          { sign: "+", text: "  currency      char(3) NOT NULL DEFAULT 'EUR'," },
          { sign: "+", text: "  created_at    timestamptz NOT NULL DEFAULT now()" },
          { sign: "+", text: ");" },
          { sign: "+", text: "CREATE INDEX idx_invoices_restaurant ON billing.invoices(restaurant_id);" },
          { sign: "+", text: "CREATE INDEX idx_invoices_created   ON billing.invoices(created_at DESC);" },
        ]},
        { type: "tool", name: "edit_file", status: "running", file: "apps/api/src/billing/invoice.entity.ts", lines: { added: 12, removed: 6 } },
        { type: "claude", text: "Migración generada. Ahora estoy aplicándola sobre la base local — espera el output del comando." },
        { type: "tool", name: "bash", status: "running", cmd: "pnpm prisma migrate dev --name billing_invoices", output: "Applying migration `20260514_billing`...\n" },
      ],
    },
    {
      id: "yu-billing-s2", title: "DTOs y tipos compartidos",
      claude: "idle", since: "1h", model: "sonnet-4.5",
      tokens: 12400, ctxPct: 14, costUsd: 0.04,
      messages: [
        { type: "user", text: "Exporta los tipos de invoice como un paquete compartido en `packages/billing-types` para que el front y los workers consuman lo mismo." },
        { type: "claude", text: "Hecho. He creado el paquete con dos exports: `Invoice` y `InvoiceStatus`. Ambos paquetes (api, web) ya están enlazados via workspace `*`." },
        { type: "tool", name: "create_file", status: "done", file: "packages/billing-types/src/index.ts", lines: { added: 32, removed: 0 } },
        { type: "tool", name: "edit_file", status: "done", file: "apps/web/package.json", lines: { added: 1, removed: 0 } },
        { type: "claude", text: "¿Quieres que rehaga el typecheck completo del monorepo o lo dejas para CI?" },
      ],
    },
    {
      id: "yu-billing-s3", title: "Tests de regresión",
      claude: "awaiting", since: "3 min", model: "sonnet-4.5",
      tokens: 9100, ctxPct: 10, costUsd: 0.03,
      messages: [
        { type: "user", text: "Genera tests de regresión que comparen el output de la nueva tabla contra `stripe_invoices` legacy para 500 facturas reales." },
        { type: "claude", text: "He creado `invoice.regression.spec.ts` con un dump anonimizado de 500 facturas. Antes de correrlo necesito permiso para acceder al snapshot — está fuera del worktree.", awaiting: true },
      ],
    },
  ],
  "yu-scroll": [
    {
      id: "yu-scroll-s1", title: "Bug · popovers recortados",
      claude: "awaiting", since: "8 min", model: "sonnet-4.5",
      tokens: 8400, ctxPct: 9, costUsd: 0.03,
      messages: [
        { type: "user", text: "Hay un bug en `App.tsx`: el contenedor principal está cortando los popovers cuando la sidebar es scrollable. ¿Puedes mirarlo?" },
        { type: "claude", text: "Encontré el problema. El wrapper de la sidebar tiene `overflow-y: auto` pero el padre no tiene `overflow: visible`, así que los popovers se recortan al borde. Te propongo este cambio:" },
        { type: "tool", name: "read_file", status: "done", file: "apps/web/src/App.tsx", lines: { read: 84 } },
        { type: "diff", file: "apps/web/src/App.tsx", lines: [
          { sign: "-", text: "  <aside className=\"sidebar overflow-auto\">" },
          { sign: "+", text: "  <aside className=\"sidebar overflow-y-auto overflow-x-visible\">" },
          { sign: " ", text: "    <ProjectTree />" },
          { sign: " ", text: "  </aside>" },
        ]},
        { type: "claude", text: "¿Aplico el cambio? Es solo una línea pero toca el shell principal — prefiero confirmar antes de tocar `App.tsx`.", awaiting: true },
      ],
    },
  ],
  "ji-kbd": [
    {
      id: "ji-kbd-s1", title: "⌘P · file palette",
      claude: "running", since: "5 min", model: "sonnet-4.5",
      tokens: 21800, ctxPct: 24, costUsd: 0.07,
      messages: [
        { type: "user", text: "Añade ⌘P para abrir un picker rápido de archivos del worktree activo. Sin fuzzy elaborado — empezamos con substring." },
        { type: "claude", text: "Añadido al hook global de atajos en `useShortcuts.ts`. He creado `FilePalette.tsx` siguiendo el mismo layout que el `CommandPalette` actual." },
        { type: "tool", name: "edit_file", status: "done", file: "src/hooks/useShortcuts.ts", lines: { added: 4, removed: 0 } },
        { type: "tool", name: "create_file", status: "done", file: "src/overlays/FilePalette.tsx", lines: { added: 87, removed: 0 } },
        { type: "tool", name: "bash", status: "running", cmd: "pnpm test --filter FilePalette", output: " RUN  v1.6.0  /Users/alex/code/jide\n  ✓ src/overlays/FilePalette.test.tsx (3)\n" },
      ],
    },
    {
      id: "ji-kbd-s2", title: "Documentar atajos",
      claude: "idle", since: "20 min", model: "haiku-4.5",
      tokens: 3200, ctxPct: 3, costUsd: 0.01,
      messages: [
        { type: "user", text: "Genera una tabla en el README con todos los atajos actuales agrupados por contexto (global, palette, chat)." },
        { type: "claude", text: "Listo. He añadido la sección `## Atajos` al README con tres tablas. Aproveché para incluir los recién añadidos ⌘P y ⌘⇧P." },
        { type: "tool", name: "edit_file", status: "done", file: "README.md", lines: { added: 38, removed: 2 } },
      ],
    },
  ],
};

// Helper: roll up a worktree's claude state from its sessions
// (running > awaiting > idle).
function jideRollupClaude(sessions) {
  if (!sessions || !sessions.length) return "idle";
  if (sessions.some((s) => s.claude === "running")) return "running";
  if (sessions.some((s) => s.claude === "awaiting")) return "awaiting";
  if (sessions.some((s) => s.claude === "error")) return "error";
  return "idle";
}

// Files visible in the (current) worktree — for the read-only viewer.
const JIDE_FILE_TREE = [
  { type: "dir",  path: "apps", expanded: true, children: [
    { type: "dir",  path: "apps/api", expanded: true, children: [
      { type: "dir",  path: "apps/api/prisma", expanded: true, children: [
        { type: "file", path: "apps/api/prisma/schema.prisma", status: "M" },
        { type: "dir",  path: "apps/api/prisma/migrations", expanded: true, children: [
          { type: "file", path: "apps/api/prisma/migrations/20260514_billing/migration.sql", status: "A" },
        ]},
      ]},
      { type: "dir",  path: "apps/api/src/billing", expanded: false, children: [
        { type: "file", path: "apps/api/src/billing/invoice.entity.ts", status: "M" },
        { type: "file", path: "apps/api/src/billing/invoice.service.ts", status: "" },
      ]},
    ]},
    { type: "dir",  path: "apps/web", expanded: false, children: [] },
  ]},
  { type: "dir",  path: "packages", expanded: false, children: [] },
  { type: "file", path: "package.json",  status: "" },
  { type: "file", path: "pnpm-lock.yaml", status: "" },
  { type: "file", path: "README.md",     status: "" },
];

// File content shown when viewer is open. Mock SQL migration — colored manually.
const JIDE_FILE_CONTENT = {
  "apps/api/prisma/migrations/20260514_billing/migration.sql": [
    "-- Migration · billing.invoices",
    "-- Generated by jide / claude · 2026-05-14",
    "",
    "CREATE SCHEMA IF NOT EXISTS billing;",
    "",
    "CREATE TABLE billing.invoices (",
    "  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),",
    "  restaurant_id uuid NOT NULL REFERENCES restaurants(id),",
    "  stripe_id     text UNIQUE NOT NULL,",
    "  amount_cents  integer NOT NULL,",
    "  currency      char(3) NOT NULL DEFAULT 'EUR',",
    "  status        text NOT NULL,",
    "  created_at    timestamptz NOT NULL DEFAULT now(),",
    "  paid_at       timestamptz",
    ");",
    "",
    "CREATE INDEX idx_invoices_restaurant ON billing.invoices(restaurant_id);",
    "CREATE INDEX idx_invoices_created    ON billing.invoices(created_at DESC);",
    "",
    "-- Compatibility: keep stripe_id alias on legacy view",
    "CREATE OR REPLACE VIEW public.stripe_invoices AS",
    "  SELECT id, stripe_id, restaurant_id, amount_cents, currency, status",
    "  FROM billing.invoices;",
  ],
};

// Terminal lines for the bottom split.
const JIDE_TERMINAL_LINES = [
  { kind: "prompt", who: "alex@mbp", path: "yurest-app/billing-v2", cmd: "pnpm prisma migrate dev --name billing_invoices" },
  { kind: "out", text: "Environment variables loaded from .env" },
  { kind: "out", text: "Prisma schema loaded from prisma/schema.prisma" },
  { kind: "out", text: "Datasource \"db\": PostgreSQL database \"yurest_dev\"" },
  { kind: "out", text: "" },
  { kind: "out", text: "Applying migration `20260514_billing`..." },
  { kind: "ok",  text: "✓ Migration applied (114ms)" },
  { kind: "out", text: "" },
  { kind: "out", text: "Running generators..." },
  { kind: "ok",  text: "✓ Generated Prisma Client (5.18.0) (123ms)" },
  { kind: "out", text: "" },
  { kind: "out", text: "Your database is now in sync with your schema. Done in 312ms" },
  { kind: "cursor" },
];

// Command palette items (⌘K).
const JIDE_PALETTE = [
  { group: "Worktrees", icon: "branch", items: [
    { id: "wt:yu-billing", title: "yurest-app · feat/billing-v2",      hint: "abrir", shortcut: "1" },
    { id: "wt:yu-scroll",  title: "yurest-app · fix/scrollbar-overflow", hint: "abrir", shortcut: "2" },
    { id: "wt:yu-mobile",  title: "yurest-app · feat/mobile-onboarding", hint: "abrir", shortcut: "3" },
    { id: "wt:ji-kbd",     title: "jide · feat/keyboard-shortcuts",     hint: "abrir", shortcut: "4" },
  ]},
  { group: "Acciones", icon: "bolt", items: [
    { id: "act:new-wt",   title: "Nuevo worktree…",                   hint: "crear desde rama", shortcut: "⌘N" },
    { id: "act:new-session", title: "Nueva sesión Claude",            hint: "en este worktree",  shortcut: "⌘T" },
    { id: "act:claude",   title: "Adjuntar sesión Claude existente",   hint: "claude code",      shortcut: "⌘L" },
    { id: "act:kill",     title: "Detener sesión Claude…",            hint: "pide confirmación", shortcut: "⌘⇧K" },
    { id: "act:toggle-term", title: "Mostrar/ocultar terminal",       hint: "split",            shortcut: "⌘\\" },
    { id: "act:viewer",   title: "Abrir visor de archivos",           hint: "read-only",        shortcut: "⌘O" },
  ]},
  { group: "Archivos", icon: "file", items: [
    { id: "f:invoice.entity",   title: "apps/api/src/billing/invoice.entity.ts", hint: "M",  shortcut: "" },
    { id: "f:migration",        title: "apps/api/prisma/migrations/20260514_billing/migration.sql", hint: "A", shortcut: "" },
    { id: "f:schema",           title: "apps/api/prisma/schema.prisma",          hint: "M",  shortcut: "" },
    { id: "f:app",              title: "apps/web/src/App.tsx",                   hint: "",   shortcut: "" },
  ]},
];

Object.assign(window, {
  JIDE_PROJECTS, JIDE_INITIAL_TABS, JIDE_CHATS,
  JIDE_FILE_TREE, JIDE_FILE_CONTENT,
  JIDE_TERMINAL_LINES, JIDE_PALETTE,
  jideRollupClaude,
});
