import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { getChallenges } from '../services/api';
import { theme } from '../theme';

export default function ChallengeListScreen({ navigation }) {
  const [challenges, setChallenges] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getChallenges();
    setChallenges(data);
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Active challenges</Text>
      <FlatList
        data={challenges}
        keyExtractor={(c) => String(c.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { id: item.id })}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>₹{item.entryFee} entry</Text>
              <Text style={styles.metaText}>₹{item.prizePool} pool</Text>
              <Text style={styles.metaText}>{item.participantCount} challengers</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ground, padding: 20 },
  header: { color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 16, marginTop: 12 },
  card: { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12 },
  cardTitle: { color: theme.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: theme.muted, marginBottom: 10 },
  meta: { flexDirection: 'row', gap: 16 },
  metaText: { color: theme.accent2, fontSize: 13, fontWeight: '600' },
});
