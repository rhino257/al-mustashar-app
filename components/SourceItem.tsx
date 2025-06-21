import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native'; // Added ScrollView
import Colors from '@/constants/Colors'; // Assuming you have a Colors file

// Updated interface to match the actual data structure from logs
interface SourceFromAPI {
  id: string;
  content: string; // This is the main descriptive text
  metadata: {
    title?: string; // For comments/articles that have a specific title
    law_name?: string; // For laws
    article_number?: string | number;
    // Potentially other fields like 'source', 'item_type' exist but might not be displayed directly
  };
}

interface SourceItemProps {
  source: SourceFromAPI;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8; // Make card take up 80% of screen width
const CARD_MARGIN = 10;

const SourceItem: React.FC<SourceItemProps> = ({ source }) => {
  // Determine the display title based on available metadata
  let displayTitle = source.metadata.title || source.metadata.law_name || 'المصدر'; // Fallback title
  if (source.metadata.article_number) {
    displayTitle = `${displayTitle} - مادة ${source.metadata.article_number}`;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
        {displayTitle}
      </Text>
      <ScrollView 
        style={styles.contentScrollView} 
        showsVerticalScrollIndicator={true} // Temporarily enable scrollbar
        nestedScrollEnabled={true} // Might help if there are nested scroll conflicts, though unlikely here
      >
        <Text style={styles.contentText}>
          {source.content}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.messageInputBackground, // Or another suitable card background
    borderRadius: 8,
    padding: 15,
    marginHorizontal: CARD_MARGIN / 2, // Half margin on each side for spacing
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    // minHeight: 100, // Remove minHeight, let content define it or set a fixed height for the card
    height: CARD_WIDTH * 1.2, // Example: Make card height proportional to width, or a fixed value like 250
    flexDirection: 'column', // Ensure children are laid out vertically
    // justifyContent: 'space-between', // Remove or adjust as contentScrollView will take space
  },
  title: {
    fontSize: 15, 
    fontWeight: 'bold',
    color: Colors.white, 
    marginBottom: 8,
    textAlign: 'right', 
    paddingHorizontal: 5, // Add some padding if card padding is removed for ScrollView
  },
  contentScrollView: {
    flex: 1, // Allow ScrollView to take available space after title
    marginVertical: 5,
    // backgroundColor: 'rgba(0, 255, 0, 0.1)', // Removed temporary background
  },
  contentText: { // Renamed from snippet
    fontSize: 14,
    color: Colors.lightGray, 
    textAlign: 'right', 
    lineHeight: 20,
    paddingHorizontal: 5, // Add some padding if card padding is removed for ScrollView
  },
});

export default SourceItem;
