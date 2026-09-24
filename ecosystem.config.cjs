module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: './backend',
      script: 'dist/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },

    {
      name: 'crm-frontend',
      cwd: './web',
      script: 'node_modules/.bin/vite',
      args: 'preview --port 9173 --host 0.0.0.0',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
    }
  ]
};