import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

const ProfileScreen = () => {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'الملف الشخصي' }} />
      <Text style={styles.text}>Profile Settings Placeholder</Text>
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

export default ProfileScreen;
