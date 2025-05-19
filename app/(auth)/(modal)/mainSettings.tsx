import React, { useState, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors'; // ENSURE Colors.grey and Colors.danger are well-defined
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

const MainSettingsScreen = () => {
  const router = useRouter();
  const { user, phoneNumber, signOut } = useAuth();
  const { top: safeAreaTop } = useSafeAreaInsets(); // Used for y-coordinate adjustment

  const [showFeatureUnavailableMessage, setShowFeatureUnavailableMessage] = useState(false);
  const featureUnavailableTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  // activePopupCoords now only needs y and height, mirroring the drawer
  const [activePopupCoords, setActivePopupCoords] = useState<{ y: number; height: number } | null>(null);
  const itemRefs = React.useRef<{ [key: string]: React.ElementRef<typeof TouchableOpacity> | View | null }>({});

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.chatgptBackground }}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  const settingsOptions = [
    { id: 'email', title: 'البريد الإلكتروني', icon: 'mail-outline', subtextKey: 'email', isNavigable: false },
    { id: 'phone', title: 'رقم الهاتف', icon: 'call-outline', subtextKey: 'phone_number', isNavigable: false },
    { id: 'apiKey', title: 'API Key & Organization', icon: 'key-outline', screen: '/(auth)/(modal)/settings', isNavigable: true },
    { id: 'subscription', title: 'إدارة الاشتراك', icon: 'card-outline', screen: '/(auth)/(modal)/subscription', isNavigable: true },
    { id: 'upgrade', title: 'الترقية إلى Pro', icon: 'rocket-outline', screen: '/(auth)/(modal)/upgrade', isNavigable: true },
    { id: 'personalization', title: 'التخصيص', icon: 'options-outline', screen: '/(auth)/(modal)/personalization', isNavigable: true },
    { id: 'dataControls', title: 'عناصر التحكم في البيانات', icon: 'lock-closed-outline', screen: '/(auth)/(modal)/dataControls', isNavigable: true },
    { id: 'notifications', title: 'الإشعارات', icon: 'notifications-outline', screen: '/(auth)/(modal)/notifications', isNavigable: true },
    { id: 'voice', title: 'الصوت', icon: 'mic-outline', screen: '/(auth)/(modal)/voiceSettings', isNavigable: true },
    { id: 'about', title: 'حول', icon: 'information-circle-outline', screen: '/(auth)/(modal)/about', isNavigable: true },
  ];

  const handleNavigate = (screenPath: string) => {
    if (screenPath) router.push(screenPath as any);
    else console.log('Screen path not defined');
  };

  const getSubtext = (option: typeof settingsOptions[0]) => {
    if (option.subtextKey === 'email' && user?.email) return user.email;
    if (option.subtextKey === 'phone_number' && phoneNumber) return phoneNumber;
    return null;
  };

  const handleSignOut = async () => {
    try { await signOut(); } 
    catch (error) { console.error("Error signing out: ", error); Alert.alert("Sign Out Error", "Failed to sign out."); }
  };

  // handleFeatureUnavailable now matches the drawer's signature
  const handleFeatureUnavailable = (coords: { y: number; height: number } | null) => {
    if (!coords) { setShowFeatureUnavailableMessage(false); return; }
    setActivePopupCoords(coords);
    if (featureUnavailableTimerRef.current) clearTimeout(featureUnavailableTimerRef.current);
    setShowFeatureUnavailableMessage(true);
    featureUnavailableTimerRef.current = setTimeout(() => {
      setShowFeatureUnavailableMessage(false);
      setActivePopupCoords(null);
    }, 4000);
  };

  return (
    <ScrollView style={styles.container}>
      {settingsOptions.map((option) => {
        const subtextValue = getSubtext(option);
        const underDevelopmentIds = ['apiKey', 'subscription', 'upgrade', 'personalization', 'dataControls', 'notifications', 'voice'];
        const isUnderDevelopment = underDevelopmentIds.includes(option.id);
        const isOriginallyNavigable = option.isNavigable !== false && option.screen;
        const isActuallyNavigable = isOriginallyNavigable && !isUnderDevelopment;

        const RowContent = (
          // flexDirection is 'row' to have TextBlock on the left and MainIcon on the right (visually L-R)
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {/* This View (TextBlock) needs flex: 1 to push the MainIcon to the right edge of RowContent */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionText, isUnderDevelopment && styles.disabledOptionText]}>{option.title}</Text>
              {(typeof subtextValue === 'string' && subtextValue.length > 0) && (
                <Text style={[styles.optionSubtext, isUnderDevelopment && styles.disabledOptionText]}>{subtextValue}</Text>
              )}
            </View>
            {/* MainIcon is the second child, will appear on the right of TextBlock */}
            <Ionicons name={option.icon as any} size={24} color={isUnderDevelopment ? Colors.grey : Colors.white} style={styles.optionIcon} />
          </View>
        );

        const onPressAction = () => {
          if (isUnderDevelopment) {
            const currentItemRef = itemRefs.current[option.id];
            if (currentItemRef && typeof currentItemRef.measureInWindow === 'function') {
              currentItemRef.measureInWindow((x: number, yWindow: number, widthItem: number, heightItem: number) => {
                // Adjust y by safeAreaTop, same as drawer logic for y - top
                handleFeatureUnavailable({ y: yWindow - safeAreaTop, height: heightItem });
              });
            } else { handleFeatureUnavailable(null); }
          } else if (isActuallyNavigable) {
            handleNavigate(option.screen!);
          }
        };

        const isPressable = isActuallyNavigable || isUnderDevelopment;

        if (isPressable) {
          return (
            <TouchableOpacity
              key={option.id}
              ref={(el) => (itemRefs.current[option.id] = el)}
              style={[styles.optionRow, isUnderDevelopment && styles.disabledOptionRow]}
              onPress={onPressAction}
              activeOpacity={isUnderDevelopment ? 1 : 0.7}
            >
              {RowContent}
              {isActuallyNavigable && <Ionicons name="chevron-back-outline" size={22} color={Colors.white} />}
            </TouchableOpacity>
          );
        } else {
          return (
            <View key={option.id} ref={(el) => (itemRefs.current[option.id] = el)} style={styles.optionRow}>
              {RowContent}
            </View>
          );
        }
      })}

      <TouchableOpacity style={[styles.optionRow, styles.logoutButton]} onPress={handleSignOut} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionText, styles.logoutButtonText]}>تسجيل الخروج</Text>
        </View>
        <Ionicons name="log-out-outline" size={24} color={Colors.danger} style={styles.optionIcon} />
      </TouchableOpacity>

      {/* Popup Rendering - Applying Drawer's styling and positioning principles */}
      {showFeatureUnavailableMessage && activePopupCoords && (
        <View style={[
          styles.featureUnavailablePopupBase, // Use a base style from StyleSheet
          { // Dynamic positioning part
            top: activePopupCoords.y + (activePopupCoords.height / 2) - (styles.featureUnavailablePopupBase.paddingVertical! + styles.featureUnavailablePopupText.fontSize! / 2 + 2), // More precise vertical centering
            left: 30, // Fixed left position, same as drawer
          }
        ]}>
          <Text style={styles.featureUnavailablePopupText}>
            هذه الميزة قيد التطوير
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.chatgptBackground,
    paddingHorizontal: 10,
  },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 15,
  },
  optionText: { fontSize: 17, color: Colors.white, textAlign: 'right' },
  optionSubtext: { fontSize: 14, color: Colors.white, textAlign: 'right', marginTop: 3 },
  optionIcon: { marginLeft: 15 }, // Changed from marginRight to marginLeft for RTL
  logoutButton: {},
  logoutButtonText: { color: Colors.danger }, // Ensure Colors.danger is defined
  disabledOptionRow: { opacity: 0.6 }, // Ensure Colors.grey is light enough (e.g. #9E9E9E)
  disabledOptionText: { color: Colors.grey },
  // Base style for the popup, mirroring drawer's inline styles
  featureUnavailablePopupBase: {
    position: 'absolute',
    alignSelf: 'flex-start', // To make `left` positioning effective
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    paddingVertical: 8,    // Define explicitly for calculation
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 5,
    maxWidth: Dimensions.get('window').width * 0.6, // 60% of screen width, adjust if needed
  },
  featureUnavailablePopupText: {
    color: '#ffffff',
    fontSize: 13,         // Define explicitly for calculation
    textAlign: 'right',
  },
});

export default MainSettingsScreen;
