import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Signup from "./src/lib/login/Signup";
import Login from "./src/lib/login/Login";
import {
  getSession,
  onAuthStateChange,
  signOut as signOutUser,
} from "./src/lib/auth/api";
import Home from "./src/lib/game/Home";
import { palette, spacing } from "./src/lib/ui/theme";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Lobby from "./src/lib/lobby/lobby";
import PickSelection from "./src/lib/draft/PickSelection";
import Draft from "./src/lib/draft/Draft";
import Leaderboard from "./src/lib/leaderboard/Leaderboard";
import PortfolioInsights from "./src/lib/leaderboard/PortfolioInsights";

export type RootStackParamList = {
  Home: undefined;
  Lobby: { gameId: string; name: string; inviteCode?: string };
  Draft: {
    gameId: string;
    pickOrder?: string[];
    usernames?: Record<string, string>;
  };
  Pick: { gameId: string; round: number; category: string };
  Leaderboard: { gameId: string };
  PortfolioInsights: {
    gameId: string;
    userId: string;
    username: string;
    symbols: string[];
  };
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

function AppContainer() {
  const insets = useSafeAreaInsets();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    let mounted = true;
    getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(!!data.session);
    });
    const { data: sub } = onAuthStateChange(async (_event, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const containerStyle = {
    paddingTop: insets.top,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  return (
    <View style={[styles.safeArea, containerStyle]}>
      {isAuthed === null ? (
        <LoadingScreen />
      ) : isAuthed ? (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              contentStyle: { backgroundColor: palette.background },
            }}
          >
            <Stack.Screen
              name="Home"
              component={Home}
              options={{
                headerTitle: "Home",
                headerStyle: { backgroundColor: palette.background },
                headerTitleStyle: { color: palette.textPrimary },
                headerRight: () => (
                  <TouchableOpacity onPress={() => signOutUser()}>
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
                headerTitle: "Lobby",
                headerBackVisible: false,
                headerStyle: { backgroundColor: palette.background },
                headerTitleStyle: { color: palette.textPrimary },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="Draft"
              component={Draft}
              options={{
                headerTitle: "Draft",
                headerStyle: { backgroundColor: palette.background },
                headerTitleStyle: { color: palette.textPrimary },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="Pick"
              component={PickSelection}
              options={{
                headerTitle: "Select Stock",
                headerStyle: { backgroundColor: palette.background },
                headerTitleStyle: { color: palette.textPrimary },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="Leaderboard"
              component={Leaderboard}
              options={{
                headerTitle: "Leaderboard",
                headerStyle: { backgroundColor: palette.background },
                headerTitleStyle: { color: palette.textPrimary },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="PortfolioInsights"
              component={PortfolioInsights}
              options={{
                headerTitle: "Portfolio insights",
                headerStyle: { backgroundColor: palette.background },
                headerTitleStyle: { color: palette.textPrimary },
                headerShadowVisible: false,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      ) : (
        <AuthScreen
          mode={authMode}
          onToggle={() =>
            setAuthMode((m) => (m === "login" ? "signup" : "login"))
          }
        />
      )}
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContainer />
    </SafeAreaProvider>
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
  mode: "login" | "signup";
  onToggle: () => void;
};

function AuthScreen({ mode, onToggle }: AuthScreenProps) {
  return (
    <View style={styles.authScreen}>
      <View style={styles.authHeader}>
        <Text style={styles.brand}>StockRacer</Text>
        <Text style={styles.authTagline}>
          Fantasy-style drafting for real stocks
        </Text>
      </View>
      {mode === "login" ? <Login /> : <Signup />}
      <TouchableOpacity onPress={onToggle}>
        <Text style={styles.switchAuth}>
          {mode === "login"
            ? "Don't have an account? Sign up"
            : "Already have an account? Log in"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  authScreen: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg + 4,
  },
  authHeader: {
    alignItems: "center",
    gap: spacing.xs,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: palette.textPrimary,
    letterSpacing: 1,
  },
  authTagline: {
    color: palette.textMuted,
  },
  signOut: {
    color: palette.accentBlueSoft,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  muted: {
    color: palette.textSecondary,
  },
  switchAuth: {
    color: palette.accentBlueSoft,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
});
