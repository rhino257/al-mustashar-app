import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

const SubscriptionScreen = () => {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'إدارة الاشتراك' }} />
      <Text style={styles.text}>Subscription Settings Placeholder</Text>
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
  },
});

export default SubscriptionScreen;
