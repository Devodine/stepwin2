import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { getChallenge, createJoinOrder, verifyJoin } from '../services/api';
import { requestHealthPermissions } from '../services/health';
import { syncTodaySteps } from '../services/sync';
import { theme } from '../theme';

export default function ChallengeDetailScreen({ route }) {
  const { id } = route.params;
  const [challenge, setChallenge] = useState(null);
  const [joined, setJoined] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getChallenge(id);
    setChallenge(data);
    // NOTE: swap this for a real "am I a participant" check from the API
    // (e.g. add a `youJoined` boolean to GET /challenges/:id) rather than
    // inferring it from the leaderboard, which only lists people who logged steps.
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleJoin() {
    try {
      const order = await createJoinOrder(id);
      const options = {
        description: 'Challenge entry fee',
        currency: order.currency,
        key: order.razorpayKeyId,
        amount: order.amount * 100,
        order_id: order.orderId,
        name: 'StepWin',
        theme: { color: theme.accent },
      };
      const response = await RazorpayCheckout.open(options);
      await verifyJoin(id, {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
      setJoined(true);
      Alert.alert('You\'re in!', 'Connect your health app to start syncing steps.');
      load();
    } catch (err) {
      // RazorpayCheckout rejects with { code, description } on cancel/failure
      Alert.alert('Payment not completed', err.description || err.response?.data?.error || err.message);
    }
  }

  async function handleConnectHealth() {
    try {
      await requestHealthPermissions();
      setHealthConnected(true);
      Alert.alert('Connected', 'Your health app is connected. Syncing today\'s steps now.');
      await handleSync();
    } catch (err) {
      Alert.alert('Could not connect', err.message);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const data = await syncTodaySteps(id);
      setChallenge((prev) => ({ ...prev, leaderboard: data.leaderboard }));
    } catch (err) {
      Alert.alert('Sync failed', err.response?.data?.error || err.message);
    } finally {
      setSyncing(false);
    }
  }

  if (loading || !challenge) {
    return <View style={styles.container}><ActivityIndicator color={theme.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{challenge.title}</Text>
      <Text style={styles.desc}>{challenge.description}</Text>

      <View style={styles.statsRow}>
        <Stat label="Entry" value={`₹${challenge.entryFee}`} />
        <Stat label="Pool" value={`₹${challenge.prizePool}`} />
        <Stat label="Players" value={String(challenge.participantCount)} />
      </View>

      {!joined && (
        <TouchableOpacity style={styles.button} onPress={handleJoin}>
          <Text style={styles.buttonText}>Pay ₹{challenge.entryFee} & join</Text>
        </TouchableOpacity>
      )}

      {joined && !healthConnected && (
        <TouchableOpacity style={styles.button} onPress={handleConnectHealth}>
          <Text style={styles.buttonText}>Connect health app</Text>
        </TouchableOpacity>
      )}

      {joined && healthConnected && (
        <TouchableOpacity style={styles.buttonOutline} onPress={handleSync} disabled={syncing}>
          <Text style={styles.buttonOutlineText}>{syncing ? 'Syncing...' : 'Sync today\'s steps'}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.subheading}>Leaderboard</Text>
      <FlatList
        data={challenge.leaderboard}
        keyExtractor={(row) => String(row.userId)}
        ListEmptyComponent={<Text style={styles.muted}>No steps logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowRank}>{item.rank}</Text>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowSteps}>{item.totalSteps.toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ground, padding: 20 },
  title: { color: theme.text, fontSize: 22, fontWeight: '900', marginTop: 12 },
  desc: { color: theme.muted, marginTop: 6, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1, borderRadius: 8, padding: 10 },
  statLabel: { color: theme.muted, fontSize: 11, textTransform: 'uppercase' },
  statValue: { color: theme.accent2, fontSize: 18, fontWeight: '700', marginTop: 2 },
  button: { backgroundColor: theme.accent, borderRadius: 6, padding: 14, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: theme.ground, fontWeight: '700', fontSize: 15 },
  buttonOutline: { borderColor: theme.accent, borderWidth: 1, borderRadius: 6, padding: 14, alignItems: 'center', marginBottom: 20 },
  buttonOutlineText: { color: theme.accent, fontWeight: '700', fontSize: 15 },
  subheading: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  muted: { color: theme.muted },
  row: { flexDirection: 'row', paddingVertical: 10, borderBottomColor: theme.line, borderBottomWidth: 1, gap: 12 },
  rowRank: { color: theme.muted, width: 24 },
  rowName: { color: theme.text, flex: 1 },
  rowSteps: { color: theme.accent2, fontWeight: '700' },
});
