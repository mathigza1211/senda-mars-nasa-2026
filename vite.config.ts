import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-senda-data-folder',
      configureServer(server) {
        server.middlewares.use('/data', (req, res, next) => {
          const cleanUrl = (req.url || '/').split('?')[0];
          const filePath = path.join(process.cwd(), 'data', cleanUrl);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    open: false,
  },
});
