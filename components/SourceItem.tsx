import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
      <Text style={styles.snippet} numberOfLines={3} ellipsizeMode="tail">
        {source.content}
      </Text>
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
    minHeight: 100, // Ensure a minimum height for the card
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15, // Slightly smaller to accommodate potentially longer titles with article number
    fontWeight: 'bold',
    color: Colors.white, // Assuming dark background for card
    marginBottom: 8,
    textAlign: 'right', // Align text to the right for Arabic
  },
  snippet: {
    fontSize: 14,
    color: Colors.lightGray, // Lighter text for snippet
    textAlign: 'right', // Align text to the right for Arabic
    lineHeight: 20,
  },
});

export default SourceItem;
