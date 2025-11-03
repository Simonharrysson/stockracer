import { useState } from 'react';
import { Alert, TextInput, TouchableOpacity, View, Text } from 'react-native';
import { supabase } from '../auth/supabase';

export default function SignUpScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    async function onSignUp() {
        if (!email.includes('@')) return Alert.alert('Invalid email');
        if (password.length < 6) return Alert.alert('Password must be ≥ 6 chars');

        setBusy(true);
        const { data, error } = await supabase.auth.signUp({ email, password });
        setBusy(false);

        if (error) return Alert.alert('Sign-up failed', error.message);

        if (data.session) {
            Alert.alert('Signed up', 'You are signed in.');
        } else {
            Alert.alert('Check your email', 'Confirm your address to finish sign-up.');
        }
    }

    return (
        <View className="flex-1 bg-zinc-900 flex items-center justify-center px-6">
            <Text className="text-white text-2xl mb-6">Create account</Text>

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
                onPress={onSignUp}
                disabled={busy}
            >
                <Text className="text-white text-base">{busy ? 'Working…' : 'Sign up'}</Text>
            </TouchableOpacity>
        </View>
    );
}
