import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AuthScreen from './src/screens/AuthScreen';
import ChallengeListScreen from './src/screens/ChallengeListScreen';
import ChallengeDetailScreen from './src/screens/ChallengeDetailScreen';
import { theme } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Re-syncing steps happens per-challenge from ChallengeDetailScreen's
    // "Sync today's steps" button and right after connecting a health app.
    // This listener is a hook point if you want to also auto-sync whenever
    // the app is foregrounded — wire it to your active challenge id(s) once
    // you decide how a user's "current" challenge is tracked.
    const sub = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.ground },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.ground },
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Challenges" component={ChallengeListScreen} options={{ title: 'StepWin' }} />
        <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{ title: 'Challenge' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
