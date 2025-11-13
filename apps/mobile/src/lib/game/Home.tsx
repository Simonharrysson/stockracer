import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { supabase } from '../auth/supabase';

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

export default function Home() {
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);

  const [createdGame, setCreatedGame] = useState<CreateLobbyResponse['data'] | null>(null);
  const [joinedGame, setJoinedGame] = useState<JoinGameResponse['data'] | null>(null);

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
      setJoinedGame(null);
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
      setCreatedGame(null);
    } catch (e) {
      Alert.alert('Join failed', (e as Error).message);
    } finally {
      setBusyJoin(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>StockRacer</Text>

      {/* Create Lobby */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Game</Text>
        <TextInput
          style={styles.input}
          placeholder="Lobby name"
          placeholderTextColor="#9ca3af"
          value={createName}
          onChangeText={setCreateName}
        />
        <TouchableOpacity style={styles.buttonGhost} onPress={onRandom}>
          <Text style={styles.buttonGhostLabel}>Random</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonPrimary} onPress={onCreate} disabled={busyCreate}>
          <Text style={styles.buttonLabel}>{busyCreate ? 'Working…' : 'Create'}</Text>
        </TouchableOpacity>

        {createdGame && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>Created “{createdGame.name}”</Text>
            <Text style={styles.resultText}>Invite code: {createdGame.invite_code}</Text>
            <Text style={styles.resultSub}>Share this code so friends can join.</Text>
          </View>
        )}
      </View>

      {/* Join Game */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Join Game</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="characters"
          placeholder="Invite code"
          placeholderTextColor="#9ca3af"
          value={joinCode}
          onChangeText={setJoinCode}
        />
        <TouchableOpacity style={styles.buttonSecondary} onPress={onJoin} disabled={busyJoin}>
          <Text style={styles.buttonLabel}>{busyJoin ? 'Working…' : 'Join'}</Text>
        </TouchableOpacity>

        {joinedGame && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>Joined “{joinedGame.game_name}”</Text>
            <Text style={styles.resultSub}>You can start when everyone is in.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    marginBottom: 10,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '700',
  },
  buttonGhost: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonGhostLabel: {
    color: '#111827',
    fontWeight: '700',
  },
  resultBox: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
  },
  resultText: {
    color: '#111827',
    fontWeight: '600',
  },
  resultSub: {
    color: '#6b7280',
    marginTop: 4,
  },
});
