import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { GameProvider, useGame } from "../game/GameContext";
import { palette, radii, spacing } from "../ui/theme";
import { Card, StateNotice } from "../ui/components";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatSignedCurrency(value: number) {
  if (value === 0) return currencyFormatter.format(0);
  const absolute = currencyFormatter.format(Math.abs(value));
  return value > 0 ? `+${absolute}` : `-${absolute}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const absolute = Math.abs(normalized).toFixed(2);
  if (normalized > 0) return `+${absolute}%`;
  if (normalized < 0) return `-${absolute}%`;
  return "0.00%";
}

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
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {
    gameId,
    name,
    usernames,
    picks,
    members,
    membersLoading,
    picksLoading,
  } = useGame();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const pickStats = useMemo(() => {
    const map = new Map<
      string,
      { symbols: string[]; costBasis: number; marketValue: number }
    >();
    Object.values(picks).forEach((roundPicks) => {
      Object.values(roundPicks).forEach((pick) => {
        const stats = map.get(pick.user_id) ?? {
          symbols: [],
          costBasis: 0,
          marketValue: 0,
        };
        stats.symbols.push(pick.symbol);
        if (typeof pick.start_price === "number") {
          stats.costBasis += pick.start_price;
        }
        if (typeof pick.current_price === "number") {
          stats.marketValue += pick.current_price;
        }
        map.set(pick.user_id, stats);
      });
    });
    return map;
  }, [picks]);

  const standings = useMemo(() => {
    return members
      .map((member) => {
        const playerStats = pickStats.get(member.user_id) ?? {
          symbols: [],
          costBasis: 0,
          marketValue: 0,
        };
        const fallback = member.user_id.substring(0, 6);
        const username =
          member.username ?? usernames[member.user_id] ?? fallback;
        const pnl = member.pnl ?? 0;
        const dailyChange = member.pnl_daily_change ?? 0;
        const costBasis = playerStats.costBasis;
        const totalValue =
          playerStats.marketValue > 0
            ? playerStats.marketValue
            : costBasis + pnl;
        const returnPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        const dailyPercent =
          costBasis > 0 ? (dailyChange / costBasis) * 100 : 0;
        return {
          id: member.user_id,
          username,
          picks: playerStats.symbols,
          pnl,
          dailyChange,
          costBasis,
          totalValue,
          returnPercent,
          dailyPercent,
        };
      })
      .sort((a, b) => {
        if (b.returnPercent !== a.returnPercent) {
          return b.returnPercent - a.returnPercent;
        }
        if (b.pnl !== a.pnl) return b.pnl - a.pnl;
        return a.username.localeCompare(b.username);
      });
  }, [members, pickStats, usernames]);

  const loading = membersLoading || picksLoading;

  const toggleExpanded = (userId: string) => {
    setExpandedUserId((current) => (current === userId ? null : userId));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{name}</Text>
      <Text style={styles.subheading}>Live leaderboard</Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.accentBlueSoft} />
          <Text style={styles.loadingLabel}>Preparing standings…</Text>
        </View>
      ) : standings.length === 0 ? (
        <StateNotice
          tone="muted"
          title="No standings yet"
          message="Invite players to join the lobby and start drafting."
        />
      ) : (
        standings.map((player, index) => {
          const isExpanded = expandedUserId === player.id;
          const hasPicks = player.picks.length > 0;
          return (
            <TouchableOpacity
              key={player.id}
              onPress={() => toggleExpanded(player.id)}
              activeOpacity={0.9}
              style={styles.cardPressable}
            >
              <Card padding={spacing.lg} gap={spacing.sm}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.playerMeta}>
                    <Text style={styles.username}>{player.username}</Text>
                    <Text style={styles.pickSummary}>
                      {player.picks.length > 0
                        ? `${player.picks.length} picks`
                        : "No picks yet"}
                    </Text>
                    <Text style={styles.expandHint}>
                      {isExpanded ? "Hide portfolio" : "Tap for breakdown"}
                    </Text>
                  </View>
                  <View style={styles.rowEnd}>
                    <View style={styles.pnlBlock}>
                      <Text
                        style={[
                          styles.pnlValue,
                          player.returnPercent > 0
                            ? styles.pnlPositive
                            : player.returnPercent < 0
                              ? styles.pnlNegative
                              : styles.pnlNeutral,
                        ]}
                      >
                        {formatPercent(player.returnPercent)}
                      </Text>
                      <Text
                        style={[
                          styles.dailyChange,
                          player.dailyPercent > 0
                            ? styles.pnlPositive
                            : player.dailyPercent < 0
                              ? styles.pnlNegative
                              : styles.pnlNeutral,
                        ]}
                      >
                        {formatPercent(player.dailyPercent)} today
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`View detailed insights for ${player.username}`}
                      disabled={!hasPicks}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (!hasPicks) return;
                        navigation.navigate("PortfolioInsights", {
                          gameId,
                          userId: player.id,
                          username: player.username,
                          symbols: player.picks,
                        });
                      }}
                      style={[
                        styles.insightsButton,
                        !hasPicks && styles.insightsButtonDisabled,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.insightsButtonLabel}>→</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {isExpanded ? (
                  <View style={styles.summaryBlock}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Cost basis</Text>
                      <Text style={styles.summaryValue}>
                        {currencyFormatter.format(player.costBasis)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Current value</Text>
                      <Text style={styles.summaryValue}>
                        {currencyFormatter.format(player.totalValue)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Daily move</Text>
                      <Text
                        style={[
                          styles.summaryValue,
                          player.dailyChange > 0
                            ? styles.pnlPositive
                            : player.dailyChange < 0
                              ? styles.pnlNegative
                              : styles.pnlNeutral,
                        ]}
                      >
                        {formatSignedCurrency(player.dailyChange)}
                      </Text>
                    </View>
                    {player.picks.length > 0 ? (
                      <Text style={styles.summaryPicks}>
                        {player.picks.join(", ")}
                      </Text>
                    ) : (
                      <Text style={styles.rowTextMuted}>No picks recorded</Text>
                    )}
                  </View>
                ) : null}
              </Card>
            </TouchableOpacity>
          );
        })
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
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  rowEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
    fontSize: 24,
    fontWeight: "700",
    color: palette.textPrimary,
    minWidth: 32,
  },
  playerMeta: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  username: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  pickSummary: {
    color: palette.textSecondary,
  },
  pnlBlock: {
    alignItems: "flex-end",
    gap: spacing.xs / 2,
  },
  pnlValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  dailyChange: {
    fontSize: 13,
  },
  pnlPositive: {
    color: palette.accentGreenSoft,
  },
  pnlNegative: {
    color: palette.accentRed,
  },
  pnlNeutral: {
    color: palette.textSecondary,
  },
  rowTextMuted: {
    color: palette.textSecondary,
    fontStyle: "italic",
  },
  cardPressable: {
    borderRadius: radii.lg,
  },
  summaryBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.borderMuted,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  summaryValue: {
    fontWeight: "600",
    color: palette.textPrimary,
  },
  summaryPicks: {
    color: palette.textSecondary,
    fontStyle: "italic",
  },
  expandHint: {
    color: palette.textMuted,
    fontSize: 12,
  },
  insightsButton: {
    marginLeft: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderMuted,
    backgroundColor: palette.surfaceMuted,
  },
  insightsButtonDisabled: {
    opacity: 0.4,
  },
  insightsButtonLabel: {
    color: palette.accentBlueSoft,
    fontSize: 18,
    fontWeight: "700",
  },
});
