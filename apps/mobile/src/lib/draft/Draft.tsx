import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { supabase } from "../auth/supabase";
import { GameProvider, useGame } from "../game/GameContext";
import { palette, spacing } from "../ui/theme";
import type { ScrollView as ScrollViewType } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

const PLAYER_COLUMN_WIDTH = 150;

export default function Draft() {
  const route = useRoute<RouteProp<RootStackParamList, "Draft">>();
  const { gameId, pickOrder, usernames } = route.params;

  return (
    <GameProvider
      gameId={gameId}
      initialPickOrder={pickOrder}
      initialUsernames={usernames}
    >
      <DraftScreen />
    </GameProvider>
  );
}

function DraftScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    gameId,
    name,
    roundCategories,
    pickOrder,
    usernames,
    gameLoading,
    gameError,
    picks,
    picksLoading,
    currentPickRound,
    currentTurnUserId,
    refreshPicks,
    refreshGame,
    status,
  } = useGame();
  const [userId, setUserId] = useState<string | null>(null);
  const [autoNavigatedRound, setAutoNavigatedRound] = useState<number | null>(
    null,
  );
  const [celebrating, setCelebrating] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const prevStatus = useRef<typeof status | null>(null);
  const { width } = useWindowDimensions();
  const headerScrollRef = useRef<ScrollViewType | null>(null);
  const rowScrollRefs = useRef<Record<number, ScrollViewType | null>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([refreshPicks(), refreshGame()]);
    }, [refreshGame, refreshPicks]),
  );

  const isMyTurn = userId && userId === currentTurnUserId;

  useEffect(() => {
    if (!status) return;
    const previous = prevStatus.current;
    prevStatus.current = status;
    if (status === "ACTIVE") {
      if (previous && previous !== "ACTIVE") {
        setCelebrating(true);
        setConfettiSeed((seed) => seed + 1);
      } else if (!previous) {
        navigation.replace("Leaderboard", { gameId });
      }
    }
  }, [status, navigation, gameId]);

  useEffect(() => {
    if (!currentPickRound || !isMyTurn) {
      setAutoNavigatedRound(null);
      return;
    }
    if (autoNavigatedRound === currentPickRound) return;
    const category = roundCategories[currentPickRound - 1];
    if (!category) return;
    navigation.navigate("Pick", {
      gameId,
      round: currentPickRound,
      category,
    });
    setAutoNavigatedRound(currentPickRound);
  }, [
    autoNavigatedRound,
    currentPickRound,
    roundCategories,
    isMyTurn,
    navigation,
    gameId,
  ]);

  useEffect(() => {
    if (!currentTurnUserId) return;
    const targetIndex = pickOrder.indexOf(currentTurnUserId);
    if (targetIndex < 0) return;
    const targetX = Math.max(
      targetIndex * PLAYER_COLUMN_WIDTH - PLAYER_COLUMN_WIDTH,
      0,
    );
    const scrollToTarget = () => {
      headerScrollRef.current?.scrollTo({
        x: targetX,
        animated: true,
      });
      Object.values(rowScrollRefs.current).forEach((ref) => {
        ref?.scrollTo({ x: targetX, animated: true });
      });
    };
    const frame = requestAnimationFrame(scrollToTarget);
    return () => cancelAnimationFrame(frame);
  }, [currentTurnUserId, pickOrder]);

  let body: React.ReactNode = null;
  if (gameLoading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accentBlueSoft} />
        <Text style={styles.subheading}>Loading draft data…</Text>
      </View>
    );
  } else if (gameError) {
    body = (
      <View style={styles.center}>
        <Text style={styles.heading}>Something went wrong</Text>
        <Text style={styles.subheading}>{gameError}</Text>
      </View>
    );
  } else {
    body = (
      <View style={styles.metaStack}>
        <Text style={styles.heading}>{name}</Text>
        <Text style={styles.subheading}>
          {roundCategories.length} rounds · {pickOrder.length} players
        </Text>
        {currentTurnUserId ? (
          <Text style={styles.turnLine}>
            On the clock: {usernames[currentTurnUserId] ?? currentTurnUserId}
          </Text>
        ) : null}
        <View style={styles.gridWrapper}>
          <View style={styles.gridHeaderRow}>
            <View style={[styles.roundCell, styles.roundHeader]}>
              <Text style={styles.roundHeaderText}>Round</Text>
              <Text style={styles.roundHeaderSub}>Category</Text>
            </View>
            <ScrollView
              ref={headerScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.playerHeaderScroll}
            >
              {pickOrder.map((id) => {
                const isActive = id === currentTurnUserId;
                return (
                  <View
                    key={id}
                    style={[
                      styles.playerHeader,
                      isActive && styles.playerHeaderActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.playerName,
                        isActive && styles.playerNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {usernames[id] ?? id.substring(0, 6)}
                    </Text>
                    <Text
                      style={[
                        styles.playerLabel,
                        isActive && styles.playerLabelActive,
                      ]}
                    >
                      Pick
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.gridBody}>
            {roundCategories.length === 0 ? (
              <View style={styles.emptyGrid}>
                <Text style={styles.emptyGridText}>No rounds set yet.</Text>
              </View>
            ) : (
              roundCategories.map((category, index) => {
                const roundNumber = index + 1;
                const roundPicks = picks[roundNumber] ?? {};
                const isActiveRound = currentPickRound === roundNumber;
                return (
                  <View
                    key={category + index}
                    style={[
                      styles.gridRow,
                      isActiveRound && styles.gridRowActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.roundCell,
                        isActiveRound && styles.roundCellActive,
                      ]}
                    >
                      <Text style={styles.roundTitle}>Round {roundNumber}</Text>
                      <Text style={styles.roundCategory}>{category}</Text>
                    </View>
                    <ScrollView
                      ref={(node) => {
                        rowScrollRefs.current[roundNumber] = node;
                      }}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.pickRow}
                    >
                      {pickOrder.map((playerId) => {
                        const pick = roundPicks[playerId];
                        const isActiveCell =
                          isActiveRound && playerId === currentTurnUserId;
                        const allowDevOverride = __DEV__ && isActiveCell;
                        const isInteractive =
                          isActiveCell &&
                          (Boolean(isMyTurn) || allowDevOverride);
                        const CellComponent = isInteractive
                          ? TouchableOpacity
                          : View;
                        const cellProps = isInteractive
                          ? {
                              activeOpacity: 0.85,
                              onPress: () =>
                                navigation.navigate("Pick", {
                                  gameId,
                                  round: roundNumber,
                                  category,
                                }),
                            }
                          : {};
                        return (
                          <CellComponent
                            key={playerId + index}
                            style={[
                              styles.pickCell,
                              isActiveCell && styles.pickCellActive,
                            ]}
                            {...cellProps}
                          >
                            <Text
                              style={
                                pick
                                  ? styles.pickSymbol
                                  : styles.pickPlaceholder
                              }
                            >
                              {pick ? pick.symbol : "—"}
                            </Text>
                            {pick ? (
                              <Text style={styles.pickUsername}>
                                {usernames[pick.user_id] ??
                                  pick.user_id.substring(0, 6)}
                              </Text>
                            ) : null}
                          </CellComponent>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })
            )}
          </View>
          {picksLoading ? (
            <Text style={styles.loadingHint}>Updating picks…</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {body}
      {celebrating ? (
        <ConfettiCannon
          key={confettiSeed}
          count={160}
          origin={{ x: width / 2, y: 0 }}
          fadeOut
          autoStart
          explosionSpeed={350}
          fallSpeed={2600}
          onAnimationEnd={() => {
            setCelebrating(false);
            navigation.replace("Leaderboard", { gameId });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: palette.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  metaStack: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  subheading: {
    color: palette.textSecondary,
  },
  turnLine: {
    color: palette.accentBlueSoft,
    fontWeight: "600",
  },
  gridWrapper: {
    marginTop: spacing.lg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    overflow: "hidden",
  },
  gridHeaderRow: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  roundCell: {
    width: 140,
    padding: spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    gap: spacing.xs / 2,
  },
  roundHeader: {
    backgroundColor: palette.surface,
  },
  roundHeaderText: {
    color: palette.textPrimary,
    fontWeight: "700",
  },
  roundHeaderSub: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  playerHeaderScroll: {
    flexDirection: "row",
  },
  playerHeader: {
    width: PLAYER_COLUMN_WIDTH,
    padding: spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    gap: spacing.xs / 2,
  },
  playerHeaderActive: {
    backgroundColor: palette.surface,
  },
  playerName: {
    color: palette.textPrimary,
    fontWeight: "700",
  },
  playerNameActive: {
    color: palette.accentBlueSoft,
  },
  playerLabel: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  playerLabelActive: {
    color: palette.accentBlueSoft,
  },
  gridBody: {
    backgroundColor: palette.surfaceMuted,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  gridRowActive: {
    backgroundColor: palette.surfaceRaised,
  },
  roundTitle: {
    color: palette.textPrimary,
    fontWeight: "700",
  },
  roundCategory: {
    color: palette.textSecondary,
  },
  pickRow: {
    flexDirection: "row",
  },
  pickCell: {
    width: PLAYER_COLUMN_WIDTH,
    padding: spacing.md,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    justifyContent: "center",
    alignItems: "center",
  },
  pickCellActive: {
    backgroundColor: palette.surface,
  },
  roundCellActive: {
    backgroundColor: palette.surface,
  },
  pickSymbol: {
    color: palette.textPrimary,
    fontWeight: "700",
  },
  pickUsername: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 12,
  },
  pickPlaceholder: {
    color: palette.textSecondary,
  },
  emptyGrid: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyGridText: {
    color: palette.textSecondary,
  },
  loadingHint: {
    marginTop: spacing.sm,
    color: palette.textSecondary,
    fontSize: 12,
  },
});
