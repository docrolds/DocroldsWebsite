import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Ensure .html files are processed
    rollupOptions: {
      input: {
        main: './index.html',
        login: './login.html',
        admin: './admin.html',
        beats: './beats.html'
      }
    }
  }
})
