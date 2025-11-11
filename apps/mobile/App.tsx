import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Signup from './src/lib/login/Signup';
import Login from './src/lib/login/Login';
import SymbolsList from './src/lib/symbols/SymbolsList';
import { supabase } from './src/lib/auth/supabase';
import PortfolioScreen from './src/lib/investments/PortfolioScreen';

export default function App() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [tab, setTab] = useState<'stocks' | 'portfolio'>('stocks');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (isAuthed === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Preparing…</Text>
      </View>
    );
  }

  if (!isAuthed) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>StockRacer</Text>
        {authMode === 'login' ? <Login /> : <Signup />}
        <TouchableOpacity
          onPress={() => setAuthMode((m) => (m === 'login' ? 'signup' : 'login'))}
          style={{ marginTop: 16 }}
        >
          <Text style={styles.switchAuth}>
            {authMode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Log in'}
          </Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.authedContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{tab === 'stocks' ? 'Stocks' : 'Portfolio'}</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {tab === 'stocks' ? <SymbolsList /> : <PortfolioScreen />}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'stocks' && styles.tabItemActive]}
          onPress={() => setTab('stocks')}
        >
          <Text style={[styles.tabLabel, tab === 'stocks' && styles.tabLabelActive]}>Stocks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'portfolio' && styles.tabItemActive]}
          onPress={() => setTab('portfolio')}
        >
          <Text style={[styles.tabLabel, tab === 'portfolio' && styles.tabLabelActive]}>Portfolio</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authedContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  signOut: {
    color: '#2563eb',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    color: '#6b7280',
  },
  switchAuth: {
    color: '#2563eb',
    fontWeight: '600',
  },
  tabBar: {
    borderTopColor: '#e5e7eb',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#eef2ff',
  },
  tabLabel: {
    color: '#374151',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#2563eb',
  },
});
