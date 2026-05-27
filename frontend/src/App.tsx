import { App as AntApp, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { api, ApiError } from './api/client';
import LoginPage from './pages/LoginPage';
import WorkspacePage from './pages/WorkspacePage';
import type { Bootstrap, User } from './types';

export default function App() {
  const { message } = AntApp.useApp();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const [bootstrapData] = await Promise.all([api.bootstrap(), api.csrf()]);
        let currentUser: User | null = null;
        try {
          const me = await api.me();
          currentUser = me.user;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            throw error;
          }
        }
        if (mounted) {
          setBootstrap(bootstrapData);
          setUser(currentUser);
          document.title = bootstrapData.systemName;
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : '系统初始化失败');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [message]);

  if (loading || !bootstrap) {
    return (
      <div className="boot-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage bootstrap={bootstrap} onLogin={setUser} />;
  }

  return <WorkspacePage bootstrap={bootstrap} user={user} onLogout={() => setUser(null)} />;
}

