import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Badge,
  Button,
  Card,
  Input,
  SectionHeader,
  StateNotice,
} from "../ui/components";
import { palette, radii, spacing } from "../ui/theme";
import { usePortfolios } from "./hooks/usePortfolios";
import { useNavigateToGame } from "./hooks/useNavigateToGame";
import { describePortfolioStatus } from "./utils/portfolio";
import { formatShortDate } from "./utils/date";
import { generateRandomName } from "./utils/randomName";
import { STATUS_BADGES } from "./constants";
import {
  CreateLobbyResult,
  JoinGameResult,
  createLobby,
  joinGame,
} from "./api";

export default function Home() {
  const goToGame = useNavigateToGame();
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);

  const [createdGame, setCreatedGame] = useState<CreateLobbyResult | null>(
    null,
  );
  const [joinedGame, setJoinedGame] = useState<JoinGameResult | null>(null);
  const {
    portfolios,
    loading: portfolioLoading,
    refreshing: portfolioRefreshing,
    error: portfolioError,
    refreshPortfolios,
    reloadPortfolios,
  } = usePortfolios();

  async function onCreate() {
    const name = createName.trim();
    if (name.length < 3)
      return Alert.alert("Name must be at least 3 characters");
    setBusyCreate(true);
    try {
      const lobby = await createLobby(name);
      setCreatedGame(lobby);
      void goToGame(lobby.id, {
        statusHint: "LOBBY",
        lobbyMeta: {
          name: lobby.name,
          inviteCode: lobby.invite_code ?? undefined,
        },
      });
      setJoinedGame(null);
      void reloadPortfolios();
    } catch (e) {
      Alert.alert("Create failed", (e as Error).message);
    } finally {
      setBusyCreate(false);
    }
  }

  function onRandom() {
    setCreateName(generateRandomName());
  }

  async function onJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 3) return Alert.alert("Enter an invite code");
    setBusyJoin(true);
    try {
      const joined = await joinGame(code);
      setJoinedGame(joined);
      void goToGame(joined.game_id, {
        lobbyMeta: { name: joined.game_name },
      });
      setCreatedGame(null);
      void reloadPortfolios();
    } catch (e) {
      Alert.alert("Join failed", (e as Error).message);
    } finally {
      setBusyJoin(false);
    }
  }

  const refreshDisabled = portfolioRefreshing || portfolioLoading;
  const refreshLabel = portfolioRefreshing ? "Refreshing…" : "Refresh";

  const refreshButton = (
    <Button
      label={refreshLabel}
      variant="outline"
      compact
      onPress={refreshPortfolios}
      disabled={refreshDisabled}
      fullWidth={false}
    />
  );

  let portfolioContent: ReactNode;
  if (portfolioLoading) {
    portfolioContent = (
      <View style={styles.portfolioState}>
        <ActivityIndicator color={palette.accentBlueSoft} />
        <Text style={styles.portfolioStateText}>Loading portfolios…</Text>
      </View>
    );
  } else if (portfolioError) {
    portfolioContent = (
      <StateNotice
        tone="error"
        title="Couldn't load your portfolios"
        message={portfolioError}
        action={
          <Button
            label="Try again"
            variant="outline"
            compact
            onPress={refreshPortfolios}
            disabled={portfolioRefreshing}
            fullWidth={false}
          />
        }
      />
    );
  } else if (portfolios.length === 0) {
    portfolioContent = (
      <StateNotice
        tone="muted"
        title="No portfolios yet"
        message="Create one or join with a code to start drafting."
      />
    );
  } else {
    portfolioContent = (
      <View style={styles.portfolioList}>
        {portfolios.map((portfolio) => {
          const badge = STATUS_BADGES[portfolio.status];
          return (
            <TouchableOpacity
              key={portfolio.id}
              style={styles.portfolioCard}
              activeOpacity={0.85}
              onPress={() =>
                goToGame(portfolio.id, {
                  statusHint: portfolio.status,
                  lobbyMeta: {
                    name: portfolio.name,
                    inviteCode: portfolio.invite_code ?? undefined,
                  },
                })
              }
            >
              <View style={styles.portfolioCardHeader}>
                <Text style={styles.portfolioName}>{portfolio.name}</Text>
                <Badge
                  label={badge.label}
                  customColors={{
                    bg: badge.bg,
                    color: badge.color,
                    border: badge.border,
                  }}
                />
              </View>
              <Text style={styles.portfolioMeta}>
                Joined {formatShortDate(portfolio.joined_at)}
              </Text>
              <Text style={styles.portfolioSubline}>
                {describePortfolioStatus(portfolio)}
              </Text>
              <View style={styles.portfolioFooter}>
                <Text style={styles.portfolioInvite}>
                  Invite {portfolio.invite_code ?? "—"}
                </Text>
                <Text style={styles.portfolioLink}>Open</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>StockRacer</Text>

      <Card style={styles.card} padding={spacing.xl} gap={spacing.md}>
        <SectionHeader
          title="Your Portfolios"
          subtitle="Jump back into a lobby"
          action={refreshButton}
        />
        {portfolioContent}
      </Card>

      <Card style={styles.card} padding={spacing.xl} gap={spacing.md}>
        <SectionHeader
          title="Create Game"
          subtitle="Name your lobby and invite friends"
        />
        <View style={styles.formStack}>
          <Input
            placeholder="Lobby name"
            autoCapitalize="words"
            autoCorrect={false}
            value={createName}
            onChangeText={setCreateName}
          />
          <Button label="Random" variant="ghost" onPress={onRandom} />
          <Button
            label={busyCreate ? "Working…" : "Create"}
            onPress={onCreate}
            disabled={busyCreate}
          />

          {createdGame && (
            <StateNotice
              tone="muted"
              title={`Created “${createdGame.name}”`}
              message={`Invite code: ${createdGame.invite_code}\nShare this code so friends can join.`}
            />
          )}
        </View>
      </Card>

      <Card style={styles.card} padding={spacing.xl} gap={spacing.md}>
        <SectionHeader
          title="Join Game"
          subtitle="Enter an invite code to hop in"
        />
        <View style={styles.formStack}>
          <Input
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Invite code"
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <Button
            label={busyJoin ? "Working…" : "Join"}
            variant="secondary"
            onPress={onJoin}
            disabled={busyJoin}
          />

          {joinedGame && (
            <StateNotice
              tone="muted"
              title={`Joined “${joinedGame.game_name}”`}
              message="You can start when everyone is in."
            />
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  card: {
    width: "100%",
  },
  formStack: {
    gap: spacing.sm,
  },
  portfolioState: {
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: palette.surfaceRaised,
  },
  portfolioStateText: {
    color: palette.textSecondary,
    textAlign: "center",
  },
  portfolioList: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  portfolioCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderMuted,
    backgroundColor: palette.surfaceMuted,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  portfolioCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  portfolioName: {
    color: palette.textPrimary,
    fontWeight: "700",
    fontSize: 16,
    flex: 1,
  },
  portfolioMeta: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  portfolioSubline: {
    color: palette.textPrimary,
    fontWeight: "600",
  },
  portfolioFooter: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  portfolioInvite: {
    color: palette.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  portfolioLink: {
    color: palette.accentBlueSoft,
    fontWeight: "700",
  },
});
