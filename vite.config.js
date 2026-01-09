
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      // Expose the API_KEY to the client-side code
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
      allowedHosts: true, // Allows all hosts including the .onrender.com domain
    }
  };
});
