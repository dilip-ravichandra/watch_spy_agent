function format(level, message, meta) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta && typeof meta === 'object' ? { meta } : {})
  });
}

function info(message, meta) {
  console.log(format('info', message, meta));
}

function warn(message, meta) {
  console.warn(format('warn', message, meta));
}

function error(message, meta) {
  console.error(format('error', message, meta));
}

module.exports = {
  info,
  warn,
  error
};
