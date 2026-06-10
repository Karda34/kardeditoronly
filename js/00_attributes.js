// ===================================================================
// 00_ATTRIBUTES.JS — Universal Player Attribute System
// ===================================================================
// Muss VOR 03_sim_engine.js und 10_outcome.js geladen werden.
//
// Jeder Spieler (Offense + Defense) bekommt alle Attribute.
// Die Position bestimmt nur welche relevant sind — nicht welche existieren.
// Bereich: 0–99, Default: 75
// ===================================================================

// ── Attribut-Definitionen ─────────────────────────────────────────────
// Jedes Attribut hat: key, label (UI), Beschreibung, Default
const ATTRIBUTE_DEFS = [
  // ── Athletik ──
  { key: 'SPD', label: 'Speed',            desc: 'Maximale Laufgeschwindigkeit',                default: 80 },
  { key: 'ACC', label: 'Acceleration',     desc: 'Wie schnell Vollspeed erreicht wird',         default: 80 },
  { key: 'STR', label: 'Strength',         desc: 'Körperkraft — Block/Rush-Duelle',             default: 80 },

  // ── Receiving ──
  { key: 'CTH', label: 'Catch',            desc: 'Fangwahrscheinlichkeit bei Separation',       default: 80 },
  { key: 'CIT', label: 'Catch in Traffic', desc: 'Fangwahrscheinlichkeit im Contested-Bereich', default: 80 },
  { key: 'REL', label: 'Release',          desc: 'Press-Release an der Line (erste 0.5s)',       default: 80 },
  { key: 'BRK', label: 'Break',            desc: 'Speed-Erhalt am Route-Cut',                   default: 80 },
  { key: 'RTE', label: 'Route Running',    desc: 'Routen-Präzision (Drift + Timing)',            default: 99 },

  // ── Blocking ──
  { key: 'BLK', label: 'Blocking',         desc: 'Block-Effizienz — Run/Pass Protection',       default: 80 },

  // ── Passing ──
  { key: 'THP', label: 'Throw Power',      desc: 'Ballgeschwindigkeit / Wurfstärke',            default: 80 },
  { key: 'THA', label: 'Throw Accuracy',   desc: 'Passgenauigkeit unter Druck',                 default: 80 },

  // ── Mental ──
  { key: 'AWR', label: 'Awareness',        desc: 'Spielverständnis — Reaktionszeit + Reads',    default: 99 },

  // ── Defense ──
  { key: 'TAK', label: 'Tackle',           desc: 'Tackle-Sicherheit',                           default: 80 },
  { key: 'COV', label: 'Coverage',         desc: 'Coverage-Qualität (Man + Zone)',               default: 99 },
  { key: 'PRS', label: 'Pass Rush',        desc: 'Pass-Rush-Effektivität',                      default: 80 },
  { key: 'CRE', label: 'Cut Reaction',     desc: 'Reaktionszeit auf Receiver-Cuts — niedrig = langer Freeze', default: 99 },
  { key: 'CRA', label: 'Call Reaction',    desc: 'Reaktionszeit auf Coverage-Trigger (Push/Switch/Zone-Read)', default: 99 },
  { key: 'ZON', label: 'Zone Coverage',    desc: 'Zone-IQ — Tiefen-Bias bei Multi-Receiver, Antizipations-Drift bei leerer Zone', default: 99 },
];

// Schneller Lookup: key → definition
const ATTRIBUTE_MAP = {};
ATTRIBUTE_DEFS.forEach(def => { ATTRIBUTE_MAP[def.key] = def; });

// Alle Keys als Array (für Iteration)
const ATTRIBUTE_KEYS = ATTRIBUTE_DEFS.map(d => d.key);

// Default-Wert für unbekannte/fehlende Attribute
const ATTRIBUTE_DEFAULT = 75;

// ── O-Line globaler SPD-Wert ──────────────────────────────────────────
// Alle 5 OLiner (LT, LG, C, RG, RT) laufen mit diesem SPD-Wert.
// Skala identisch zu Skill-Player-SPD: 75 = Baseline, 99 = max, 0 = Floor.
// Formel in getMoveSpeed: speed = baseSpeed * (OL_DEFAULT_SPD / 75)
// Tune-Beispiel: 50 = OLine läuft 50/75 = 0.667× baseSpeed.
const OL_DEFAULT_SPD = 80;

// ── Attribut-Zugriff ──────────────────────────────────────────────────
// Gibt den Attribut-Wert eines Spielers zurück.
// Fallback: ATTRIBUTE_DEFAULT wenn Spieler keine Attribute hat.
//
// Akzeptiert sowohl die neuen Keys (SPD, CTH, ...) als auch die
// alten Strings aus 10_outcome.js (speed, catch, route, ...) für
// Rückwärtskompatibilität.

const _LEGACY_KEY_MAP = {
  'speed':        'SPD',
  'catch':        'CTH',
  'route':        'RTE',
  'blocking':     'BLK',
  'release':      'REL',
  'tackle':       'TAK',
  'coverage':     'COV',
  'manCoverage':  'COV',
  'zoneCoverage': 'COV',
  'pursuit':      'SPD',
  'press':        'PRS',
};

function getAttr(player, attr) {
  // Legacy-Key umwandeln
  const key = _LEGACY_KEY_MAP[attr] || attr;
  return player?.attributes?.[key] ?? ATTRIBUTE_DEFAULT;
}

// ── Spieler-Attribute initialisieren ──────────────────────────────────
// Setzt alle 14 Attribute auf Default. Überschreibt keine existierenden Werte.
// Aufruf: initPlayerAttributes(player)       → alle auf 75
//         initPlayerAttributes(player, true)  → erzwingt Reset auf 75

function initPlayerAttributes(player, forceReset = false) {
  if (!player) return;
  if (!player.attributes || forceReset) {
    player.attributes = {};
  }
  ATTRIBUTE_DEFS.forEach(def => {
    if (player.attributes[def.key] === undefined) {
      player.attributes[def.key] = def.default;
    }
  });
}

// ── Einzelnes Attribut setzen (mit Clamp 0–99) ────────────────────────
function setAttr(player, key, value) {
  if (!player) return;
  if (!player.attributes) initPlayerAttributes(player);
  const k = _LEGACY_KEY_MAP[key] || key;
  player.attributes[k] = Math.max(0, Math.min(99, Math.round(value)));
}

// ── Alle Attribute eines Spielers als Kopie zurückgeben ───────────────
function getAttributes(player) {
  if (!player) return null;
  if (!player.attributes) initPlayerAttributes(player);
  return { ...player.attributes };
}
