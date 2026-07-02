import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { login, signup } from '../services/api';
import { theme } from '../theme';

export default function AuthScreen({ navigation }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      navigation.replace('Challenges');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step<Text style={{ color: theme.accent }}>Win</Text></Text>

      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setMode('login')} style={[styles.tab, mode === 'login' && styles.tabActive]}>
          <Text style={mode === 'login' ? styles.tabTextActive : styles.tabText}>Log in</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('signup')} style={[styles.tab, mode === 'signup' && styles.tabActive]}>
          <Text style={mode === 'signup' ? styles.tabTextActive : styles.tabText}>Sign up</Text>
        </TouchableOpacity>
      </View>

      {mode === 'signup' && (
        <TextInput style={styles.input} placeholder="Name" placeholderTextColor={theme.muted} value={name} onChangeText={setName} />
      )}
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor={theme.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor={theme.muted} secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ground, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: theme.text, marginBottom: 32, textAlign: 'center' },
  tabs: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  tab: { flex: 1, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: theme.line, alignItems: 'center' },
  tabActive: { backgroundColor: theme.accent2, borderColor: theme.accent2 },
  tabText: { color: theme.muted, fontWeight: '600' },
  tabTextActive: { color: theme.ground, fontWeight: '700' },
  input: { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1, borderRadius: 6, padding: 12, color: theme.text, marginBottom: 12 },
  button: { backgroundColor: theme.accent, borderRadius: 6, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: theme.ground, fontWeight: '700', fontSize: 16 },
});
