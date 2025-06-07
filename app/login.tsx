import Colors from '@/constants/Colors';
import { defaultStyles } from '@/constants/Styles';
import { supabase } from '@/utils/supabase'; // Import Supabase client
import { useAuth } from '@/contexts/AuthContext'; // << ADD THIS LINE
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState, useRef } from 'react'; // Added useRef
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
  ScrollView, // Import ScrollView
} from 'react-native';

const Login = () => {
  const { type } = useLocalSearchParams<{ type: string }>();
  // console.log('Login page type:', type);
  const router = useRouter();
  const { processLogin } = useAuth(); // << ADD THIS LINE

  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [isAppleLoginDisabled] = useState(true); // Kept as true
  const [showAppleFeatureUnavailableMessage, setShowAppleFeatureUnavailableMessage] = useState(false);
  const appleMessageTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onSignInPress = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailAddress,
        password: password,
      });
      // console.log('[Login] signInWithPassword result:', { data, error }); // DIAGNOSTIC LOG REMOVED
      if (error) {
        Alert.alert('Sign In Error', error.message);
      } else if (data.session) {
        // console.log('[Login] Session received, calling processLogin and router.back()'); // DIAGNOSTIC LOG REMOVED
        // await processLogin(data.session); // << Rely on onAuthStateChange
        router.back(); 
      } else if (data.user && !data.session) { // User exists but no session (e.g. MFA required)
        // console.log('[Login] User exists but no session. MFA or other step might be required.'); // DIAGNOSTIC LOG REMOVED
        Alert.alert('Sign In Pending', 'Additional verification might be required.');
      }
      else {
        // console.log('[Login] No session and no error, but sign in failed.'); // DIAGNOSTIC LOG REMOVED
        Alert.alert('Sign In Failed', 'Please check your credentials or try again.');
      }
    } catch (err: any) {
      console.error('Error during sign in:', err); // Kept console.error for actual errors
      Alert.alert('Sign In Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const onSignUpPress = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailAddress,
        password: password,
      });

      if (error) {
        Alert.alert('Sign Up Error', error.message);
      } else if (data.user) {
        // Sign-up successful at Supabase level
        if (data.session) {
          // Session available immediately (e.g., email confirmation disabled)
          // await processLogin(data.session); // << Rely on onAuthStateChange
        }
        // else: No immediate session (e.g., email confirmation pending).
        // onAuthStateChange in AuthContext will pick up the user.
        // _layout will then navigate based on onboarding status.
        
        // Close the login modal to allow _layout.tsx to handle redirection.
        if (router.canGoBack()) {
          router.back();
        } else {
          // Fallback if login wasn't a modal, though _layout should still react.
          // Potentially navigate to a known entry point if router.back() isn't appropriate.
          // For now, relying on AuthContext + _layout to redirect.
        }
      } else {
        // Should not happen if no error and no user, but as a fallback:
        Alert.alert('Sign Up Failed', 'An unexpected issue occurred. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Sign Up Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // options: {
        //   redirectTo: 'YOUR_APP_SCHEME://callback', // TODO: Configure this for deep linking
        //   // queryParams: { access_type: 'offline', prompt: 'consent' } // Example
        // }
      });
      if (error) {
        Alert.alert('Google Sign-In Error', error.message);
      }
      // For mobile OAuth, successful initiation usually opens a browser/webview.
      // The result (session) is typically handled via deep linking and onAuthStateChange.
      // No direct session object is returned here in the mobile flow usually.
    } catch (err: any) {
      Alert.alert('Google Sign-In Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleFeatureUnavailable = () => {
    if (appleMessageTimerRef.current) {
      clearTimeout(appleMessageTimerRef.current);
    }
    setShowAppleFeatureUnavailableMessage(true);
    appleMessageTimerRef.current = setTimeout(() => {
      setShowAppleFeatureUnavailableMessage(false);
    }, 4000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={defaultStyles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        <Image source={require('../assets/images/logo-dark.png')} style={styles.logo} />

        <Text style={styles.title}>{type === 'login' ? 'أهلاً بعودتك' : 'انشاء حساب'}</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            autoCapitalize="none"
            placeholder="البريد الإلكتروني"
            value={emailAddress}
            onChangeText={setEmailAddress}
            style={styles.inputField}
            keyboardType="email-address"
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
            <View style={styles.linkRow}>
              <Text style={styles.blackText}>ليس لديك حساب؟ </Text>
              <Link href="/login?type=signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>انشئ حسابك</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={[defaultStyles.btn, styles.btnPrimary]} onPress={onSignUpPress}>
              <Text style={styles.btnPrimaryText}>انشاء حساب</Text>
            </TouchableOpacity>
            <View style={styles.linkRow}>
              <Text style={styles.blackText}>هل لديك حساب بالفعل؟ </Text>
              <Link href="/login?type=login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>تسجيل الدخول من هنا</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </>
        )}

        <View style={styles.seperatorView}>
          <View style={styles.seperator} />
          <Text style={styles.seperatorText}>او سجل الدخول عبر</Text>
          <View style={styles.seperator} />
        </View>

        <TouchableOpacity style={[defaultStyles.btn, styles.socialBtn, styles.btnLight, styles.socialButtonSpacing]} onPress={handleGoogleSignIn}>
          <Ionicons name="logo-google" size={20} style={styles.btnIcon} color={'#000'} />
          <Text style={styles.btnLightText}>استمر مع جوجل</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            defaultStyles.btn,
            styles.socialBtn,
            styles.btnLight,
            styles.socialButtonSpacing,
            isAppleLoginDisabled && styles.btnDisabled,
          ]}
          onPress={() => {
            if (isAppleLoginDisabled) {
              handleAppleFeatureUnavailable();
            }
          }}
        >
          <Ionicons
            name="logo-apple"
            size={20} // Matched Google icon size
            style={styles.btnIcon}
            color={isAppleLoginDisabled ? Colors.grey : '#000'}
          />
          <Text
            style={[
              styles.btnLightText,
              isAppleLoginDisabled && styles.btnTextDisabled,
            ]}
          >
            استمر مع ابل
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {showAppleFeatureUnavailableMessage && (
        <View style={styles.featureUnavailablePopup}>
          <Text style={styles.featureUnavailablePopupText}>
            هذة الميزة قيد التطوير
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8', // Example background color for the whole screen
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25, // Slightly increased padding
    paddingVertical: 20,
  },
  logo: {
    width: 70, // Slightly larger logo
    height: 70,
    marginTop: 20, // Reduced top margin when scrolling
    marginBottom: 30,
  },
  title: {
    fontSize: 28, // Slightly adjusted
    marginBottom: 25,
    fontWeight: 'bold',
    textAlign: 'center', // Ensure title is centered
  },
  inputContainer: { // Added a container for inputs for width control
    width: '100%',
    marginBottom: 20, // Was 30
  },
  inputField: {
    marginVertical: 6, // Increased spacing between fields
    height: 50,
    borderWidth: 1,
    borderColor: Colors.lightGray, // Softer border for input
    borderRadius: 12, // Common modern radius
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    textAlign: 'right', // For RTL placeholder/text alignment
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    marginVertical: 10, // Added more vertical margin
    width: '100%',
    height: 50, // Explicit height
    justifyContent: 'center', // Center text vertically
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500', // Medium weight
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25, // Increased spacing
    marginBottom: 25, // Added bottom margin before separator
    flexWrap: 'wrap',
  },
  linkText: {
    color: Colors.primary,
    fontSize: 15, // Slightly smaller
    fontWeight: 'bold',
  },
  blackText: {
    color: '#000',
    fontSize: 15, // Slightly smaller
    marginHorizontal: 3, // Adjust as needed
  },
  seperatorView: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginVertical: 25, // Was 30
    width: '100%',
  },
  seperator: {
    flex: 1,
    borderBottomColor: Colors.grey, // Softer separator color
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seperatorText: {
    color: Colors.grey,
    fontSize: 14,
  },
  socialBtn: {
    borderColor: Colors.grey,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: 50, // Explicit height
  },
  btnIcon: {
    marginHorizontal: 8, // Give icon some space
  },
  btnLight: {
    backgroundColor: '#fff',
  },
  btnLightText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  socialButtonSpacing: {
    marginBottom: 12, // Spacing between social buttons
  },
  btnDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.7,
    borderColor: '#c0c0c0',
  },
  btnTextDisabled: {
    color: Colors.grey,
  },
  featureUnavailablePopup: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20, // Adjusted for potential nav bars
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    paddingVertical: 12, // Increased padding
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
  },
  featureUnavailablePopupText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default Login;
