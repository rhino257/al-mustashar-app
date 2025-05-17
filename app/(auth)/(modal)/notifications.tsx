import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

const NotificationsScreen = () => {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'الإشعارات' }} />
      <Text style={styles.text}>Notifications Settings Placeholder</Text>
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

export default NotificationsScreen;
