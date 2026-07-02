import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Point this at your deployed backend before shipping — localhost only
// works for the simulator/emulator talking to a machine on the same network.
export const API_BASE = 'https://your-stepwin-api.example.com/api';

const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('stepwin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function signup(name, email, password) {
  const { data } = await client.post('/signup', { name, email, password });
  await AsyncStorage.setItem('stepwin_token', data.token);
  return data.user;
}

export async function login(email, password) {
  const { data } = await client.post('/login', { email, password });
  await AsyncStorage.setItem('stepwin_token', data.token);
  return data.user;
}

export async function logout() {
  await AsyncStorage.removeItem('stepwin_token');
}

export async function getChallenges() {
  const { data } = await client.get('/challenges');
  return data;
}

export async function getChallenge(id) {
  const { data } = await client.get(`/challenges/${id}`);
  return data;
}

export async function createJoinOrder(challengeId) {
  const { data } = await client.post(`/challenges/${challengeId}/join/create-order`);
  return data;
}

export async function verifyJoin(challengeId, razorpayResponse) {
  const { data } = await client.post(`/challenges/${challengeId}/join/verify`, razorpayResponse);
  return data;
}

export async function logSteps(challengeId, date, count) {
  const { data } = await client.post(`/challenges/${challengeId}/steps`, { date, count });
  return data;
}
