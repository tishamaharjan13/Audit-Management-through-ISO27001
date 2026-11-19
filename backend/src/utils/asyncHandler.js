// Sends any error from an async route to the error handler instead of crashing.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
