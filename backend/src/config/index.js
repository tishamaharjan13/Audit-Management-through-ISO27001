require("dotenv").config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",

  maxFailedLogins: Number(process.env.MAX_FAILED_LOGINS || 5),
  lockMinutes: Number(process.env.LOCK_MINUTES || 15),
  resetMinutes: Number(process.env.RESET_MINUTES || 15),

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
  },
};
