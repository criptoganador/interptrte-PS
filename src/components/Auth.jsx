import { useState } from 'react';

export function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la autenticación');
      }

      if (isLogin) {
        // Guardar token y avisar a App.jsx
        localStorage.setItem('lsv-token', data.token);
        localStorage.setItem('lsv-user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      } else {
        // Si se registra con éxito, cambiar a login
        setIsLogin(true);
        setError('¡Registro exitoso! Por favor inicia sesión.');
        // Un pequeño hack para que el mensaje se vea verde, o simplemente usar un estado success
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
          <p>
            {isLogin 
              ? 'Ingresa para sincronizar tus señas' 
              : 'Regístrate para guardar tu IA en la nube'}
          </p>
        </div>

        {error && (
          <div className={`auth-message ${error.includes('exitoso') ? 'success' : 'error'}`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label>Correo Electrónico</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required 
            />
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>

          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? 'Cargando...' : isLogin ? 'Ingresar' : 'Registrarse'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button 
              type="button" 
              className="auth-switch-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
