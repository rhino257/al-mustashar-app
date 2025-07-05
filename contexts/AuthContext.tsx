import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

// Define the possible authentication states
type AuthStatus = 'LOADING' | 'UNAUTHENTICATED' | 'AUTHENTICATED';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  authStatus: AuthStatus;
  isLoading: boolean; // Added isLoading property
  signOut: () => Promise<void>;
  fullName: string | null;
  avatarText: string | null;
  phoneNumber: string | null;
  onboardingStatus: string | null;
  processLogin: (session: Session) => Promise<void>;
  refreshUserProfile: () => Promise<void>; // Function to manually refresh user profile
  currentChatMode: string;
  setCurrentChatMode: (mode: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('LOADING');
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarText, setAvatarText] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [currentChatMode, setCurrentChatModeState] = useState<string>('advisor'); // Default to 'advisor'

  const setCurrentChatMode = (mode: string) => {
    console.log(`[AuthContext] Chat mode changed to: ${mode}`); // Added log
    setCurrentChatModeState(mode);
  };

  const isLoading = useMemo(() => authStatus === 'LOADING', [authStatus]);

  const fetchUserProfileAndRelatedData = useCallback(async (currentUserId: string | undefined) => {
    if (!currentUserId) {
      setFullName(null);
      setAvatarText(null);
      setPhoneNumber(null);
      setOnboardingStatus(null);
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, phone_number, onboarding_status')
        .eq('user_id', currentUserId)
        .single();

      if (userError) throw userError;

      if (userData) {
        console.log(`[AuthContext] fetchUserProfileAndRelatedData - User data found:`, { fullName: userData.full_name, phoneNumber: userData.phone_number, onboardingStatus: userData.onboarding_status });
        setFullName(userData.full_name || null);
        setPhoneNumber(userData.phone_number || null);
        setOnboardingStatus(userData.onboarding_status || null);
        console.log(`[AuthContext] fetchUserProfileAndRelatedData - onboardingStatus set to: ${userData.onboarding_status}`);
        
        const authUser = session?.user; 
        if (authUser?.email) {
          const emailParts = authUser.email.split('@')[0];
          const initialLetters = emailParts.substring(0, 2).toUpperCase();
          setAvatarText(initialLetters);
        } else {
          setAvatarText(null);
        }
      } else {
        console.log(`[AuthContext] fetchUserProfileAndRelatedData - No user data found for user ID: ${currentUserId}. Clearing profile.`);
        setFullName(null);
        setAvatarText(null);
        setPhoneNumber(null);
        setOnboardingStatus(null);
        console.log(`[AuthContext] fetchUserProfileAndRelatedData - onboardingStatus set to: null (no data)`);
      }
    } catch (error) {
      console.error('[AuthContext] Error in fetchUserProfileAndRelatedData:', error);
      setFullName(null);
      setAvatarText(null);
      setPhoneNumber(null);
      setOnboardingStatus(null);
      console.log(`[AuthContext] fetchUserProfileAndRelatedData - onboardingStatus set to: null (due to error)`);
    }
    console.log(`[AuthContext] fetchUserProfileAndRelatedData finished for user ID: ${currentUserId}`);
  }, [session]); // Add session to useCallback dependencies if it's used inside

  useEffect(() => {
    console.log('[AuthContext] Initializing AuthProvider, setting status to LOADING.');
    setAuthStatus('LOADING');

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log(`[AuthContext] onAuthStateChange event: ${event}, session available: ${!!currentSession}.`);
        
        if (currentSession) {
          // A session exists. Set the user and then fetch their profile data.
          setSession(currentSession);
          const currentUser = currentSession.user;
          setUser(currentUser);
          
          if (currentUser) {
            console.log(`[AuthContext] Fetching profile for user: ${currentUser.id}`);
            await fetchUserProfileAndRelatedData(currentUser.id);
            // IMPORTANT: Only after the profile is fetched, we are fully authenticated.
            console.log(`[AuthContext] Profile fetch complete. Setting status to AUTHENTICATED.`);
            setAuthStatus('AUTHENTICATED');
          } else {
            // This is an edge case, but if there's a session without a user, treat as unauthenticated.
            setAuthStatus('UNAUTHENTICATED');
          }

        } else {
          // No session exists. Clear all user data and mark as unauthenticated.
          setSession(null);
          setUser(null);
          setFullName(null);
          setAvatarText(null);
          setPhoneNumber(null);
          setOnboardingStatus(null);
          console.log(`[AuthContext] No session. Setting status to UNAUTHENTICATED.`);
          setAuthStatus('UNAUTHENTICATED');
        }
      }
    );

    return () => {
      console.log('[AuthContext] Unsubscribing from onAuthStateChange.');
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfileAndRelatedData]);
  const signOut = async () => {
    console.log('[AuthContext] signOut called. Setting status to LOADING.');
    setAuthStatus('LOADING'); // Show a loading state while signing out
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[AuthContext] Error signing out:', error);
      // onAuthStateChange will fire with a null session and handle setting the final status.
    } else {
      console.log('[AuthContext] signOut successful. Waiting for onAuthStateChange(SIGNED_OUT).');
    }
  };

  const processLogin = async (newSession: Session) => {
    console.log('[AuthContext] processLogin called. This function currently relies on onAuthStateChange.');
    // Relies on onAuthStateChange
  };

  const refreshUserProfile = async () => {
    if (user?.id) {
      console.log(`[AuthContext] refreshUserProfile called for user: ${user.id}.`);
      // We don't set to LOADING here to avoid a full-screen loader on a manual refresh.
      // The UI can show a local spinner if needed.
      await fetchUserProfileAndRelatedData(user.id);
      console.log(`[AuthContext] refreshUserProfile finished for user: ${user.id}.`);
    } else {
      console.log('[AuthContext] refreshUserProfile called but no user ID available.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        authStatus,
        signOut,
        fullName,
        avatarText,
        phoneNumber,
        onboardingStatus,
        processLogin,
        refreshUserProfile,
        currentChatMode,
        setCurrentChatMode,
        isLoading, // Added isLoading to the context value
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
