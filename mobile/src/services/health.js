import { Platform } from 'react-native';

// iOS: Apple HealthKit. Android: Google Health Connect.
// Both libraries are native modules — this file only works inside a real
// React Native build (run-ios / run-android), not in a browser or Expo Go.

let AppleHealthKit;
let HealthConnect;
if (Platform.OS === 'ios') {
  AppleHealthKit = require('react-native-health').default;
} else if (Platform.OS === 'android') {
  HealthConnect = require('react-native-health-connect');
}

/**
 * Ask the user for permission to read step data.
 * Must be called before getTodaySteps(). Show this at a clear moment in
 * the UI (e.g. "Connect your step tracker") — don't call it silently.
 */
export async function requestHealthPermissions() {
  if (Platform.OS === 'ios') {
    return new Promise((resolve, reject) => {
      const permissions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.StepCount],
          write: [],
        },
      };
      AppleHealthKit.initHealthKit(permissions, (err) => {
        if (err) return reject(new Error('HealthKit permission denied: ' + err));
        resolve(true);
      });
    });
  }

  if (Platform.OS === 'android') {
    const isAvailable = await HealthConnect.initialize();
    if (!isAvailable) {
      throw new Error(
        'Health Connect is not installed on this device. Prompt the user to install it from the Play Store.'
      );
    }
    const granted = await HealthConnect.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return granted.length > 0;
  }

  throw new Error('Unsupported platform for health sync');
}

/**
 * Returns the step count for a given local calendar day (defaults to today)
 * as a plain number.
 */
export async function getStepsForDate(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  if (Platform.OS === 'ios') {
    return new Promise((resolve, reject) => {
      const options = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      };
      AppleHealthKit.getStepCount(options, (err, results) => {
        if (err) return reject(new Error('Could not read HealthKit steps: ' + err));
        // results.value is the total step count for the range on iOS
        resolve(Math.round(results?.value || 0));
      });
    });
  }

  if (Platform.OS === 'android') {
    const { records } = await HealthConnect.readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
      },
    });
    const total = records.reduce((sum, r) => sum + (r.count || 0), 0);
    return total;
  }

  throw new Error('Unsupported platform for health sync');
}

/** YYYY-MM-DD, matching the `date` field the backend's /steps endpoint expects. */
export function toApiDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
