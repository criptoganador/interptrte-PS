const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for saving JSON datasets

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database tables
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lsv_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_data (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES lsv_users(id) ON DELETE CASCADE,
        dataset_json JSONB,
        labels_json JSONB,
        centroids_json JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id)
      );
    `);
    console.log('✅ Database tables initialized successfully.');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

initDB();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.user = user;
    next();
  });
};

// --- AUTH ENDPOINTS ---

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM lsv_users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await pool.query(
      'INSERT INTO lsv_users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    res.status(201).json({ message: 'Usuario registrado exitosamente', user: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno: ' + error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    // Find user
    const userResult = await pool.query('SELECT * FROM lsv_users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno: ' + error.message });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y nueva contraseña son requeridos.' });
    }

    const userResult = await pool.query('SELECT id FROM lsv_users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No existe una cuenta con ese email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await pool.query('UPDATE lsv_users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    res.json({ message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión con la nueva contraseña.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno: ' + error.message });
  }
});

// --- SYNC ENDPOINTS ---

// Upload Data (Save dataset and model params to cloud)
app.post('/api/sync/upload', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { dataset_json, labels_json, centroids_json } = req.body;

    // Use INSERT ... ON CONFLICT to upsert the data
    await pool.query(
      `INSERT INTO user_data (user_id, dataset_json, labels_json, centroids_json, updated_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
          dataset_json = EXCLUDED.dataset_json,
          labels_json = EXCLUDED.labels_json,
          centroids_json = EXCLUDED.centroids_json,
          updated_at = CURRENT_TIMESTAMP`,
      [
        userId, 
        JSON.stringify(dataset_json || []), 
        JSON.stringify(labels_json || []), 
        JSON.stringify(centroids_json || {})
      ]
    );

    res.json({ message: 'Datos respaldados en la nube correctamente.' });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Error interno al respaldar los datos.' });
  }
});

// Download Data (Retrieve dataset and model params from cloud)
app.get('/api/sync/download', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const dataResult = await pool.query('SELECT dataset_json, labels_json, centroids_json FROM user_data WHERE user_id = $1', [userId]);
    
    if (dataResult.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron datos respaldados para este usuario.' });
    }

    res.json(dataResult.rows[0]);
  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).json({ error: 'Error interno al recuperar los datos.' });
  }
});

// Community Data (Download all shared sign datasets)
app.get('/api/sync/community', authenticateToken, async (req, res) => {
  try {
    const communityData = await pool.query('SELECT dataset_json, labels_json, centroids_json FROM user_data WHERE dataset_json IS NOT NULL');

    if (communityData.rows.length === 0) {
      return res.status(200).json({
        dataset_json: [],
        labels_json: [],
        centroids_json: {}
      });
    }

    const mergedDataset = [];
    const labelsSet = new Set();
    const mergedCentroids = {};

    const normalizeCentroids = (centroids) => {
      if (!centroids || typeof centroids !== 'object') return {};
      const normalized = {};
      Object.entries(centroids).forEach(([label, value]) => {
        if (Array.isArray(value)) {
          normalized[label] = value;
        } else if (value && typeof value === 'object') {
          normalized[label] = [value];
        }
      });
      return normalized;
    };

    communityData.rows.forEach((row) => {
      if (Array.isArray(row.dataset_json)) {
        mergedDataset.push(...row.dataset_json);
      }
      if (Array.isArray(row.labels_json)) {
        row.labels_json.forEach((label) => labelsSet.add(label));
      }

      const normalized = normalizeCentroids(row.centroids_json);
      Object.entries(normalized).forEach(([label, centroids]) => {
        if (!mergedCentroids[label]) mergedCentroids[label] = [];
        mergedCentroids[label].push(...centroids);
      });
    });

    res.json({
      dataset_json: mergedDataset,
      labels_json: [...labelsSet],
      centroids_json: mergedCentroids,
    });
  } catch (error) {
    console.error('Community Download Error:', error);
    res.status(500).json({ error: 'Error interno al recuperar los datos comunitarios.' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});
