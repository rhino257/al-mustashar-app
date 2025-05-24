import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';
import Constants from 'expo-constants';

const AboutScreen = () => {
  const appVersion = Constants.expoConfig?.version || 'N/A';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'حول' }} />
      <Text style={styles.text}>إعدادات حول التطبيق</Text>
      <Text style={styles.versionText}>الإصدار: {appVersion}</Text>
      <Text style={styles.companyText}>تم انشاءه بواسطة مجموعة الشركة العملاقة</Text>
      <Image source={require('../../../assets/images/icon1.png')} style={styles.logoImage} />
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
    textAlign: 'center',
  },
  versionText: {
    color: Colors.white,
    fontSize: 16,
    marginBottom: 20, // Add space below version
    textAlign: 'center',
  },
  companyText: {
    color: Colors.white,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  logoImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  }
});

export default AboutScreen;
