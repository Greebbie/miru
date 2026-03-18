import { ipcMain } from 'electron';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const nativeRequire = createRequire(fileURLToPath(import.meta.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export function setupMemoryDb(dbPath: string): DB {
  const Database = nativeRequire('better-sqlite3');
  const db: DB = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // --- Schema ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      summary TEXT NOT NULL,
      user_intent TEXT,
      tools_used TEXT,
      outcome TEXT DEFAULT 'success'
    );

    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source_episode_id INTEGER,
      created_at INTEGER NOT NULL,
      last_accessed INTEGER,
      access_count INTEGER DEFAULT 0
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(content, category);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      params TEXT,
      result_success INTEGER,
      result_summary TEXT,
      duration_ms INTEGER
    );
  `);

  // --- Prepared statements ---
  const stmts = {
    upsertIdentity: db.prepare(
      `INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)`
    ),
    getAllIdentity: db.prepare(`SELECT key, value FROM identity`),

    upsertPreference: db.prepare(
      `INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)`
    ),
    getAllPreferences: db.prepare(`SELECT key, value FROM preferences`),

    addEpisode: db.prepare(
      `INSERT INTO episodes (timestamp, summary, user_intent, tools_used, outcome) VALUES (?, ?, ?, ?, ?)`
    ),
    pruneEpisodes: db.prepare(
      `DELETE FROM episodes WHERE id NOT IN (SELECT id FROM episodes ORDER BY timestamp DESC LIMIT 200)`
    ),
    getEpisodes: db.prepare(
      `SELECT * FROM episodes ORDER BY timestamp DESC LIMIT ?`
    ),

    addFact: db.prepare(
      `INSERT INTO facts (category, content, confidence, source_episode_id, created_at, last_accessed, access_count) VALUES (?, ?, ?, ?, ?, ?, 0)`
    ),
    addFactFts: db.prepare(
      `INSERT INTO facts_fts (rowid, content, category) VALUES (?, ?, ?)`
    ),
    searchFacts: db.prepare(
      `SELECT f.* FROM facts_fts ft JOIN facts f ON ft.rowid = f.id WHERE facts_fts MATCH ? LIMIT ?`
    ),
    findExactFact: db.prepare(
      `SELECT id FROM facts WHERE category = ? AND content = ? LIMIT 1`
    ),
    updateFactAccess: db.prepare(
      `UPDATE facts SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?`
    ),
    getRecentFacts: db.prepare(
      `SELECT * FROM facts ORDER BY last_accessed DESC NULLS LAST LIMIT ?`
    ),

    addAudit: db.prepare(
      `INSERT INTO audit_log (timestamp, tool_name, params, result_success, result_summary, duration_ms) VALUES (?, ?, ?, ?, ?, ?)`
    ),
    pruneAudit: db.prepare(
      `DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY timestamp DESC LIMIT 1000)`
    ),
    clearAudit: db.prepare(`DELETE FROM audit_log`),
  };

  // --- IPC handlers ---

  ipcMain.handle('memory-upsert-identity', (_e, key: string, value: string) => {
    stmts.upsertIdentity.run(key, value, Date.now());
  });

  ipcMain.handle('memory-get-identity', () => {
    const rows = stmts.getAllIdentity.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  });

  ipcMain.handle('memory-upsert-preference', (_e, key: string, value: string) => {
    stmts.upsertPreference.run(key, value, Date.now());
  });

  ipcMain.handle('memory-get-preferences', () => {
    const rows = stmts.getAllPreferences.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  });

  ipcMain.handle('memory-add-episode', (_e, episode: {
    timestamp?: number;
    summary: string;
    userIntent?: string;
    user_intent?: string;
    toolsUsed?: string;
    tools_used?: string;
    outcome?: string;
  }) => {
    stmts.addEpisode.run(
      episode.timestamp ?? Date.now(),
      episode.summary,
      episode.userIntent ?? episode.user_intent ?? null,
      episode.toolsUsed ?? episode.tools_used ?? null,
      episode.outcome ?? 'success'
    );
    stmts.pruneEpisodes.run();
  });

  ipcMain.handle('memory-get-episodes', (_e, limit: number = 50) => {
    return stmts.getEpisodes.all(limit);
  });

  ipcMain.handle('memory-add-fact', (_e, fact: {
    category: string;
    content: string;
    confidence?: number;
    sourceEpisodeId?: number;
    source_episode_id?: number;
  }) => {
    // Dedup: check if exact same fact already exists
    const existing = stmts.findExactFact.get(fact.category, fact.content) as { id: number } | undefined;
    if (existing) {
      stmts.updateFactAccess.run(Date.now(), existing.id);
      return existing.id;
    }

    const now = Date.now();
    const info = stmts.addFact.run(
      fact.category,
      fact.content,
      fact.confidence ?? 1.0,
      fact.sourceEpisodeId ?? fact.source_episode_id ?? null,
      now,
      now
    );
    stmts.addFactFts.run(info.lastInsertRowid, fact.content, fact.category);
    return info.lastInsertRowid;
  });

  ipcMain.handle('memory-search-facts', (_e, query: string, limit: number = 10) => {
    const rows = stmts.searchFacts.all(query, limit) as { id: number }[];
    const now = Date.now();
    for (const row of rows) {
      stmts.updateFactAccess.run(now, row.id);
    }
    return rows;
  });

  ipcMain.handle('memory-get-recent-facts', (_e, limit: number = 20) => {
    return stmts.getRecentFacts.all(limit);
  });

  ipcMain.handle('memory-add-audit', (_e, entry: {
    timestamp?: number;
    toolName?: string;
    tool_name?: string;
    params?: string;
    resultSuccess?: boolean;
    result_success?: boolean;
    resultSummary?: string;
    result_summary?: string;
    durationMs?: number;
    duration_ms?: number;
  }) => {
    stmts.addAudit.run(
      entry.timestamp ?? Date.now(),
      entry.toolName ?? entry.tool_name ?? 'unknown',
      entry.params ?? null,
      (entry.resultSuccess ?? entry.result_success) === undefined ? null : (entry.resultSuccess ?? entry.result_success) ? 1 : 0,
      entry.resultSummary ?? entry.result_summary ?? null,
      entry.durationMs ?? entry.duration_ms ?? null
    );
    stmts.pruneAudit.run();
  });

  ipcMain.handle('memory-get-audit', (_e, filter?: {
    tool_name?: string;
    success?: boolean;
    limit?: number;
  }) => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.tool_name) {
      conditions.push('tool_name = ?');
      params.push(filter.tool_name);
    }
    if (filter?.success !== undefined) {
      conditions.push('result_success = ?');
      params.push(filter.success ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter?.limit ?? 100;
    const sql = `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('memory-clear-audit', () => {
    stmts.clearAudit.run();
  });

  // --- Migration from JSON ---

  ipcMain.handle('memory-migrate-from-json', (_e, data: {
    identity?: Record<string, string>;
    preferences?: Record<string, string>;
    episodes?: Array<{
      timestamp?: number;
      summary: string;
      user_intent?: string;
      tools_used?: string;
      outcome?: string;
    }>;
  }) => {
    const migrate = db.transaction(() => {
      const now = Date.now();

      if (data.identity) {
        for (const [key, value] of Object.entries(data.identity)) {
          stmts.upsertIdentity.run(key, value, now);
        }
      }

      if (data.preferences) {
        for (const [key, value] of Object.entries(data.preferences)) {
          stmts.upsertPreference.run(key, value, now);
        }
      }

      if (data.episodes) {
        for (const ep of data.episodes) {
          stmts.addEpisode.run(
            ep.timestamp ?? now,
            ep.summary,
            ep.user_intent ?? null,
            ep.tools_used ?? null,
            ep.outcome ?? 'success'
          );
        }
        stmts.pruneEpisodes.run();
      }
    });

    migrate();
    return { success: true };
  });

  return db;
}
