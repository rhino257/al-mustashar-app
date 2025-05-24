import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient, Session, User, SupportedStorage } from '@supabase/supabase-js'; // Import SupportedStorage
import { Platform } from 'react-native'; // Import Platform
import { supabaseUrl, supabaseAnonKey, AsyncStorageAdapter } from '@/utils/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  fullName: string | null;
  avatarText: string | null;
  phoneNumber: string | null;
  onboardingStatus: string | null;
  processLogin: (session: Session) => Promise<void>;
  refreshUserProfile: () => Promise<void>; // Function to manually refresh user profile
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = useMemo(() => {
    const storageAdapter = Platform.OS === 'web' ? undefined : AsyncStorageAdapter; // Conditional storage

    return createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        auth: {
          storage: storageAdapter as SupportedStorage, // Use the conditional adapter
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // Recommended to be false for React Native
        },
      }
    );
  }, []);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarText, setAvatarText] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);

  const fetchUserProfile = async (currentUserId: string) => {
    if (!currentUserId) return;
    setIsLoading(true); // Optionally set loading true during refresh
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name, phone_number, onboarding_status')
      .eq('user_id', currentUserId)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      setFullName(null);
      setAvatarText(null);
      setPhoneNumber(null);
      setOnboardingStatus(null);
    } else if (userData) {
      setFullName(userData.full_name || null);
      setPhoneNumber(userData.phone_number || null);
      setOnboardingStatus(userData.onboarding_status || null);
      const { data: { user: authUser } } = await supabase.auth.getUser(); // Get current auth user to derive avatar
      if (authUser?.email) {
        const emailParts = authUser.email.split('@')[0];
        const initialLetters = emailParts.substring(0, 2).toUpperCase();
        setAvatarText(initialLetters);
      } else {
        setAvatarText(null);
      }
    }
    setIsLoading(false); // Set loading false after refresh
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Supabase auth event: ${event}`);
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
        console.log('[AuthContext] setIsLoading to false (onAuthStateChange)');


        if (session?.user) {
          fetchUserProfile(session.user.id);
        } else {
          // Clear user data on sign out
          setFullName(null);
          setAvatarText(null);
          setPhoneNumber(null);
          setOnboardingStatus(null);
        }
      }
    );

    // Initial session check
    const fetchInitialSession = async () => {
      setIsLoading(true);
      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Error fetching initial session:", sessionError);
        setIsLoading(false);
        return;
      }

      setSession(initialSession);
      setUser(initialSession?.user || null);

      if (initialSession?.user) {
        await fetchUserProfile(initialSession.user.id);
      } else {
        setFullName(null);
        setAvatarText(null);
        setPhoneNumber(null);
        setOnboardingStatus(null);
        setIsLoading(false); // Ensure loading is false if no user
      }
      // setIsLoading(false); // fetchUserProfile will set this
    };

    fetchInitialSession();


    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setIsLoading(true);
    console.log('[AuthContext] setIsLoading to true (signOut)');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      setIsLoading(false); // Keep loading indicator if sign out fails? Or handle error differently.
      console.log('[AuthContext] setIsLoading to false (signOut error)');
    }
    // onAuthStateChange listener will handle setting session/user to null
  };

  const processLogin = async (newSession: Session) => {
    setIsLoading(true);
    setSession(newSession);
    setUser(newSession.user);

    if (newSession.user) {
      await fetchUserProfile(newSession.user.id);
    } else {
      setFullName(null);
      setAvatarText(null);
      setPhoneNumber(null);
      setOnboardingStatus(null);
      setIsLoading(false);
    }
    // setIsLoading(false); // fetchUserProfile will set this
  };

  const refreshUserProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signOut,
        fullName,
        avatarText,
        phoneNumber,
        onboardingStatus,
        processLogin,
        refreshUserProfile, // Provide the refresh function
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
