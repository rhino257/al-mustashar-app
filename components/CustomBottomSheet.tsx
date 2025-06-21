import React, { useEffect, useRef, useState } from 'react'; // Added useState
import { View, Text, Modal, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import SourceItem from './SourceItem'; // Assuming SourceItem is in the same directory

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

interface SourceFromAPI {
  id: string;
  content: string;
  metadata: {
    title?: string;
    law_name?: string;
    article_number?: string | number;
  };
}

interface CustomBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  sources: SourceFromAPI[];
}

const CustomBottomSheet: React.FC<CustomBottomSheetProps> = ({ isVisible, onClose, sources }) => {
  const sheetHeight = screenHeight * 0.6; // 60% of screen height
  const panY = useRef(new Animated.Value(sheetHeight)).current; // Start off-screen
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SourceFromAPI>>(null);

  // For onViewableItemsChanged
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Item is considered visible if 50% of it is visible
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: SourceFromAPI; index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;


  useEffect(() => {
    if (isVisible) {
      Animated.timing(panY, {
        toValue: 0, // Slide to fully visible (top of the sheet at 0 offset from bottom part of screen)
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(panY, {
        toValue: sheetHeight, // Slide back down off-screen
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, panY, sheetHeight]);

  const sheetAnimatedStyle = {
    transform: [{ translateY: panY }],
  };

  const CARD_WIDTH = screenWidth * 0.8;
  const CARD_MARGIN = 10;

  const renderSourceItem = ({ item }: { item: SourceFromAPI }) => (
    <View style={{ width: CARD_WIDTH, marginHorizontal: CARD_MARGIN / 2 }}>
      <SourceItem source={item} />
    </View>
  );

  // Refined PanResponder to allow horizontal scroll within FlatList
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only become the responder if the gesture is primarily vertical
        // and exceeds a small threshold. This allows FlatList to handle horizontal swipes.
        const { dx, dy } = gestureState;
        // Check if vertical movement is greater than horizontal and exceeds a threshold
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
          return true;
        }
        return false;
      },
      onPanResponderGrant: () => {
        // When the gesture is granted, store the current animated value as an offset
        // and reset the animated value to 0. This allows gestureState.dy to represent
        // the change from the point where the touch started.
        panY.extractOffset(); 
      },
      onPanResponderMove: Animated.event(
        [null, { dy: panY }], // Directly map gestureState.dy to panY
        { 
          useNativeDriver: false // Must be false for Animated.event with setValue
          // Listener removed as it was empty and causing type errors
        } 
      ),
      onPanResponderRelease: (evt, gestureState) => {
        panY.flattenOffset(); // Apply the offset to the animated value
        
        // Use a temporary variable to get the current value of panY
        // This is a common workaround as panY._value is not directly/safely accessible in all contexts
        let currentYValue = 0;
        const listenerId = panY.addListener(value => { currentYValue = value.value; });
        panY.removeListener(listenerId); // Immediately remove listener after getting value

        if (gestureState.dy > 0 && (currentYValue > sheetHeight * 0.3 || gestureState.vy > 0.5)) {
          // If dragged down significantly or swiped with velocity, close it
          onClose(); // This will trigger the slide-out animation via useEffect
        } else {
          // Otherwise, snap back to the open position
          Animated.spring(panY, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // The Modal's own 'visible' prop handles whether it's part of the render tree.
  // The animation useEffect handles sliding it in/out when 'isVisible' changes.
  // No need for an additional conditional render here based on panY._value.

  return (
    <Modal
      transparent
      visible={isVisible} // Control modal visibility directly with isVisible prop
      animationType="none" // We handle animation with Animated.View
      onRequestClose={onClose} // For Android back button
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, sheetAnimatedStyle, { height: sheetHeight }]} {...panResponder.panHandlers}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>المصادر</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color={Colors.lightGray} />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          {sources && sources.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={sources}
              renderItem={renderSourceItem}
              keyExtractor={(item) => item.id.toString()}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                // Adjust padding to ensure items are centered correctly with snapping
                paddingHorizontal: (screenWidth - CARD_WIDTH) / 2, 
                paddingVertical: 20,
              }}
              snapToInterval={CARD_WIDTH + CARD_MARGIN} // Snap to full width of card + its margin
              decelerationRate="fast" // Reverted to "fast" for more decisive snapping
              disableIntervalMomentum={true} // Prevents scrolling through multiple items
              bounces={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
            />
          ) : (
            <View style={styles.noSourcesContainer}>
              <Text style={styles.noSourcesText}>لا توجد مصادر لعرضها.</Text>
            </View>
          )}
          {/* Pagination Dots */}
          {sources && sources.length > 0 && (
            <View style={styles.paginationContainer}>
              {sources.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    activeIndex === index ? styles.paginationDotActive : {},
                  ]}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', // Aligns sheet to the bottom
  },
  sheet: {
    backgroundColor: Colors.messageInputBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 0, 
    width: '100%',
    paddingBottom: 30, // Add padding at the bottom for pagination dots
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute', // Position dots at the bottom of the sheet
    bottom: 10, // Adjust as needed
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.greyLight, // Inactive dot color
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.primary, // Active dot color
  },
});

export default CustomBottomSheet;
