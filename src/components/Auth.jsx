import { useState } from 'react';

export function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    setIsLoading(true);

    if (isResetMode) {
      if (!email || !password || !confirmPassword) {
        setFeedback({ type: 'error', text: 'Completa todos los campos para cambiar tu contraseña.' });
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setFeedback({ type: 'error', text: 'Las contraseñas no coinciden.' });
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Error al cambiar la contraseña');
        }

        setFeedback({ type: 'success', text: '✅ Contraseña cambiada. Ahora puedes iniciar sesión con tu nueva contraseña.' });
        setIsResetMode(false);
        setPassword('');
        setConfirmPassword('');
      } catch (err) {
        setFeedback({ type: 'error', text: err.message });
      } finally {
        setIsLoading(false);
      }

      return;
    }

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
        localStorage.setItem('lsv-token', data.token);
        localStorage.setItem('lsv-user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      } else {
        setIsLogin(true);
        setFeedback({ type: 'success', text: '¡Registro exitoso! Por favor inicia sesión.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isResetMode ? 'Recuperar contraseña' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
          <p>
            {isResetMode
              ? 'Ingresa tu correo y una nueva contraseña.'
              : isLogin
              ? 'Ingresa para sincronizar tus señas.'
              : 'Regístrate para guardar tu IA en la nube.'}
          </p>
        </div>

        {feedback.text && (
          <div className={`auth-message ${feedback.type === 'success' ? 'success' : 'error'}`}>
            {feedback.text}
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
            <label>{isResetMode ? 'Nueva Contraseña' : 'Contraseña'}</label>
            <div className="password-field">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required 
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {isResetMode && (
            <div className="input-group">
              <label>Confirmar Contraseña</label>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required 
              />
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading
              ? 'Cargando...'
              : isResetMode
              ? 'Cambiar contraseña'
              : isLogin
              ? 'Ingresar'
              : 'Registrarse'}
          </button>
        </form>

        <div className="auth-footer">
          {isResetMode ? (
            <p>
              ¿Recordaste tu contraseña?
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => {
                  setIsResetMode(false);
                  setFeedback({ type: '', text: '' });
                }}
              >
                Volver a iniciar sesión
              </button>
            </p>
          ) : (
            <>
              <p>
                {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                <button
                  type="button"
                  className="auth-switch-btn"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setFeedback({ type: '', text: '' });
                  }}
                >
                  {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
                </button>
              </p>
              {isLogin && (
                <p>
                  <button
                    type="button"
                    className="auth-switch-btn"
                    onClick={() => {
                      setIsResetMode(true);
                      setFeedback({ type: '', text: '' });
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
