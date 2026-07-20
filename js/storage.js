// Design library persisted in localStorage.

const KEY = 'gvb.designs.v1';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function listSaved() {
  return Object.keys(readAll()).sort((a, b) => a.localeCompare(b));
}

export function saveDesign(design) {
  const map = readAll();
  map[design.name] = design;
  writeAll(map);
}

export function loadDesign(name) {
  return readAll()[name] || null;
}

export function deleteDesign(name) {
  const map = readAll();
  delete map[name];
  writeAll(map);
}
