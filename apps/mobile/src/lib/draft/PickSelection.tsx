import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { supabase } from "../auth/supabase";
import { GameProvider, useGame } from "../game/GameContext";
import { Button, Card, StateNotice } from "../ui/components";
import { palette, radii, spacing } from "../ui/theme";

export default function PickSelection() {
  const route = useRoute<RouteProp<RootStackParamList, "Pick">>();
  const { gameId, round, category } = route.params;
  return (
    <GameProvider gameId={gameId}>
      <PickSelectionScreen round={round} category={category} />
    </GameProvider>
  );
}

type RoundOption = {
  symbol: string;
  name: string;
  price?: number | null;
};

type PickSelectionScreenProps = {
  round: number;
  category: string;
};

function PickSelectionScreen({ round, category }: PickSelectionScreenProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    gameId,
    submitPick,
    currentTurnUserId,
    usernames,
    picks,
    debugPickForUser,
  } = useGame();
  const [options, setOptions] = useState<RoundOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [doubleDown, setDoubleDown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    async function loadOptions() {
      setLoading(true);
      setError(null);
      try {
        const { data: poolRows, error: poolError } = await supabase
          .from("game_round_pools")
          .select("symbol")
          .eq("game_id", gameId)
          .eq("pick_round", round);
        if (poolError) throw new Error(poolError.message);
        const symbols = poolRows?.map((row) => row.symbol) ?? [];
        if (symbols.length === 0) {
          setOptions([]);
          return;
        }
        const { data: symbolRows, error: symbolError } = await supabase
          .from("symbols")
          .select("symbol, company_name, current_price")
          .in("symbol", symbols);
        if (symbolError) throw new Error(symbolError.message);
        const details = new Map(
          symbolRows?.map((row) => [row.symbol, row]) ?? [],
        );
        const parsed: RoundOption[] = symbols.map((symbol) => {
          const info = details.get(symbol);
          return {
            symbol,
            name: info?.company_name ?? symbol,
            price: info?.current_price ?? null,
          };
        });
        setOptions(parsed);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load options";
        setError(message);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }
    void loadOptions();
  }, [gameId, round]);

  const canPick = Boolean(userId && userId === currentTurnUserId);
  const devOverrideAvailable =
    __DEV__ &&
    Boolean(currentTurnUserId) &&
    (!userId || userId !== currentTurnUserId);
  const canAct = canPick || devOverrideAvailable;

  const takenBySymbol = useMemo(() => {
    const roundPicks = picks[round] ?? {};
    const symbols: Record<string, string> = {};
    Object.values(roundPicks).forEach((pick) => {
      if (!symbols[pick.symbol]) {
        symbols[pick.symbol] = pick.user_id;
      }
    });
    return symbols;
  }, [picks, round]);

  useEffect(() => {
    if (selected && takenBySymbol[selected]) {
      setSelected(null);
    }
  }, [selected, takenBySymbol]);

  const onSubmit = async () => {
    if (!selected || !canPick) return;
    setSubmitting(true);
    try {
      await submitPick(selected, { doubleDown });
      navigation.goBack();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit pick";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDebugSubmit = async () => {
    if (!selected || !currentTurnUserId) return;
    setSubmitting(true);
    try {
      await debugPickForUser(currentTurnUserId, selected, { doubleDown });
      navigation.goBack();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit pick";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card padding={spacing.lg} gap={spacing.sm}>
        <Text style={styles.heading}>Round {round}</Text>
        <Text style={styles.subheading}>Category · {category}</Text>
        {currentTurnUserId ? (
          <Text style={styles.currentTurn}>
            On the clock: {usernames[currentTurnUserId] ?? currentTurnUserId}
          </Text>
        ) : null}
      </Card>
      {canPick ? null : (
        <StateNotice
          tone="muted"
          title={
            devOverrideAvailable ? "Dev override enabled" : "It's not your turn"
          }
          message={
            devOverrideAvailable
              ? "You can submit on behalf of the current player while testing."
              : "You can review options but cannot pick right now."
          }
        />
      )}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accentBlueSoft} />
          <Text style={styles.subheading}>Loading symbols…</Text>
        </View>
      ) : error ? (
        <StateNotice
          tone="error"
          title="Couldn't load symbols"
          message={error}
        />
      ) : options.length === 0 ? (
        <StateNotice
          tone="muted"
          title="No symbols available"
          message="There are no symbols to pick for this round."
        />
      ) : (
        <FlatList
          data={options}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const active = selected === item.symbol;
            const takenById = takenBySymbol[item.symbol];
            const takenByUsername = takenById
              ? (usernames[takenById] ?? takenById)
              : null;
            return (
              <TouchableOpacity
                style={[
                  styles.option,
                  active && styles.optionActive,
                  takenById && styles.optionTaken,
                ]}
                onPress={() => setSelected(item.symbol)}
                disabled={!canAct || Boolean(takenById)}
              >
                <View>
                  <Text style={styles.optionSymbol}>{item.symbol}</Text>
                  <Text style={styles.optionName}>{item.name}</Text>
                  {takenByUsername ? (
                    <Text style={styles.optionTakenLabel}>
                      Taken by {takenByUsername}
                    </Text>
                  ) : null}
                </View>
                {typeof item.price === "number" ? (
                  <Text style={styles.optionPrice}>
                    ${item.price.toFixed(2)}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.toggle, doubleDown && styles.toggleActive]}
          onPress={() => setDoubleDown((prev) => !prev)}
          disabled={!canAct}
        >
          <Text style={styles.toggleLabel}>Double down</Text>
        </TouchableOpacity>
        <Button
          label={
            submitting
              ? "Submitting…"
              : canPick
                ? "Submit pick"
                : `Submit for ${
                    currentTurnUserId
                      ? (usernames[currentTurnUserId] ?? currentTurnUserId)
                      : "player"
                  }`
          }
          onPress={canPick ? onSubmit : onDebugSubmit}
          disabled={!canAct || !selected || submitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: palette.background,
    gap: spacing.md,
  },
  center: {
    alignItems: "center",
    gap: spacing.xs,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  subheading: {
    color: palette.textSecondary,
  },
  currentTurn: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  list: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
  },
  optionActive: {
    borderColor: palette.accentBlueSoft,
    backgroundColor: palette.surfaceMuted,
  },
  optionTaken: {
    opacity: 0.5,
  },
  optionSymbol: {
    color: palette.textPrimary,
    fontWeight: "700",
  },
  optionName: {
    color: palette.textSecondary,
  },
  optionTakenLabel: {
    marginTop: spacing.xs / 2,
    color: palette.accentGreen,
    fontSize: 12,
  },
  optionPrice: {
    color: palette.textPrimary,
    fontWeight: "600",
  },
  actionRow: {
    gap: spacing.sm,
  },
  toggle: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
  },
  toggleActive: {
    borderColor: palette.accentGreen,
  },
  toggleLabel: {
    color: palette.textSecondary,
  },
});
