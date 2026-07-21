// ---------------------------------------------------------------------------
// Explain mode: shows a plain-English line under every form control saying
// what the choice represents in a real vehicle. Content lives in per-page
// help modules; this is the shared wiring.
//
// initExplain({ toggleBtnId, storageKey, fieldHelp, optionHelp, sectionHelp })
//   fieldHelp:   { elementId: text }
//   optionHelp:  { elementId: { optionValue: text } }  (selects — shows the
//                currently selected option's explanation, live)
//   sectionHelp: { headingText: text }  (matched against .card h2 contents)
// ---------------------------------------------------------------------------

let state = null;

export function initExplain(config) {
  state = { ...config, on: readPref(config.storageKey) };
  const btn = document.getElementById(config.toggleBtnId);
  if (btn) {
    btn.addEventListener('click', () => {
      state.on = !state.on;
      localStorage.setItem(config.storageKey, state.on ? '1' : '0');
      applyExplain();
    });
  }
  // Live-update option explanations as selections change.
  for (const id of Object.keys(config.optionHelp || {})) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => updateField(id));
  }
  applyExplain();
}

function readPref(key) {
  const stored = localStorage.getItem(key);
  return stored === null ? true : stored === '1'; // on by default
}

export function refreshExplain() {
  if (state) applyExplain();
}

function applyExplain() {
  const btn = document.getElementById(state.toggleBtnId);
  if (btn) btn.textContent = state.on ? 'Explain: on' : 'Explain: off';

  for (const id of new Set([...Object.keys(state.fieldHelp || {}), ...Object.keys(state.optionHelp || {})])) {
    updateField(id);
  }

  // Section intros under card headings.
  document.querySelectorAll('.card > h2').forEach((h2) => {
    const key = Object.keys(state.sectionHelp || {}).find((k) => h2.textContent.includes(k));
    let intro = h2.nextElementSibling;
    const isIntro = intro && intro.classList?.contains('section-help');
    if (state.on && key) {
      if (!isIntro) {
        intro = document.createElement('p');
        intro.className = 'section-help';
        h2.after(intro);
      }
      intro.textContent = state.sectionHelp[key];
    } else if (isIntro) {
      intro.remove();
    }
  });
}

function updateField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const base = state.fieldHelp?.[id];
  const perOption = state.optionHelp?.[id]?.[el.value];
  const text = perOption ? (base ? `${base} ${perOption}` : perOption) : base;
  if (!text) return;

  // Attach to the wrapping <label> (fields) or the element itself.
  const host = el.closest('label') || el;
  host.title = text;

  let note = host.querySelector(':scope > .field-help');
  if (state.on) {
    if (!note) {
      note = document.createElement('small');
      note.className = 'field-help';
      host.appendChild(note);
    }
    note.textContent = text;
  } else if (note) {
    note.remove();
  }
}
