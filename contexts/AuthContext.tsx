import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  fullName: string | null;
  avatarText: string | null;
  phoneNumber: string | null; // << ADD THIS LINE
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarText, setAvatarText] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null); // << ADD THIS LINE

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Supabase auth event: ${event}`);
        setSession(session);
        setUser(session?.user || null);
        setIsLoading(false);
        console.log('[AuthContext] setIsLoading to false (onAuthStateChange)');


        if (session?.user) {
          const userId = session.user.id;
          // Fetch full name and phone number from Supabase
          const { data: userData, error: userError } = await supabase
            .from('users') // Or the name of your user table
            .select('full_name, phone_number') // << MODIFIED: Added phone_number
            .eq('user_id', userId) // Corrected column name
            .single(); // Assuming a single user matches the ID

          if (userError) {
              console.error('Error fetching user details:', userError);
              setFullName(null);
              console.log('[AuthContext] Set fullName to: null (error)');
              setAvatarText(null);
              console.log('[AuthContext] Set avatarText to: null (error)');
              setPhoneNumber(null); // Clear phone number if no user
          } else if (userData) {
              // Set full name
              setFullName(userData.full_name || null);
              console.log('[AuthContext] Set fullName to:', userData.full_name || null);
              setPhoneNumber(userData.phone_number || null); // << ADD THIS LINE: Set phone number

              // Generate initial avatar text
              if (session.user.email) {
                const emailParts = session.user.email.split('@')[0];
                const initialLetters = emailParts.substring(0, 2).toUpperCase();
                setAvatarText(initialLetters);
                console.log('[AuthContext] Set avatarText to:', initialLetters);
              } else {
                  setAvatarText(null);
                  console.log('[AuthContext] Set avatarText to: null (no email)');
              }
          }
        } else {
          // Clear user data on sign out
          setFullName(null);
          console.log('[AuthContext] Set fullName to: null (signed out)');
          setAvatarText(null);
          console.log('[AuthContext] Set avatarText to: null (signed out)');
          setPhoneNumber(null); // Clear phone number if no user
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);
      console.log('[AuthContext] setIsLoading to false (getSession)');


      if (session?.user) {
        const userId = session.user.id;
        // Fetch full name and phone number from Supabase
        const { data: userData, error: userError } = await supabase
          .from('users') // Or the name of your user table
          .select('full_name, phone_number') // << MODIFIED: Added phone_number
          .eq('user_id', userId) // Corrected column name
          .single(); // Assuming a single user matches the ID

        if (userError) {
            console.error('Error fetching user details:', userError);
            setFullName(null);
            console.log('[AuthContext] Set fullName to: null (error)');
            setAvatarText(null);
            console.log('[AuthContext] Set avatarText to: null (error)');
            setPhoneNumber(null); // Clear phone number if no user
        } else if (userData) {
            // Set full name
            setFullName(userData.full_name || null);
            console.log('[AuthContext] Set fullName to:', userData.full_name || null);
            setPhoneNumber(userData.phone_number || null); // << ADD THIS LINE: Set phone number

            // Generate initial avatar text
            if (session.user.email) {
              const emailParts = session.user.email.split('@')[0];
              const initialLetters = emailParts.substring(0, 2).toUpperCase();
              setAvatarText(initialLetters);
              console.log('[AuthContext] Set avatarText to:', initialLetters);
            } else {
                setAvatarText(null);
                console.log('[AuthContext] Set avatarText to: null (no email)');
            }
        }
      } else {
        // Clear user data if no session
        setFullName(null);
        console.log('[AuthContext] Set fullName to: null (no session)');
        setAvatarText(null);
        console.log('[AuthContext] Set avatarText to: null (no session)');
        setPhoneNumber(null); // Clear phone number if no user
      }
    });


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

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signOut,
        fullName,
        avatarText,
        phoneNumber, // << ADD THIS LINE
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
