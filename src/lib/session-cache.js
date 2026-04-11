const CACHE_PREFIX = "automl_cache_v1";

function makeKey(kind, sessionId, datasetBase) {
  if (!sessionId || !datasetBase) return "";
  return `${CACHE_PREFIX}:${kind}:${sessionId}:${datasetBase}`;
}

function readJson(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (!key || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (quota/private mode)
  }
}

export function getCachedFeatureSelection(sessionId, datasetBase) {
  return readJson(makeKey("feature_selection", sessionId, datasetBase));
}

export function setCachedFeatureSelection(sessionId, datasetBase, payload) {
  writeJson(makeKey("feature_selection", sessionId, datasetBase), payload);
}

export function getCachedModelInfo(sessionId, datasetBase) {
  return readJson(makeKey("model_info", sessionId, datasetBase));
}

export function setCachedModelInfo(sessionId, datasetBase, payload) {
  writeJson(makeKey("model_info", sessionId, datasetBase), payload);
}

export function getCachedModelTestingSchema(sessionId, datasetBase) {
  return readJson(makeKey("model_testing_schema", sessionId, datasetBase));
}

export function setCachedModelTestingSchema(sessionId, datasetBase, payload) {
  writeJson(makeKey("model_testing_schema", sessionId, datasetBase), payload);
}
