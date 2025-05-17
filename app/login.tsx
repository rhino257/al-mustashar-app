import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { supabase } from '@/utils/supabase'; // Import Supabase client
import { useLocalSearchParams } from 'expo-router';
// Removed Clerk imports: useSignIn, useSignUp
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router'; // Import useRouter
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
  console.log('Login page type:', type); // Add logging for the type parameter
  const router = useRouter(); // Initialize router
  // Removed Clerk hooks: signIn, setActive, isLoaded, signUp, signUpLoaded, signupSetActive

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [isAppleLoginDisabled, setIsAppleLoginDisabled] = useState(true); // Initialize as true to make it disabled by default
  const [showAppleFeatureUnavailableMessage, setShowAppleFeatureUnavailableMessage] = useState(false);
  const appleMessageTimerRef = React.useRef<NodeJS.Timeout | null>(null); // Use React.useRef

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

  const handleAppleFeatureUnavailable = () => {
    console.log('handleAppleFeatureUnavailable called');
    if (appleMessageTimerRef.current) {
      clearTimeout(appleMessageTimerRef.current);
    }
    setShowAppleFeatureUnavailableMessage(true);
    appleMessageTimerRef.current = setTimeout(() => {
      setShowAppleFeatureUnavailableMessage(false);
    }, 4000); // Message will disappear after 4 seconds
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

  <Text style={styles.title}>{type === 'login' ? 'أهلاً بعودتك' : 'انشاء حساب'}</Text>
  <View style={{ marginBottom: 30 }}>
    <TextInput
      autoCapitalize="none"
      placeholder="john@apple.com"
      value={emailAddress}
      onChangeText={setEmailAddress}
      style={styles.inputField}
    />
    <TextInput
      placeholder="كلمة المرور"
      value={password}
      onChangeText={setPassword}
      secureTextEntry
      style={styles.inputField}
    />
  </View>

  {type === 'login' ? (
    <>
      <TouchableOpacity style={[defaultStyles.btn, styles.btnPrimary]} onPress={onSignInPress}>
        <Text style={styles.btnPrimaryText}>تسجيل الدخول</Text>
      </TouchableOpacity>

      <Link href="/login?type=signup" asChild style={{ alignSelf: 'center', marginTop: 20 }}>
      <TouchableOpacity style={{ flexDirection: 'row' }}>
          <Text style={styles.linkText}>انشئ حسابك</Text>
          <Text style={styles.blackText}>ليس لديك حساب؟ </Text>
        </TouchableOpacity>
      </Link>
    </>
  ) : (
    <>
      <TouchableOpacity style={[defaultStyles.btn, styles.btnPrimary]} onPress={onSignUpPress}>
        <Text style={styles.btnPrimaryText}>انشاء حساب</Text>
      </TouchableOpacity>

      <Link href="/login?type=login" asChild style={{ alignSelf: 'center', marginTop: 20 }}>
      <TouchableOpacity style={{ flexDirection: 'row' }}>
          <Text style={styles.linkText}>تسجيل الدخول من هنا</Text>
          <Text style={styles.blackText}>هل لديك حساب بالفعل؟ </Text>
        </TouchableOpacity>
      </Link>
    </>
  )}

      <View style={styles.seperatorView}>
        <View style={styles.seperator} />
        <Text style={styles.seperatorText}>او سجل الدخول عبر</Text>
        <View style={styles.seperator} />
      </View>

      <TouchableOpacity style={[defaultStyles.btn, styles.socialBtn, styles.btnLight, styles.socialButtonSpacing]}>
        <Ionicons name="logo-google" size={24} style={styles.btnIcon} color={'#000'} />
        <Text style={styles.btnLightText}>استمر مع جوجل</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          defaultStyles.btn,
          styles.socialBtn,
          styles.btnLight,
          isAppleLoginDisabled && styles.btnDisabled, // Apply disabled style
        ]}
        onPress={() => {
          if (isAppleLoginDisabled) {
            handleAppleFeatureUnavailable(); // Call the message handler
          } else {
            // Actual Apple login logic would go here if it were enabled
            console.log('Apple login would proceed here.');
          }
        }}
      >
        <Ionicons
          name="logo-apple"
          size={24}
          style={styles.btnIcon}
          color={isAppleLoginDisabled ? Colors.grey : '#000'} // Change icon color when disabled
        />
        <Text
          style={[
            styles.btnLightText,
            isAppleLoginDisabled && styles.btnTextDisabled, // Apply disabled text style
          ]}
        >
          استمر مع ابل
        </Text>
      </TouchableOpacity>

      {/* Popup Message for Apple Login Feature Unavailable */}
      {showAppleFeatureUnavailableMessage && (
        <>
          {console.log('showAppleFeatureUnavailableMessage is true, rendering popup')}
          <View style={styles.featureUnavailablePopup}>
            <Text style={styles.featureUnavailablePopupText}>
              هذة الميزة قيد التطوير
            </Text>
          </View>
        </>
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
    borderRadius: 25, // Increased border radius
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
  seperatorView: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginVertical: 30,
  },
  seperator: {
    flex: 1,
    borderBottomColor: '#000',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seperatorText: {
    fontSize: 16,
  },
  btnIcon: {
    paddingRight: 6,
  },
  btnOutlineText: {
    color: '#000',
    fontSize: 16,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 16,
  },
  socialBtn: {
    borderColor: '#000', // Changed border color to black
    borderWidth: 1,
  },
  btnLight: { // Added btnLight style definition
    backgroundColor: '#fff',
  },
  btnLightText: { // Added btnLightText style definition
    color: '#000',
    fontSize: 16, // Adjusted font size to match other text
  },
  socialButtonSpacing: { // Added style for spacing
    marginBottom: 10,
  },
  blackText: { // Added style for black text
    color: '#000',
    fontSize: 16,
  },

  // New styles for disabled button
  btnDisabled: {
    backgroundColor: '#e0e0e0', // A lighter gray for the button background
    opacity: 0.7,             // Make it slightly transparent
    borderColor: '#c0c0c0',   // A slightly darker gray for the border
  },
  btnTextDisabled: {
    color: Colors.grey, // Text color for disabled button
  },

  // Updated styles for a flexible feature unavailable popup
  featureUnavailablePopup: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',    // Keep this for initial centering of the popup content
    marginLeft: 100,        // Pushes the entire popup to the RIGHT by 100 units.
                            // This means it will appear more towards the left side of the button.
                            // Adjust this value (e.g., 80, 120) as needed.
    maxWidth: '60%',        // Constrain width to prevent it from becoming too wide.
                            // Adjust if needed, e.g., '50%' or '70%'.
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
  },
  featureUnavailablePopupText: {
    color: '#ffffff',
    fontSize: 14,               // Slightly larger font size again, or keep at 13
    textAlign: 'center',
    // For Arabic, ensuring proper text direction handling if not default
    // writingDirection: 'rtl', // Usually not needed if device/app locale is correct
  },

});

export default Login;
