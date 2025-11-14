import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../auth/supabase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../App';
import type { Database } from '../../../../../supabase/functions/_shared/database.types';
import { Badge, Button, Card, Input, SectionHeader, StateNotice } from '../ui/components';
import { palette, radii, spacing } from '../ui/theme';

type CreateLobbyResponse = {
  success: boolean;
  error?: string;
  data?: {
    id: string;
    name: string;
    invite_code: string;
  };
};

type JoinGameResponse = {
  success: boolean;
  error?: string;
  data?: {
    game_id: string;
    game_name: string;
  };
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type GameRow = Database['public']['Tables']['games']['Row'];
type GamePreview = Pick<
  GameRow,
  'id' | 'name' | 'status' | 'invite_code' | 'current_pick_round' | 'start_time' | 'end_time'
>;
type Portfolio = GamePreview & { joined_at: string };
type MemberWithGame = { joined_at: string; games: GamePreview | null };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_BADGES: Record<
  GameRow['status'],
  { label: string; bg: string; color: string; border: string }
> = {
  LOBBY: {
    label: 'Lobby',
    bg: 'rgba(251, 191, 36, 0.12)',
    color: '#fbbf24',
    border: 'rgba(251, 191, 36, 0.4)',
  },
  DRAFTING: {
    label: 'Drafting',
    bg: 'rgba(96, 165, 250, 0.12)',
    color: '#93c5fd',
    border: 'rgba(96, 165, 250, 0.4)',
  },
  ACTIVE: {
    label: 'Active',
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.4)',
  },
  FINISHED: {
    label: 'Finished',
    bg: 'rgba(148, 163, 184, 0.12)',
    color: '#cfd6e7',
    border: 'rgba(148, 163, 184, 0.4)',
  },
};

function formatShortDate(value?: string | null, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const month = MONTHS[date.getMonth()];
  if (!month) return fallback;
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  const suffix = year === currentYear ? '' : `, ${year}`;
  return `${month} ${day}${suffix}`;
}

function describePortfolioStatus(portfolio: Portfolio) {
  switch (portfolio.status) {
    case 'LOBBY':
      return 'Share the code and get ready to draft';
    case 'DRAFTING':
      return `Draft round ${portfolio.current_pick_round ?? 1}`;
    case 'ACTIVE': {
      const started = formatShortDate(portfolio.start_time, '');
      return started ? `Live since ${started}` : 'Live portfolio';
    }
    case 'FINISHED': {
      const ended = formatShortDate(portfolio.end_time || portfolio.start_time, '');
      return ended ? `Finished ${ended}` : 'Season finished';
    }
    default:
      return '';
  }
}

