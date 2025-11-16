import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { Button, Card, SectionHeader, StateNotice } from "../ui/components";
import { palette, radii, spacing } from "../ui/theme";
import { GameProvider, useGame } from "../game/GameContext";

export default function Lobby() {
  const route = useRoute<RouteProp<RootStackParamList, "Lobby">>();
  const { gameId, name, inviteCode } = route.params;

  return (
    <GameProvider
      gameId={gameId}
      initialName={name}
      initialInviteCode={inviteCode}
    >
      <LobbyScreen />
    </GameProvider>
  );
}

function LobbyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "Lobby">>();
  const {
    gameId,
    name,
    inviteCode,
    status,
    members,
    membersLoading,
    membersError,
    usernames,
    pickOrder,
    startGame,
  } = useGame();
  const [startBusy, setStartBusy] = useState(false);

  const rosterSubtitle = membersLoading ? "Updating roster…" : "Live roster";
  const rosterCount = membersLoading ? "--" : members.length.toString();

  const copyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert("Copied", "Invite code copied to clipboard");
  };

  useEffect(() => {
    if (status === "DRAFTING") {
      navigation.replace("Draft", {
        gameId,
        pickOrder,
        usernames,
      });
    }
  }, [status, navigation, gameId, pickOrder, usernames]);

  const handleStart = async () => {
    if (startBusy) return;
    setStartBusy(true);
    try {
      await startGame();
      Alert.alert("Game started", "Drafting will begin shortly.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start the game";
      Alert.alert("Start failed", message);
    } finally {
      setStartBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card padding={spacing.xl} gap={spacing.md}>
        <Text style={styles.title}>{name}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Game ID</Text>
          <Text style={styles.value}>{gameId}</Text>
        </View>
        {status && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{status}</Text>
          </View>
        )}
        {inviteCode && (
          <View style={styles.inviteBlock}>
            <Text style={styles.label}>Invite Code</Text>
            <View style={styles.inviteRow}>
              <Text style={styles.inviteValue}>{inviteCode}</Text>
              <Button
                label="Copy"
                variant="outline"
                compact
                fullWidth={false}
                onPress={copyCode}
              />
            </View>
          </View>
        )}
      </Card>
      <Card padding={spacing.xl} gap={spacing.md}>
        <SectionHeader
          title="Players in lobby"
          subtitle={rosterSubtitle}
          action={<Text style={styles.membersCount}>{rosterCount}</Text>}
        />

        {membersLoading ? (
          <View style={styles.membersState}>
            <ActivityIndicator color={palette.accentBlueSoft} />
            <Text style={styles.membersStateText}>Loading players…</Text>
          </View>
        ) : membersError ? (
          <StateNotice
            tone="error"
            title="Couldn't load players"
            message={membersError}
          />
        ) : members.length === 0 ? (
          <StateNotice
            tone="muted"
            title="No other players have joined yet."
            message="Share the invite code so everyone can get in."
          />
        ) : (
          <View style={styles.memberList}>
            {members.map((member) => {
              const fallback = `${member.user_id.slice(0, 4)}…`;
              return (
                <View key={member.user_id} style={styles.memberPill}>
                  <Text style={styles.memberId}>
                    {member.username ?? fallback}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>
      <Text style={styles.hint}>
        Share the invite code with friends to join.
      </Text>

      <Button
        label={startBusy ? "Starting…" : "Start"}
        onPress={handleStart}
        disabled={members.length < 2 || startBusy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: palette.background,
    gap: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  infoRow: {
    gap: spacing.xs / 2,
  },
  label: {
    fontSize: 12,
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    color: palette.textPrimary,
  },
  inviteBlock: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  inviteValue: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.textPrimary,
    letterSpacing: 1,
  },
  membersCount: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.accentBlueSoft,
  },
  membersState: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: palette.surfaceRaised,
  },
  membersStateText: {
    color: palette.textSecondary,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberPill: {
    borderWidth: 1,
    borderColor: palette.borderMuted,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surfaceMuted,
  },
  memberId: {
    color: palette.textPrimary,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  hint: {
    marginTop: spacing.sm,
    color: palette.textSecondary,
  },
});
