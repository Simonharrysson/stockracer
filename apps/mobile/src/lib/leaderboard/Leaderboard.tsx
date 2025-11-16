import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { GameProvider, useGame } from "../game/GameContext";
import { palette, spacing } from "../ui/theme";
import { Card } from "../ui/components";

export default function Leaderboard() {
  const route = useRoute<RouteProp<RootStackParamList, "Leaderboard">>();
  const { gameId } = route.params;

  return (
    <GameProvider gameId={gameId}>
      <LeaderboardScreen />
    </GameProvider>
  );
}

function LeaderboardScreen() {
  const {
    name,
    pickOrder,
    usernames,
    picks,
    membersLoading,
    picksLoading,
  } = useGame();

  const standings = useMemo(() => {
    return pickOrder.map((userId) => {
      const playerPicks: string[] = [];
      Object.values(picks).forEach((roundPicks) => {
        const pick = roundPicks[userId];
        if (pick) playerPicks.push(pick.symbol);
      });
      return {
        id: userId,
        username: usernames[userId] ?? userId.substring(0, 6),
        picks: playerPicks,
      };
    });
  }, [pickOrder, picks, usernames]);

  const loading = membersLoading || picksLoading;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{name}</Text>
      <Text style={styles.subheading}>Leaderboard</Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.accentBlueSoft} />
          <Text style={styles.loadingLabel}>Preparing standings…</Text>
        </View>
      ) : (
        standings.map((player, index) => (
          <Card key={player.id} padding={spacing.md} gap={spacing.xs}>
            <Text style={styles.rank}>
              {index + 1}. {player.username}
            </Text>
            {player.picks.length > 0 ? (
              <Text style={styles.rowText}>
                Picks: {player.picks.join(", ")}
              </Text>
            ) : (
              <Text style={styles.rowTextMuted}>No picks recorded</Text>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  subheading: {
    color: palette.textSecondary,
    marginBottom: spacing.sm,
  },
  loading: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  loadingLabel: {
    color: palette.textSecondary,
  },
  rank: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  rowText: {
    color: palette.textSecondary,
  },
  rowTextMuted: {
    color: palette.textSecondary,
    fontStyle: "italic",
  },
});
