import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import keycloak, { initKeycloak } from './keycloak';
import { setTokenProvider } from '../lib/api';

interface AuthContextValue {
  userId: string;
  name: string;
  email: string;
  token: string;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    initKeycloak()
      .then((authenticated) => {
        if (authenticated) {
          // Register Keycloak as the token provider for all API calls.
          // keycloak.token is automatically refreshed by the Keycloak adapter.
          setTokenProvider(() => keycloak.token);
          setStatus('ready');
        } else {
          // keycloak.init with onLoad:'login-required' redirects automatically;
          // this branch is reached only if auth was explicitly skipped.
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0A0A0F',
        color: '#a78bfa',
        fontFamily: 'monospace',
        fontSize: '1.1rem',
        gap: '12px',
      }}>
        <span style={{
          display: 'inline-block',
          width: '18px',
          height: '18px',
          border: '2px solid #a78bfa',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'devkarm-spin 0.7s linear infinite',
        }} />
        Loading DEVKARM...
        <style>{`@keyframes devkarm-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0A0A0F',
        color: '#EF4444',
        fontFamily: 'monospace',
        fontSize: '1rem',
      }}>
        Authentication failed. Ensure Keycloak is running at localhost:8080.
      </div>
    );
  }

  const userId = keycloak.tokenParsed?.sub as string | undefined ?? 'anonymous';
  const name  = keycloak.tokenParsed?.name  as string | undefined ?? keycloak.tokenParsed?.preferred_username as string | undefined ?? 'User';
  const email = keycloak.tokenParsed?.email as string | undefined ?? '';
  const token = keycloak.token ?? '';

  return (
    <AuthContext.Provider value={{ userId, name, email, token, logout: () => keycloak.logout() }}>
      {children}
    </AuthContext.Provider>
  );
}
