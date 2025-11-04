import { useState } from 'react';
import { Alert, TextInput, TouchableOpacity, View, Text } from 'react-native';
import { supabase } from '../auth/supabase';

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
    <View className="flex w-full max-w-md items-center px-6">
      <Text className="text-white text-2xl mb-6">Welcome back</Text>

      <TextInput
        className="w-full bg-zinc-800 text-white px-4 py-3 rounded-2xl mb-3"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="email"
        placeholderTextColor="#9ca3af"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        className="w-full bg-zinc-800 text-white px-4 py-3 rounded-2xl mb-4"
        secureTextEntry
        placeholder="password"
        placeholderTextColor="#9ca3af"
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        className="w-full bg-emerald-600 rounded-2xl py-3 items-center"
        onPress={onLogin}
        disabled={busy}
      >
        <Text className="text-white text-base">{busy ? 'Working…' : 'Log in'}</Text>
      </TouchableOpacity>
    </View>
  );
}

