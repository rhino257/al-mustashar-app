import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';
import Constants from 'expo-constants';

const AboutScreen = () => {
  const appVersion = Constants.expoConfig?.version || 'N/A';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'حول' }} />
      <Text style={styles.text}>About Settings Placeholder</Text>
      <Text style={styles.versionText}>Version: {appVersion}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.chatgptBackground,
  },
  text: {
    color: Colors.white,
    fontSize: 20,
    marginBottom: 10, // Add some space below the placeholder text
  },
  versionText: {
    color: Colors.white,
    fontSize: 16,
  },
});

export default AboutScreen;
