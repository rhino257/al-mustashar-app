import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js'; // SupportedStorage and createClient might not be needed if using global
// import { Platform } from 'react-native'; // Not needed if using global client
import { supabase } from '@/utils/supabase'; // Import the globally configured supabase client

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
  // Use the globally configured supabase client from '@/utils/supabase'
  // const supabase = useMemo(() => { ... }, []); // This local client initialization is removed

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarText, setAvatarText] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);

  const fetchUserProfileAndRelatedData = async (currentUserId: string | undefined) => {
    if (!currentUserId) {
      setFullName(null);
      setAvatarText(null);
      setPhoneNumber(null);
      setOnboardingStatus(null);
      return; // No user, clear profile data
    }

    // console.log('[AuthContext] fetchUserProfileAndRelatedData for:', currentUserId);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, phone_number, onboarding_status')
        .eq('user_id', currentUserId)
        .single();

      if (userError) throw userError;

      if (userData) {
        setFullName(userData.full_name || null);
        setPhoneNumber(userData.phone_number || null);
        setOnboardingStatus(userData.onboarding_status || null);
        // console.log('[AuthContext] User profile fetched:', userData);

        // Fetch avatar text based on email (assuming user object is available on session)
        // This might be slightly delayed if session.user isn't immediately populated with email.
        // Supabase's user object on the session should have the email.
        const authUser = session?.user; // Use the current session's user object
        if (authUser?.email) {
          const emailParts = authUser.email.split('@')[0];
          const initialLetters = emailParts.substring(0, 2).toUpperCase();
          setAvatarText(initialLetters);
        } else {
          setAvatarText(null);
        }
      } else {
        // No user data found, clear profile
        setFullName(null);
        setAvatarText(null);
        setPhoneNumber(null);
        setOnboardingStatus(null);
      }
    } catch (error) {
      console.error('Error in fetchUserProfileAndRelatedData:', error);
      setFullName(null);
      setAvatarText(null);
      setPhoneNumber(null);
      setOnboardingStatus(null);
    }
  };

  useEffect(() => {
    setIsLoading(true); // Set loading true on initial mount
    // console.log('[AuthContext] Initializing, setIsLoading to true.');

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        // console.log(`[AuthContext] Supabase auth event: ${_event}`);
        // console.log(`[AuthContext] Current session from event:`, currentSession ? 'Exists' : 'Null');

        setSession(currentSession);
        const currentUser = currentSession?.user || null;
        setUser(currentUser);

        // Regardless of event type, if we have a currentUser, try to fetch their profile.
        // If no currentUser, profile data will be cleared by fetchUserProfileAndRelatedData.
        await fetchUserProfileAndRelatedData(currentUser?.id);

        setIsLoading(false); // Set loading to false AFTER session/user update and profile fetch attempt
        // console.log('[AuthContext] onAuthStateChange processed, setIsLoading to false.');
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const signOut = async () => {
    // console.log('[AuthContext] signOut called, setIsLoading to true.');
    setIsLoading(true); // Set loading true before sign out
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      setIsLoading(false); // If signout fails, stop loading
      // console.log('[AuthContext] SignOut error, setIsLoading to false.');
    }
    // onAuthStateChange will handle setting session/user to null and then isLoading to false.
  };

  const processLogin = async (newSession: Session) => {
    // This function is called from login.tsx after a successful manual signIn.
    // onAuthStateChange will ALSO fire with a SIGNED_IN event and the newSession.
    // To avoid duplicate profile fetches and state settings, this function
    // should ideally do nothing or very little, relying on onAuthStateChange.
    // console.log('[AuthContext] processLogin called. Relying on onAuthStateChange for state updates.');
    // If absolutely necessary, you could set isLoading true here, but onAuthStateChange
    // should also set it true then false.
    // For now, let it be minimal. The key is that onAuthStateChange is the ultimate handler.
  };

  const refreshUserProfile = async () => {
    if (user?.id) {
      // console.log('[AuthContext] refreshUserProfile called, setIsLoading to true.');
      setIsLoading(true);
      await fetchUserProfileAndRelatedData(user.id);
      setIsLoading(false);
      // console.log('[AuthContext] refreshUserProfile done, setIsLoading to false.');
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
