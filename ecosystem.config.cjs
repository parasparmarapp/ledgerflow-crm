module.exports = {
  apps: [
    {
      name: 'crm-backend',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      script_mode: 'fork',
      max_memory_restart: '1G',
      env: {
      }
    },
    {
      name: 'crm-frontend',
      cwd: './web',
      script: 'node_modules/.bin/vite',
      args: 'preview --port 9173 --host 0.0.0.0',
      instances: 1,
      script_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
