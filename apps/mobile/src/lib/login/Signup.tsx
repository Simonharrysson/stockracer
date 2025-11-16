import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../auth/supabase';
import { Button, Card, FieldLabel, Input } from '../ui/components';
import { palette, spacing } from '../ui/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSignUp() {
    if (!email.includes('@')) return Alert.alert('Invalid email');
    if (password.length < 6) return Alert.alert('Password must be ≥ 6 chars');
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return Alert.alert('Username must be at least 3 characters');
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: trimmedUsername },
      },
    });
    setBusy(false);

    if (error) return Alert.alert('Sign-up failed', error.message);

    if (data.session && data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        username: trimmedUsername,
      });
      Alert.alert('Signed up', 'You are signed in.');
    } else {
      Alert.alert('Check your email', 'Confirm your address to finish sign-up.');
    }
  }

  return (
    <Card tone="muted" padding={spacing.xl} gap={spacing.md + 2} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Draft with friends in seconds</Text>
      </View>

      <View style={styles.field}>
        <FieldLabel>Email</FieldLabel>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <View style={styles.field}>
        <FieldLabel>Password</FieldLabel>
        <Input
          secureTextEntry
          placeholder="At least 6 characters"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <View style={styles.field}>
        <FieldLabel>Username</FieldLabel>
        <Input
          placeholder="Unique handle"
          value={username}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUsername}
        />
      </View>
      <Button label={busy ? 'Working…' : 'Create account'} onPress={onSignUp} disabled={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 24,
    color: palette.textPrimary,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.textMuted,
  },
  field: {
    gap: spacing.xs,
  },
});
