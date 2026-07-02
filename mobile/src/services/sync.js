import { getStepsForDate, toApiDateString } from './health';
import { logSteps } from './api';

/**
 * Pull today's step count from the phone's health app and push it to the
 * backend for a given challenge. Call this:
 *  - right after the user joins a challenge
 *  - whenever the app comes to the foreground (see App.js AppState listener)
 *  - on a pull-to-refresh in the challenge detail screen
 *
 * There is no way to sync in the background while the app is closed without
 * a native background task (iOS Background Fetch / Android WorkManager) —
 * that's a further step once the basic foreground sync is working and
 * tested on real devices.
 */
export async function syncTodaySteps(challengeId) {
  const today = new Date();
  const steps = await getStepsForDate(today);
  return logSteps(challengeId, toApiDateString(today), steps);
}
