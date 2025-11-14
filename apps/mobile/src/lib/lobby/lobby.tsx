import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View, Text, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import type { RootStackParamList } from '../../../App';
import { supabase } from '../auth/supabase';
import type { Database } from '../../../../../supabase/functions/_shared/database.types';
import { Button, Card, SectionHeader, StateNotice } from '../ui/components';
import { palette, radii, spacing } from '../ui/theme';

type GameMemberRow = Database['public']['Tables']['game_members']['Row'];

export default function Lobby() {
    const route = useRoute<RouteProp<RootStackParamList, 'Lobby'>>();
    const { name, gameId, inviteCode } = route.params;
    const [memberIds, setMemberIds] = useState<GameMemberRow['user_id'][]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);

    const copyCode = async () => {
        if (!inviteCode) return;
        await Clipboard.setStringAsync(inviteCode);
        Alert.alert('Copied', 'Invite code copied to clipboard');
    };

    useEffect(() => {
        let isMounted = true;

        async function fetchMembers(showSpinner = true) {
            if (showSpinner) {
                setMembersLoading(true);
            }
            setMembersError(null);

            try {
                const { data, error } = await supabase
                    .from('game_members')
                    .select('user_id')
                    .eq('game_id', gameId)
                    .order('joined_at', { ascending: true });

                if (error) throw new Error(error.message);
                if (!isMounted) return;

                const ids = data?.map((row) => row.user_id) ?? [];
                setMemberIds(ids);
            } catch (err) {
                if (!isMounted) return;
                const message = err instanceof Error ? err.message : 'Failed to load players';
                setMemberIds([]);
                setMembersError(message);
            } finally {
                if (isMounted && showSpinner) {
                    setMembersLoading(false);
                }
            }
        }

        fetchMembers();

        const channel = supabase
            .channel(`game-members-${gameId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'game_members', filter: `game_id=eq.${gameId}` },
                () => {
                    void fetchMembers(false);
                },
            )
            .subscribe();

        return () => {
            isMounted = false;
            void supabase.removeChannel(channel);
        };
    }, [gameId]);

    const rosterSubtitle = membersLoading ? 'Updating roster…' : 'Live roster';
    const rosterCount = membersLoading ? '--' : memberIds.length.toString();

    return (
        <View style={styles.container}>
            <Card padding={spacing.xl} gap={spacing.md}>
                <Text style={styles.title}>{name}</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.label}>Game ID</Text>
                    <Text style={styles.value}>{gameId}</Text>
                </View>
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
                ) : memberIds.length === 0 ? (
                    <StateNotice
                        tone="muted"
                        title="No other players have joined yet."
                        message="Share the invite code so everyone can get in."
                    />
                ) : (
                    <View style={styles.memberList}>
                        {memberIds.map((id) => (
                            <View key={id} style={styles.memberPill}>
                                <Text style={styles.memberId}>{id}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </Card>
            <Text style={styles.hint}>Share the invite code with friends to join.</Text>
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
        fontWeight: '800',
        color: palette.textPrimary,
    },
    infoRow: {
        gap: spacing.xs / 2,
    },
    label: {
        fontSize: 12,
        color: palette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    value: {
        fontSize: 18,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    inviteBlock: {
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    inviteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    inviteValue: {
        fontSize: 22,
        fontWeight: '700',
        color: palette.textPrimary,
        letterSpacing: 1,
    },
    membersCount: {
        fontSize: 16,
        fontWeight: '700',
        color: palette.accentBlueSoft,
    },
    membersState: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.borderMuted,
        borderRadius: radii.md,
        padding: spacing.lg,
        alignItems: 'center',
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
        color: palette.textSecondary,
        textAlign: 'center',
    },
});
