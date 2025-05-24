import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

const DataControlsScreen = () => {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'عناصر التحكم في البيانات' }} />
      <Text style={styles.text}>إعدادات التحكم في البيانات</Text>
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

export default DataControlsScreen;
