module.exports = {
  apps : [{
    name   : "reservations",
    script : "./index.js",
    // PM2 will use the directory where ecosystem.config.js is located as cwd
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production"
    },
    error_file: "./logs/pm2-error.log",
    out_file: "./logs/pm2-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true
  }]
}
