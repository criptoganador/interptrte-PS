import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@tensorflow/tfjs': '@tensorflow/tfjs/dist/tf.fesm.js'
    }
  },
  optimizeDeps: {
    exclude: ['@tensorflow/tfjs']
  }
})
