import { useState } from 'react';
import {
  LayoutGrid, Mail, Lock, LogIn, UserPlus, KeyRound,
  CheckSquare, Calendar, Cloud, Wallet
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register' | 'reset';

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'reset') {
      const err = await resetPassword(email);
      if (err) {
        setError(err);
      } else {
        setSuccess('Link zum Zurücksetzen wurde gesendet. Prüfe dein E-Mail-Postfach.');
      }
      setLoading(false);
      return;
    }

    const err = mode === 'register'
      ? await signUp(email, password)
      : await signIn(email, password);

    if (err) setError(err);
    setLoading(false);
  };

  const title = mode === 'register' ? 'Account erstellen' : mode === 'reset' ? 'Passwort zurücksetzen' : 'Willkommen!';
  const subtitle = mode === 'register'
    ? 'Erstelle deinen persönlichen Hub'
    : mode === 'reset'
    ? 'Wir senden dir einen Link'
    : 'Melde dich an deinem Hub an';

  return (
    <div className="auth-page">
      {/* Hero Section */}
      <div className="auth-hero">
        <div className="auth-floating-widgets">
          <div className="auth-float-widget"><CheckSquare size={28} /></div>
          <div className="auth-float-widget"><Calendar size={28} /></div>
          <div className="auth-float-widget"><Cloud size={28} /></div>
          <div className="auth-float-widget"><Wallet size={28} /></div>
        </div>
        <div className="auth-hero-content">
          <h2>Dein persönlicher Hub für alles.</h2>
          <p>Aufgaben, Notizen, Kalender, Passwörter und mehr — alles an einem Ort, auf jedem Gerät.</p>
        </div>
      </div>

      {/* Form Section */}
      <div className="auth-form-section">
        <div className="auth-card">
          <div className="auth-header">
            <LayoutGrid size={28} />
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-input-group">
              <Mail size={16} />
              <input
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {mode !== 'reset' && (
              <div className="auth-input-group">
                <Lock size={16} />
                <input
                  type="password"
                  placeholder="Passwort"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? (
                'Laden...'
              ) : mode === 'register' ? (
                <><UserPlus size={16} /> Registrieren</>
              ) : mode === 'reset' ? (
                <><KeyRound size={16} /> Link senden</>
              ) : (
                <><LogIn size={16} /> Anmelden</>
              )}
            </button>
          </form>

          <div className="auth-links">
            {mode === 'login' && (
              <>
                <button className="auth-toggle" onClick={() => switchMode('reset')}>
                  Passwort vergessen?
                </button>
                <button className="auth-toggle" onClick={() => switchMode('register')}>
                  Noch kein Account? Registrieren
                </button>
              </>
            )}
            {mode === 'register' && (
              <button className="auth-toggle" onClick={() => switchMode('login')}>
                Bereits registriert? Anmelden
              </button>
            )}
            {mode === 'reset' && (
              <button className="auth-toggle" onClick={() => switchMode('login')}>
                Zurück zur Anmeldung
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
