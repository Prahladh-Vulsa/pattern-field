/* ============================================================
   Pattern Field — script.js
   ============================================================ */

/* ── Constants ── */
const STORAGE_KEY = 'patternFieldData';
const WINDOW_DAYS = 30;           // days shown in the dot grid

/* ── Data Model
 *
 * patterns: Array<{
 *   id:           string,          // unique identifier
 *   name:         string,          // behavior label
 *   observations: Array<{
 *     date:  string,               // "YYYY-MM-DD"
 *     value: 1 | 0                 // intentional = 1, none = 0
 *   }>
 * }>
 *
 * Missing days are not stored — absence implies 0.
 * ────────────────────────────────────────────────────────── */

/* ── Persistence ── */

function loadData() {
   try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isValidPattern) : [];
   } catch {
      return [];
   }
}

function saveData(data) {
   localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * isValidPattern(p)
 * Returns true if p conforms to the expected pattern schema.
 * Used to validate both localStorage reads and JSON imports.
 */
function isValidPattern(p) {
   return (
      p !== null &&
      typeof p === 'object' &&
      typeof p.id === 'string' && p.id.trim().length > 0 &&
      typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 100 &&
      Array.isArray(p.observations) &&
      p.observations.every(o =>
         o !== null &&
         typeof o === 'object' &&
         typeof o.date === 'string' &&
         /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
         (o.value === 0 || o.value === 1)
      )
   );
}

/* ── Utilities ── */

/**
 * generateId()
 * Produces a short unique string. Uses crypto.randomUUID when available,
 * falls back to timestamp + random suffix.
 */
function generateId() {
   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
   }
   return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * todayISO()
 * Returns today's local date as "YYYY-MM-DD".
 */
function todayISO() {
   const d = new Date();
   const y = d.getFullYear();
   const m = String(d.getMonth() + 1).padStart(2, '0');
   const day = String(d.getDate()).padStart(2, '0');
   return `${y}-${m}-${day}`;
}

/**
 * windowDates(n)
 * Returns an ordered array of the last n date strings ("YYYY-MM-DD"),
 * ending with today.
 */
function windowDates(n) {
   const dates = [];
   const today = new Date();
   for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
   }
   return dates;
}

/* ── Calculations ── */

/**
 * currentRun(pattern)
 * Returns the number of consecutive days ending on today where value = 1.
 * A missing day counts as 0 and breaks the run.
 *
 * @param  {object} pattern
 * @returns {number}
 */