export default function Home() {
  const navigation = useNavigation<Nav>();
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);

  const [createdGame, setCreatedGame] = useState<CreateLobbyResponse['data'] | null>(null);
  const [joinedGame, setJoinedGame] = useState<JoinGameResponse['data'] | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioRefreshing, setPortfolioRefreshing] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const loadPortfolios = useCallback(async () => {
    try {
      setPortfolioError(null);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setPortfolios([]);
        setPortfolioError(userError.message);
        return;
      }
      const user = userData.user;
      if (!user) {
        setPortfolios([]);
        return;
      }
      const { data, error } = await supabase
        .from('game_members')
        .select(
          'joined_at, games ( id, name, status, invite_code, current_pick_round, start_time, end_time )',
        )
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .returns<MemberWithGame[]>();

      if (error) {
        setPortfolioError(error.message);
        return;
      }

      const mapped =
        data
          ?.map((entry) => (entry.games ? { ...entry.games, joined_at: entry.joined_at } : null))
          .filter((entry): entry is Portfolio => entry !== null) ?? [];

      setPortfolios(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setPortfolioError(message);
      setPortfolios([]);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    (async () => {
      setPortfolioLoading(true);
      try {
        await loadPortfolios();
      } finally {
        if (isActive) {
          setPortfolioLoading(false);
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, [loadPortfolios]);

  const refreshPortfolios = useCallback(async () => {
    setPortfolioRefreshing(true);
    try {
      await loadPortfolios();
    } finally {
      setPortfolioRefreshing(false);
    }
  }, [loadPortfolios]);

  async function onCreate() {
    const name = createName.trim();
    if (name.length < 3) return Alert.alert('Name must be at least 3 characters');
    setBusyCreate(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-lobby', {
        body: { name },
      });

      if (error) throw new Error(error.message);
      const res = data as CreateLobbyResponse;
      if (!res.success) throw new Error(res.error || 'Failed to create lobby');

      setCreatedGame(res.data!);
      navigation.navigate('Lobby', {
        gameId: res.data!.id,
        name: res.data!.name,
        inviteCode: res.data!.invite_code,
      });
      setJoinedGame(null);
      void loadPortfolios();

    } catch (e) {
      Alert.alert('Create failed', (e as Error).message);
    } finally {
      setBusyCreate(false);
    }
  }

  function generateRandomName() {
    const ADJ = [
      'Swift', 'Lucky', 'Bold', 'Clever', 'Brave', 'Neon', 'Turbo', 'Prime',
      'Atomic', 'Rapid', 'Sunny', 'Fuzzy', 'Magic', 'Cosmic', 'Quantum', 'Nova',
    ];
    const NOUN = [
      'Bulls', 'Bears', 'Titans', 'Rockets', 'Sharks', 'Wolves', 'Alphas',
      'Mavericks', 'Owls', 'Falcons', 'Panthers', 'Dragons', 'Hawks', 'Racers',
    ];
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const num = Math.floor(Math.random() * 900 + 100); // 100-999
    return `${pick(ADJ)} ${pick(NOUN)} ${num}`;
  }

  function onRandom() {
    setCreateName(generateRandomName());
  }

  async function onJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 3) return Alert.alert('Enter an invite code');
    setBusyJoin(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-game', {
        body: { invite_code: code },
      });
      if (error) throw new Error(error.message);
      const res = data as JoinGameResponse;
      if (!res.success) throw new Error(res.error || 'Failed to join game');
      setJoinedGame(res.data!);
      navigation.navigate('Lobby', {
        gameId: res.data!.game_id,
        name: res.data!.game_name,
      });
      setCreatedGame(null);
      void loadPortfolios();
    } catch (e) {
      Alert.alert('Join failed', (e as Error).message);
    } finally {
      setBusyJoin(false);
    }
  }

  const refreshDisabled = portfolioRefreshing || portfolioLoading;
  const refreshLabel = portfolioRefreshing ? 'Refreshing…' : 'Refresh';

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
                navigation.navigate('Lobby', {
                  gameId: portfolio.id,
                  name: portfolio.name,
                  inviteCode: portfolio.invite_code ?? undefined,
                })
              }
            >
              <View style={styles.portfolioCardHeader}>
                <Text style={styles.portfolioName}>{portfolio.name}</Text>
                <Badge
                  label={badge.label}
                  customColors={{ bg: badge.bg, color: badge.color, border: badge.border }}
                />
              </View>
              <Text style={styles.portfolioMeta}>Joined {formatShortDate(portfolio.joined_at)}</Text>
              <Text style={styles.portfolioSubline}>{describePortfolioStatus(portfolio)}</Text>
              <View style={styles.portfolioFooter}>
                <Text style={styles.portfolioInvite}>Invite {portfolio.invite_code ?? '—'}</Text>
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
        <SectionHeader title="Your Portfolios" subtitle="Jump back into a lobby" action={refreshButton} />
        {portfolioContent}
      </Card>

      <Card style={styles.card} padding={spacing.xl} gap={spacing.md}>
        <SectionHeader title="Create Game" subtitle="Name your lobby and invite friends" />
        <View style={styles.formStack}>
          <Input
            placeholder="Lobby name"
            autoCapitalize="words"
            autoCorrect={false}
            value={createName}
            onChangeText={setCreateName}
          />
          <Button label="Random" variant="ghost" onPress={onRandom} />
          <Button label={busyCreate ? 'Working…' : 'Create'} onPress={onCreate} disabled={busyCreate} />

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
        <SectionHeader title="Join Game" subtitle="Enter an invite code to hop in" />
        <View style={styles.formStack}>
          <Input
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Invite code"
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <Button
            label={busyJoin ? 'Working…' : 'Join'}
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
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  card: {
    width: '100%',
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
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surfaceRaised,
  },
  portfolioStateText: {
    color: palette.textSecondary,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  portfolioName: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  portfolioMeta: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  portfolioSubline: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  portfolioFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portfolioInvite: {
    color: palette.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  portfolioLink: {
    color: palette.accentBlueSoft,
    fontWeight: '700',
  },
});
