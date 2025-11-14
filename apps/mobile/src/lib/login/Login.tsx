import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../auth/supabase';
import { Button, Card, FieldLabel, Input } from '../ui/components';
import { palette, spacing } from '../ui/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    if (!email.includes('@')) return Alert.alert('Invalid email');
    if (!password) return Alert.alert('Password required');

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) return Alert.alert('Login failed', error.message);
  }

  return (
    <Card tone="muted" padding={spacing.xl} gap={spacing.md + 2} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to rejoin your leagues</Text>
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
        <Input secureTextEntry placeholder="••••••••" value={password} onChangeText={setPassword} />
      </View>

      <Button label={busy ? 'Working…' : 'Log in'} onPress={onLogin} disabled={busy} />
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
