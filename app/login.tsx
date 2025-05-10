import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { supabase } from '@/utils/supabase'; // Import Supabase client
import { useLocalSearchParams } from 'expo-router';
// Removed Clerk imports: useSignIn, useSignUp
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Image,
  Platform,
} from 'react-native';

const Login = () => {
  const { type } = useLocalSearchParams<{ type: string }>();
  // Removed Clerk hooks: signIn, setActive, isLoaded, signUp, signUpLoaded, signupSetActive

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignInPress = async () => {
    setLoading(true);
    try {
      // Supabase sign-in logic
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailAddress,
        password: password,
      });

      if (error) {
        Alert.alert('Sign In Error', error.message);
      } else if (data.session) {
        // Successful sign-in, AuthContext will handle the session.
        // No explicit navigation needed here usually if _layout.tsx handles it based on session.
        // Alert.alert('Sign In Successful!'); // Optional success message
      } else {
         Alert.alert('Sign In Failed', 'Please check your credentials or try again.');
      }
    } catch (err: any) { // Keep the generic catch
      Alert.alert('Sign In Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const onSignUpPress = async () => {
    setLoading(true);

    try {
      // Supabase sign-up logic
      const { data, error } = await supabase.auth.signUp({
        email: emailAddress,
        password: password,
      });

      if (error) {
        Alert.alert('Sign Up Error', error.message);
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        // This condition often indicates email confirmation is pending
        // Or if data.session is null but data.user exists
        Alert.alert('Sign Up Successful', 'Please check your email to confirm your account.');
        // Optionally, you might want to navigate the user away or clear fields
      } else if (data.session) {
        // If session is immediately available (e.g., email confirmation disabled in Supabase)
        Alert.alert('Sign Up Successful!', 'You are now signed in.');
        // The AuthContext will handle the session and trigger navigation via _layout.tsx
      } else {
         Alert.alert('Sign Up Successful', 'Please check your email to confirm your account if required.');
      }
      // router.replace('/'); // Consider if navigation is needed here or handled by AuthContext
    } catch (err: any) { // Keep the generic catch for unexpected errors
      Alert.alert('Sign Up Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={70}
      style={styles.container}>
      {loading && (
        <View style={defaultStyles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <Image source={require('../assets/images/logo-dark.png')} style={styles.logo} />

      <Text style={styles.title}>{type === 'login' ? 'Welcome back' : 'Create your account'}</Text>
      <View style={{ marginBottom: 30 }}>
        <TextInput
          autoCapitalize="none"
          placeholder="john@apple.com"
          value={emailAddress}
          onChangeText={setEmailAddress}
          style={styles.inputField}
        />
        <TextInput
          placeholder="password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.inputField}
        />
      </View>

      {type === 'login' ? (
        <TouchableOpacity style={[defaultStyles.btn, styles.btnPrimary]} onPress={onSignInPress}>
          <Text style={styles.btnPrimaryText}>Login</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[defaultStyles.btn, styles.btnPrimary]} onPress={onSignUpPress}>
          <Text style={styles.btnPrimaryText}>Create account</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 60,
    height: 60,
    alignSelf: 'center',
    marginVertical: 80,
  },
  title: {
    fontSize: 30,
    marginBottom: 20,
    fontWeight: 'bold',
    alignSelf: 'center',
  },
  inputField: {
    marginVertical: 4,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    marginVertical: 4,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default Login;