function currentRun(pattern) {
   const obsMap = {};
   for (const obs of pattern.observations) {
      obsMap[obs.date] = obs.value;
   }

   let run = 0;
   const base = new Date();

   for (let i = 0; i < 3650; i++) {   // cap at 10-year lookback
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${day}`;

      if (!(iso in obsMap) || obsMap[iso] !== 1) break;
      run++;
   }

   return run;
}

/**
 * recurrenceRatio(pattern)
 * Returns the proportion of days with value=1 in the last WINDOW_DAYS days.
 * Missing days count as 0.
 * Result is a decimal between 0 and 1 (e.g. 15 days out of 30 → 0.5).
 *
 * @param  {object} pattern
 * @returns {number}  0 – 1
 */
function recurrenceRatio(pattern) {
   const obsMap = {};
   for (const obs of pattern.observations) {
      obsMap[obs.date] = obs.value;
   }

   const dates = windowDates(WINDOW_DAYS);
   let count = 0;

   for (const date of dates) {
      if (obsMap[date] === 1) count++;
   }

   return count / WINDOW_DAYS;
}

/**
 * longestStreak(pattern)
 * Returns the longest consecutive run of value=1 within the last WINDOW_DAYS.
 * Missing days count as 0 and break the streak.
 *
 * @param  {object} pattern
 * @returns {number}
 */
function longestStreak(pattern) {
   const obsMap = {};
   for (const obs of pattern.observations) {
      obsMap[obs.date] = obs.value;
   }

   const dates = windowDates(WINDOW_DAYS);
   let max = 0;
   let current = 0;

   for (const date of dates) {
      if (obsMap[date] === 1) {
         current++;
         if (current > max) max = current;
      } else {
         current = 0;
      }
   }

   return max;
}

/* ── Action Registration ── */

/**
 * registerAction(id)
 * Records today as value=1 for the given pattern.
 * Idempotent: if an observation for today already exists, does nothing.
 *
 * @param {string} id — pattern id
 */
function registerAction(id) {
   const pattern = patterns.find(p => p.id === id);
   if (!pattern) return;

   const today = todayISO();
   const exists = pattern.observations.some(o => o.date === today);
   if (exists) return;

   pattern.observations.push({ date: today, value: 1 });
   saveData(patterns);
   renderPatterns();
}

/**
 * deletePattern(id)
 * Removes the pattern with the given id from the in-memory array,
 * persists the change, and re-renders both views.
 *
 * @param {string} id
 */
function deletePattern(id) {
   const index = patterns.findIndex(p => p.id === id);
   if (index === -1) return;
   patterns.splice(index, 1);
   saveData(patterns);
   renderPatterns();
   renderAnalytics();
}

/**
 * renamePattern(id, newName)
 * Updates the name of the pattern with the given id, persists the change,
 * and re-renders both views.
 *
 * @param {string} id
 * @param {string} newName
 */
function renamePattern(id, newName) {
   const trimmed = newName.trim();
   if (!trimmed) return;
   const pattern = patterns.find(p => p.id === id);
   if (!pattern) return;
   pattern.name = trimmed;
   saveData(patterns);
   renderPatterns();
   renderAnalytics();
}

/* ── Pattern Creation ── */

/**
 * createPattern(name)
 * Builds a new pattern object with an empty observations array,
 * appends it to the in-memory array, and persists to localStorage.
 *
 * @param  {string} name
 * @returns {object} the new pattern
 */
function createPattern(name) {
   const trimmed = name.trim();
   if (patterns.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return null;
   }
   const pattern = {
      id: generateId(),
      name: name.trim(),
      observations: []
   };
   patterns.push(pattern);
   saveData(patterns);
   return pattern;
}

/* ── Rendering ── */

/**
 * buildPatternRow(pattern, dates)
 * Constructs and returns a <li> element for one behavior row.
 *
 * @param  {object}   pattern
 * @param  {string[]} dates   — ordered array of YYYY-MM-DD strings
 * @returns {HTMLLIElement}
 */
function buildPatternRow(pattern, dates) {
   // Index observations by date for O(1) lookup
   const obsMap = {};
   for (const obs of pattern.observations) {
      obsMap[obs.date] = obs.value;
   }

   // <li>
   const li = document.createElement('li');
   li.className = 'behavior-row';
   li.dataset.behaviorId = pattern.id;
   li.setAttribute('aria-label', pattern.name);

   // Label
   const label = document.createElement('span');
   label.className = 'behavior-label';
   label.textContent = pattern.name;

   // Dot grid
   const grid = document.createElement('div');
   grid.className = 'dot-grid';
   grid.setAttribute('role', 'img');
   grid.setAttribute('aria-label', `${WINDOW_DAYS}-day grid for ${pattern.name}`);

   const todayStr = todayISO();
   for (const date of dates) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.dataset.value = (date in obsMap)
         ? (obsMap[date] === 1 ? '1' : '0')
         : 'missing';
      if (date === todayStr) dot.classList.add('dot-today');
      grid.appendChild(dot);
   }

   // Register Action button
   const today = todayISO();
   const registered = pattern.observations.some(o => o.date === today && o.value === 1);

   const btn = document.createElement('button');
   btn.type = 'button';
   btn.className = 'btn-register';
   btn.textContent = 'register';
   btn.setAttribute('aria-label', `Register action for ${pattern.name} today`);
   btn.dataset.registered = registered ? 'true' : 'false';

   if (!registered) {
      btn.addEventListener('click', () => registerAction(pattern.id));
   }

   // Row stat — current run
   const stat = document.createElement('span');
   stat.className = 'row-stat';
   stat.textContent = currentRun(pattern);

   // Row stat — recurrence ratio
   const ratio = document.createElement('span');
   ratio.className = 'row-stat';
   ratio.textContent = Math.round(recurrenceRatio(pattern) * 100) + '%';

   // Edit button
   const editBtn = document.createElement('button');
   editBtn.type = 'button';
   editBtn.className = 'btn-edit';
   editBtn.textContent = 'edit';
   editBtn.setAttribute('aria-label', `Rename ${pattern.name}`);
   editBtn.addEventListener('click', () => {
      const newName = prompt('Rename behavior:', pattern.name);
      if (newName === null) return;
      renamePattern(pattern.id, newName);
   });

   // Delete button
   const delBtn = document.createElement('button');
   delBtn.type = 'button';
   delBtn.className = 'btn-delete';
   delBtn.textContent = '×';
   delBtn.setAttribute('aria-label', `Delete ${pattern.name}`);
   delBtn.addEventListener('click', () => deletePattern(pattern.id));

   li.appendChild(label);
   li.appendChild(grid);
   li.appendChild(btn);
   li.appendChild(stat);
   li.appendChild(ratio);
   li.appendChild(editBtn);
   li.appendChild(delBtn);

   return li;
}

/**
 * renderPatterns()
 * Clears and re-renders the full behavior list from the in-memory
 * patterns array. Also updates the footer count.
 */
function renderPatterns() {
   const list = document.getElementById('behavior-list');
   if (!list) return;

   const dates = windowDates(WINDOW_DAYS);
   list.innerHTML = '';

   for (const pattern of patterns) {
      list.appendChild(buildPatternRow(pattern, dates));
   }

   updateFooter();
}

/**
 * updateFooter()
 * Syncs the footer behavior-count label.
 */
function updateFooter() {
   const el = document.getElementById('entry-count');
   if (!el) return;
   const n = patterns.length;
   el.textContent = `${n} behavior${n === 1 ? '' : 's'} tracked`;
}

/* ── Input Wiring ── */

function initAddBehavior() {
   const input = document.getElementById('new-behavior-input');
   const btn = document.getElementById('add-behavior-btn');
   if (!input || !btn) return;

   function handleAdd() {
      const name = input.value.trim();
      if (!name) return;
      createPattern(name);
      input.value = '';
      input.focus();
      renderPatterns();
   }

   btn.addEventListener('click', handleAdd);
   input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
   });
}

/* ── Analytics ── */

/**
 * renderAnalytics()
 * Computes summary stats from stored patterns and populates the
 * four stat card elements on analytics.html.
 *
 * Stat definitions:
 *   behaviors  — number of tracked patterns
 *   days       — observation window (WINDOW_DAYS)
 *   total ones — count of value=1 across all patterns in the window
 *   density    — total ones / (behaviors × window days)
 */
function renderAnalytics() {
   const elBehaviors = document.getElementById('stat-behaviors');
   const elDays = document.getElementById('stat-days');
   const elTotalOnes = document.getElementById('stat-total-ones');
   const elDensity = document.getElementById('stat-density');

   // Not on the analytics page — nothing to do
   if (!elBehaviors) return;

   const dates = windowDates(WINDOW_DAYS);
   const totalBehaviors = patterns.length;

   let totalOnes = 0;

   for (const pattern of patterns) {
      const obsMap = {};
      for (const obs of pattern.observations) {
         obsMap[obs.date] = obs.value;
      }
      for (const date of dates) {
         if (obsMap[date] === 1) totalOnes++;
      }
   }

   const possibleSignals = totalBehaviors * WINDOW_DAYS;
   const density = possibleSignals > 0
      ? Math.round((totalOnes / possibleSignals) * 100) + '%'
      : '—';

   elBehaviors.textContent = totalBehaviors || '—';
   elDays.textContent = WINDOW_DAYS;
   elTotalOnes.textContent = totalOnes || '—';
   elDensity.textContent = density;

   // Date range label
   const rangeEl = document.getElementById('analysis-date-range');
   if (rangeEl && dates.length > 0) {
      rangeEl.textContent = `${dates[0]} → ${dates[dates.length - 1]}`;
   }

   // Last updated label
   const updatedEl = document.getElementById('analysis-last-updated');
   if (updatedEl) {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      updatedEl.textContent = `loaded ${h}:${min}`;
   }

   renderBehaviorDetails();
   renderObservationSentence();
}

/**
 * renderObservationSentence()
 * Computes the overall recurrence ratio across all patterns and populates
 * #observation-sentence with a neutral analytical observation.
 *
 * Thresholds:
 *   > 0.75  → "Intentional repetition appears structurally stable."
 *   0.4–0.75 → "Intentional pattern shows variability."
 *   < 0.4   → "Intentional repetition remains inconsistent."
 */
function renderObservationSentence() {
   const el = document.getElementById('observation-sentence');
   if (!el) return;

   if (patterns.length === 0) {
      el.textContent = '';
      return;
   }

   // Average recurrence ratio across all tracked patterns
   const total = patterns.reduce((sum, p) => sum + recurrenceRatio(p), 0);
   const overall = total / patterns.length;

   let sentence;
   if (overall > 0.75) {
      sentence = 'Intentional repetition appears structurally stable.';
   } else if (overall >= 0.4) {
      sentence = 'Intentional pattern shows variability.';
   } else {
      sentence = 'Intentional repetition remains inconsistent.';
   }

   el.textContent = sentence;
}

/**
 * renderBehaviorDetails()
 * Builds one article block per pattern into #behavior-analysis-list,
 * sorted by descending recurrence ratio (frequency).
 * Each block contains: name, occurrences, frequency%, longest streak, dot grid.
 */
function renderBehaviorDetails() {
   const container = document.getElementById('behavior-analysis-list');
   if (!container) return;

   container.innerHTML = '';

   if (patterns.length === 0) return;

   const dates = windowDates(WINDOW_DAYS);

   // Sort by descending recurrence ratio
   const sorted = [...patterns].sort(
      (a, b) => recurrenceRatio(b) - recurrenceRatio(a)
   );

   sorted.forEach((pattern, index) => {
      const obsMap = {};
      for (const obs of pattern.observations) {
         obsMap[obs.date] = obs.value;
      }

      const occurrences = dates.filter(d => obsMap[d] === 1).length;
      const freqPct = Math.round((occurrences / WINDOW_DAYS) * 100) + '%';
      const maxStreak = longestStreak(pattern);

      // ── article ──
      const article = document.createElement('article');
      article.className = 'behavior-detail';
      article.setAttribute('aria-label', `Behavior: ${pattern.name}`);

      // ── detail header ──
      const header = document.createElement('div');
      header.className = 'detail-header';

      const nameEl = document.createElement('span');
      nameEl.className = 'detail-name';
      nameEl.textContent = pattern.name;

      const statsEl = document.createElement('div');
      statsEl.className = 'detail-stats';
      statsEl.setAttribute('role', 'list');

      function makeStat(value, label) {
         const wrap = document.createElement('div');
         wrap.className = 'detail-stat';
         wrap.setAttribute('role', 'listitem');
         const v = document.createElement('span');
         v.className = 'value';
         v.textContent = value;
         const l = document.createElement('span');
         l.className = 'label';
         l.textContent = label;
         wrap.appendChild(v);
         wrap.appendChild(l);
         return wrap;
      }

      statsEl.appendChild(makeStat(occurrences, 'occurrences'));
      statsEl.appendChild(makeStat(freqPct, 'frequency'));
      statsEl.appendChild(makeStat(maxStreak, 'max streak'));

      header.appendChild(nameEl);
      header.appendChild(statsEl);

      // ── dot grid ──
      const grid = document.createElement('div');
      grid.className = 'dot-grid';
      grid.setAttribute('role', 'img');
      grid.setAttribute('aria-label', `30-day grid for ${pattern.name}`);

      for (const date of dates) {
         const dot = document.createElement('span');
         dot.className = 'dot';
         dot.dataset.value = (date in obsMap)
            ? (obsMap[date] === 1 ? '1' : '0')
            : 'missing';
         grid.appendChild(dot);
      }

      article.appendChild(header);
      article.appendChild(grid);
      container.appendChild(article);

      // Divider between blocks (not after the last one)
      if (index < sorted.length - 1) {
         const hr = document.createElement('hr');
         hr.className = 'divider';
         container.appendChild(hr);
      }
   });
}

/* ── Export ── */

/**
 * exportData()
 * Serialises the current patterns array and triggers a download
 * of pattern-field-backup.json via a temporary object URL.
 */
function exportData() {
   const json = JSON.stringify(patterns, null, 2);
   const blob = new Blob([json], { type: 'application/json' });
   const url = URL.createObjectURL(blob);

   const a = document.createElement('a');
   a.href = url;
   a.download = 'pattern-field-backup.json';
   a.click();

   // Release the object URL after the download is triggered
   URL.revokeObjectURL(url);
}

/**
 * initExport()
 * Wires the export button in the footer.
 */
function initExport() {
   const btn = document.getElementById('export-btn');
   if (!btn) return;
   btn.addEventListener('click', exportData);
}

/* ── Import ── */

/**
 * importData(file)
 * Reads a JSON backup file, validates it as an array, replaces the
 * in-memory patterns, persists to localStorage, and re-renders.
 *
 * @param {File} file
 */
function importData(file) {
   const reader = new FileReader();

   reader.onload = function (e) {
      try {
         const parsed = JSON.parse(e.target.result);

         if (!Array.isArray(parsed)) {
            console.error('Pattern Field import: expected an array, got', typeof parsed);
            return;
         }

         const valid = parsed.filter(isValidPattern);
         if (valid.length !== parsed.length) {
            console.warn(
               `Pattern Field import: ${parsed.length - valid.length} item(s) failed schema validation and were skipped.`
            );
         }
         if (valid.length === 0) {
            console.error('Pattern Field import: no valid patterns found in file.');
            return;
         }

         patterns = valid;
         saveData(patterns);
         renderPatterns();
         renderAnalytics();
      } catch (err) {
         console.error('Pattern Field import: invalid JSON —', err.message);
      }
   };

   reader.readAsText(file);
}

/**
 * initImport()
 * Wires the import button to open a hidden file picker,
 * then passes the selected file to importData().
 */
function initImport() {
   const btn = document.getElementById('import-btn');
   const input = document.getElementById('import-file-input');
   if (!btn || !input) return;

   btn.addEventListener('click', () => {
      input.value = '';        // reset so re-selecting the same file still fires change
      input.click();
   });

   input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
         importData(input.files[0]);
      }
   });
}

/* ── In-memory state ── */
let patterns = loadData();

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
   renderPatterns();
   initAddBehavior();
   initExport();
   initImport();
   renderAnalytics();
});
