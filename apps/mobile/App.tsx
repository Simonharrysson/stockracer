import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Signup from './src/lib/login/Signup';
import Login from './src/lib/login/Login';
import { supabase } from './src/lib/auth/supabase';
import Home from './src/lib/game/Home';
import Lobby from './src/lib/lobby/lobby';
import { palette, spacing } from './src/lib/ui/theme';

export type RootStackParamList = {
  Home: undefined;
  Lobby: { gameId: string; name: string; inviteCode?: string };
};
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    card: palette.background,
    text: palette.textPrimary,
    border: palette.border,
    primary: palette.accentBlueSoft,
  },
};

export default function App() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

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
    return <LoadingScreen />;
  }

  if (!isAuthed) {
    return <AuthScreen mode={authMode} onToggle={() => setAuthMode((m) => (m === 'login' ? 'signup' : 'login'))} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: palette.background } }}>
        <Stack.Screen
          name="Home"
          component={Home}
          options={{
            headerTitle: 'Home',
            headerStyle: { backgroundColor: palette.background },
            headerTitleStyle: { color: palette.textPrimary },
            headerRight: () => (
              <TouchableOpacity onPress={() => supabase.auth.signOut()}>
                <Text style={styles.signOut}>Sign out</Text>
              </TouchableOpacity>
            ),
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="Lobby"
          component={Lobby}
          options={{
            headerTitle: 'Lobby',
            headerBackVisible: false,
            headerStyle: { backgroundColor: palette.background },
            headerTitleStyle: { color: palette.textPrimary },
            headerShadowVisible: false,
          }}
        />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>Preparing…</Text>
    </View>
  );
}

type AuthScreenProps = {
  mode: 'login' | 'signup';
  onToggle: () => void;
};

function AuthScreen({ mode, onToggle }: AuthScreenProps) {
  return (
    <View style={styles.authScreen}>
      <View style={styles.authHeader}>
        <Text style={styles.brand}>StockRacer</Text>
        <Text style={styles.authTagline}>Fantasy-style drafting for real stocks</Text>
      </View>
      {mode === 'login' ? <Login /> : <Signup />}
      <TouchableOpacity onPress={onToggle}>
        <Text style={styles.switchAuth}>
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  authScreen: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg + 4,
  },
  authHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: palette.textPrimary,
    letterSpacing: 1,
  },
  authTagline: {
    color: palette.textMuted,
  },
  signOut: {
    color: palette.accentBlueSoft,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  muted: {
    color: palette.textSecondary,
  },
  switchAuth: {
    color: palette.accentBlueSoft,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
});
