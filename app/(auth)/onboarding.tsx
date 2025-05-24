import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

const OnboardingScreen = () => {
  const router = useRouter();
  const { refreshUserProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // Reverted to simple phoneNumber
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!fullName.trim()) {
      setError('الرجاء إدخال اسمك الكامل.');
      return;
    }
    // Basic phone number validation (can be improved, assumes full number with country code if applicable)
    if (!phoneNumber.trim() || !/^[0-9\s+-]{7,}$/.test(phoneNumber)) {
        setError('الرجاء إدخال رقم هاتف صحيح.');
        return;
    }
    setError(null);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Update the user's profile with onboarding information
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: fullName,
            phone_number: phoneNumber,
            onboarding_status: 'completed',
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating user profile:', updateError);
          throw updateError;
        }

        await refreshUserProfile(); // Refresh the user profile in context
        // Navigate to the main part of the app after successful onboarding
        // Adjust the navigation path as per your app's structure
        router.replace('/(auth)/(drawer)/(chat)/new'); // Changed to new chat screen
      } else {
        throw new Error('المستخدم غير موثق.');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Failed to complete profile', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>أكمل ملفك الشخصي</Text>
      <Text style={styles.subtitle}>أخبرنا المزيد عن نفسك.</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        style={[styles.inputField, styles.input, styles.textAlignRight]}
        placeholder="الاسم الكامل"
        value={fullName}
        onChangeText={setFullName}
        placeholderTextColor={Colors.grey}
      />

      <TextInput
        style={[styles.inputField, styles.input, styles.textAlignRight]}
        placeholder="رقم الهاتف (مثال: 967777777777+)" // Updated placeholder
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        placeholderTextColor={Colors.grey}
      />

      <TouchableOpacity
        style={[defaultStyles.btn, styles.continueButton]}
        onPress={handleContinue}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.btnText}>حفظ ومتابعة</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.light,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: Colors.dark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.grey,
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    marginBottom: 15,
    width: '100%',
  },
  inputField: { // Styles for inputField remain, phoneInputContainer and related are removed
    height: 50,
    borderWidth: 1,
    borderColor: Colors.greyLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.input,
    color: Colors.dark,
    width: '100%', // This will be overridden by flex in phoneInput
  },
  textAlignRight: {
    textAlign: 'right',
  },
  continueButton: {
    marginTop: 20,
    width: '100%',
    backgroundColor: Colors.primary,
  },
  // Define btnText style locally
  btnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: Colors.danger, // Using Colors.danger
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default OnboardingScreen;
