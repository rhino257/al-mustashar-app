import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js'; // Added AuthChangeEvent
import { supabase } from '@/utils/supabase'; // Corrected import path

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
  currentChatMode: string;
  setCurrentChatMode: (mode: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarText, setAvatarText] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [currentChatMode, setCurrentChatModeState] = useState<string>('advisor'); // Default to 'advisor'

  const setCurrentChatMode = (mode: string) => {
    console.log(`[AuthContext] Chat mode changed to: ${mode}`); // Added log
    setCurrentChatModeState(mode);
  };

  const fetchUserProfileAndRelatedData = async (currentUserId: string | undefined) => {
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
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing AuthProvider, setting isLoading to true.');
    setIsLoading(true); 

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => { // Explicitly type event and currentSession
        console.log(`[AuthContext] onAuthStateChange event: ${event}, session available: ${!!currentSession}. Current isLoading before processing: ${isLoading}`);
        setSession(currentSession);
        const currentUser = currentSession?.user || null;
        setUser(currentUser);

        if (currentUser) {
          console.log(`[AuthContext] Fetching profile for user: ${currentUser.id}`);
          await fetchUserProfileAndRelatedData(currentUser.id);
          console.log(`[AuthContext] Profile fetch complete for user: ${currentUser.id}`);
        } else {
          // Clear profile data if no user
          setFullName(null);
          setAvatarText(null);
          setPhoneNumber(null);
          setOnboardingStatus(null);
          console.log(`[AuthContext] Cleared profile data as no user in session. onboardingStatus is now null.`);
        }
        
        // After the first auth event, the initial loading is complete.
        setIsLoading(false);
        console.log(`[AuthContext] End of onAuthStateChange for event ${event}. isLoading is now false.`);
      }
    );

    return () => {
      console.log('[AuthContext] Unsubscribing from onAuthStateChange.');
      authListener.subscription.unsubscribe();
    };
  }, []); 

  const signOut = async () => {
    console.log('[AuthContext] signOut called. Setting isLoading to true.');
    setIsLoading(true); 
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[AuthContext] Error signing out:', error);
      // isLoading will be set to false by onAuthStateChange 'SIGNED_OUT' event
      // If onAuthStateChange doesn't fire or fails, isLoading might remain true.
      // However, standard behavior is for SIGNED_OUT to fire.
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
      console.log(`[AuthContext] refreshUserProfile called for user: ${user.id}. Setting isLoading to true.`);
      setIsLoading(true);
      await fetchUserProfileAndRelatedData(user.id);
      console.log(`[AuthContext] refreshUserProfile finished for user: ${user.id}. Setting isLoading to false.`);
      setIsLoading(false);
    } else {
      console.log('[AuthContext] refreshUserProfile called but no user ID available.');
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
        refreshUserProfile,
        currentChatMode,
        setCurrentChatMode,
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
