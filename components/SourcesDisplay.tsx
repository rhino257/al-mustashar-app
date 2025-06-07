import React, { forwardRef, useMemo, useCallback, useEffect, ForwardedRef } from 'react'; // Added ForwardedRef
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetModalProvider } from '@gorhom/bottom-sheet'; // BottomSheetModal is the component and also the type for its methods/instance
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import SourceItem from './SourceItem'; // Your existing SourceItem component

interface SourceFromAPI {
  id: string;
  content: string;
  metadata: {
    title?: string;
    law_name?: string;
    article_number?: string | number;
  };
}

interface SourcesDisplayProps {
  isVisible: boolean;
  sources: SourceFromAPI[];
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.8;
const CARD_MARGIN = 10;

const SourcesDisplay = forwardRef<BottomSheetModal, SourcesDisplayProps>( // The first generic to forwardRef is the type of the instance that the ref will point to.
  ({ isVisible, sources, onClose }, ref: ForwardedRef<BottomSheetModal>) => { // Explicitly type the ref parameter
    const snapPoints = useMemo(() => ['45%', '60%'], []);

    useEffect(() => {
      // Type guard to ensure ref is a MutableRefObject before accessing .current
      const currentRef = ref && 'current' in ref ? ref.current : null;

      if (isVisible) {
        console.log(`[SourcesDisplay] useEffect: isVisible is true. currentRef is ${currentRef ? 'defined' : 'null'}. Sources count: ${sources?.length || 0}`);
        if (currentRef) {
          currentRef.present();
        } else {
          console.warn('[SourcesDisplay] useEffect: currentRef is null, cannot present.');
        }
      } else {
        console.log(`[SourcesDisplay] useEffect: isVisible is false. currentRef is ${currentRef ? 'defined' : 'null'}.`);
        if (currentRef) {
          currentRef.dismiss();
        } else {
          console.warn('[SourcesDisplay] useEffect: currentRef is null, cannot dismiss.');
        }
      }
    }, [isVisible, ref, sources]);

    const handleSheetChanges = useCallback((index: number) => {
      if (index === -1) {
        onClose();
      }
    }, [onClose]);

    const renderItem = useCallback(({ item }: { item: SourceFromAPI }) => (
      <SourceItem source={item} />
    ), []);

    // Removed duplicated renderItem

    if (!isVisible && !ref) { // Corrected: isVisible and ref are props of the main component
        return null;
    }
    
    // Log sources before rendering BottomSheetModal
    // if (isVisible) { // Temporarily disable this verbose log
    //   console.log('[SourcesDisplay] Preparing to render BottomSheetModal. Sources prop:', JSON.stringify(sources, null, 2));
    // }

    return (
      <BottomSheetModal
        ref={ref}
        index={-1} // Start closed
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: Colors.messageInputBackground }}
        handleIndicatorStyle={{ backgroundColor: Colors.lightGray }}
      >
        {/* --- TEMPORARY DEBUGGING VIEW --- */}
        <View style={{ flex: 1, backgroundColor: 'magenta', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold'}}>MODAL IS HERE</Text>
          <Text style={{color: 'white', fontSize: 18, marginTop: 10}}>Sources Count: {sources?.length || 0}</Text>
          <Text style={{color: 'white', fontSize: 18, marginTop: 5}}>isVisible Prop: {isVisible.toString()}</Text>
        </View>
        {/* --- END TEMPORARY DEBUGGING VIEW --- */}

        {/* Original Content - Commented out for debugging
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>المصادر</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color={Colors.lightGray} />
            </TouchableOpacity>
          </View>

          {sources && sources.length > 0 ? (
            <BottomSheetFlatList
              data={sources}
              renderItem={renderItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listContentContainer}
              snapToAlignment="start"
              snapToInterval={CARD_WIDTH + CARD_MARGIN}
            />
          ) : (
            <View style={styles.noSourcesContainer}>
              <Text style={styles.noSourcesText}>لا توجد مصادر لعرضها.</Text>
            </View>
          )}
        </View>
        */}
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    // backgroundColor: 'orange', // Revert temp bg
  },
  debugContentView: { // Style for the temporary debug view
    flex: 1, // Make it take available space within contentContainer
    backgroundColor: 'lime', // Bright color for visibility
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  debugContentText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  debugContentSubText: {
    fontSize: 16,
    color: 'black',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'right',
  },
  closeButton: {
    padding: 5,
  },
  listContentContainer: {
    paddingHorizontal: (screenWidth - CARD_WIDTH) / 2, 
    paddingVertical: 20,
    // backgroundColor: 'rgba(0,255,0,0.2)', // Revert temp bg
  },
  noSourcesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noSourcesText: {
    fontSize: 16,
    color: Colors.lightGray,
    textAlign: 'center',
  },
});

export default SourcesDisplay;
