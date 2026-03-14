function isNonEmptyString(value, maxLen = 1000) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLen;
}

function asTrimmed(value) {
  return String(value || '').trim();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function oneOf(value, allowed = []) {
  return allowed.includes(value);
}

module.exports = {
  isNonEmptyString,
  asTrimmed,
  asNumber,
  inRange,
  oneOf
};
