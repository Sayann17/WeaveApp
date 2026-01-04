// app/(tabs)/index.tsx
import { Redirect } from 'expo-router';
import React from 'react';

export default function HomeScreen() {
  // Redirect to Profile immediately, bypassing the "Home" screen
  return <Redirect href="/(tabs)/profile" />;
}