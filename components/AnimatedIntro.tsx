import Colors from '@/constants/Colors';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, Platform, TextStyle as RNTextStyle, ViewStyle, ImageStyle } from 'react-native'; // Import ViewStyle, ImageStyle
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
  AnimateStyle,
  // DefaultStyle, // We might not need to import DefaultStyle directly
} from 'react-native-reanimated';
import { ReText } from 'react-native-redash';

const content = [
  { title: "بضعظة زر.", bg: Colors.lime, fontColor: Colors.pink },
  { title: "نتبادل الأفكار.", bg: Colors.brown, fontColor: Colors.sky },
  { title: "نكتشف.", bg: Colors.orange, fontColor: Colors.blue },
  { title: "ننطلق.", bg: Colors.teal, fontColor: Colors.yellow },
  { title: 'المستشار.', bg: Colors.green, fontColor: Colors.pink },
];

// This is the type we expect the textStyle constant to effectively be for ReText
type ExpectedAnimatedTextStyleForReText = AnimateStyle<RNTextStyle>;

const AnimatedIntro = () => {
  const { width, height } = useWindowDimensions();

  // ... (other constants and useEffects) ...
  const responsiveFontSize = height * 0.04;
  const responsiveBallSize = width * 0.09;
  const responsiveMaskHeight = height * 0.055;
  const responsiveSmallOffset = width * 0.01;
  const responsiveContainerMarginTop = height * 0.30;
  const maskWidth = width / 1.5;
  const halfInitialValue = width / 2 - responsiveBallSize / 2;


  const currentX = useSharedValue(halfInitialValue);
  const currentIndex = useSharedValue(0);
  const isAtStart = useSharedValue(true);
  const labelWidth = useSharedValue(-1);
  const canGoToNext = useSharedValue(false);

  const half = useDerivedValue(() => {
    return width / 2 - responsiveBallSize / 2;
  }, [width]);

  const newColorIndex = useDerivedValue(() => {
    if (!isAtStart.value) {
      return (currentIndex.value + 1) % content.length;
    }
    return currentIndex.value;
  }, [currentIndex, isAtStart]);

  // Provide RNTextStyle as the generic to useAnimatedStyle's T parameter.
  // The updater callback should then aim to return an object that could be a RNTextStyle.
  // Reanimated will then wrap its properties to make it an AnimateStyle<RNTextStyle>.
  const textStyle = useAnimatedStyle(() => {
    const initialX = half.value + responsiveSmallOffset;

    // Construct the style object. At this point, before Reanimated processes it,
    // it should look like a plain RNTextStyle.
    const styleObject: RNTextStyle = {
      fontSize: responsiveFontSize,
      fontWeight: '600', // This is a valid RNTextStyle['fontWeight']
      position: 'absolute',
      left: '0%',
      opacity: 0, // Opacity is part of ViewStyle, but TextStyle extends ViewStyle, so it's fine
      transform: [{ translateX: initialX }],
      color: content[currentIndex.value].fontColor, // Default string color
    };

    const isReadyForMainAnimation = labelWidth.value > 0 && half.value !== 0;

    if (isReadyForMainAnimation) {
      styleObject.opacity = 1;
      const inputRange = [half.value, half.value + labelWidth.value / 2];
      const outputRange = [ initialX, half.value - labelWidth.value / 2, ];
      // IMPORTANT: The object returned by the updater is a plain JS object.
      // Reanimated processes this and turns its properties into shared values if they aren't already.
      // The result of interpolateColor IS what Reanimated expects for color.
      (styleObject as any).color = interpolateColor( // Use 'as any' here to assign Reanimated's processed color
        currentX.value, inputRange,
        [content[newColorIndex.value].fontColor, content[currentIndex.value].fontColor],
        'RGB'
      );
      styleObject.transform = [{ translateX: interpolate(currentX.value, inputRange, outputRange) }];
    } else if (labelWidth.value === 0 && half.value !== 0) {
      styleObject.opacity = 1;
    }

    return styleObject; // Return the plain style object
  }, [currentIndex, currentX, labelWidth, half, newColorIndex, responsiveFontSize, responsiveSmallOffset, halfInitialValue]);
  // The `textStyle` constant itself will be correctly typed as AnimateStyle<RNTextStyle> by Reanimated.


  // ... ballStyle, maskAnimatedStyle, wrapperBackgroundStyle with 'as any' for interpolateColor results ...
  // (These should be fine as they target ViewStyle properties mostly)

    const ballStyle = useAnimatedStyle(() => {
    if ((labelWidth.value <= 0 && half.value === 0) || currentX.value === undefined || half.value === undefined || newColorIndex.value === undefined) return {opacity:0};
    const inputRange = [half.value, half.value + (labelWidth.value > 0 ? labelWidth.value / 2 : responsiveBallSize)];
    return {
      backgroundColor: interpolateColor(
        currentX.value, inputRange, [content[newColorIndex.value].fontColor, content[currentIndex.value].fontColor],'RGB') as any,
      transform: [{ translateX: currentX.value }],
      width: responsiveBallSize, height: responsiveBallSize, borderRadius: responsiveBallSize / 2,
      zIndex: 10, position: 'absolute', left: '0%', opacity: labelWidth.value === -1 ? 0 : 1,
    };
  }, [currentIndex, currentX, labelWidth, half, newColorIndex, responsiveBallSize]);

  const maskAnimatedStyle = useAnimatedStyle(() => {
    if ((labelWidth.value <= 0 && half.value === 0) || currentX.value === undefined || half.value === undefined || newColorIndex.value === undefined) return {opacity:0};
    const inputRange = [half.value, half.value + (labelWidth.value > 0 ? labelWidth.value / 2 : responsiveBallSize)];
    return {
      backgroundColor: interpolateColor(
        currentX.value, inputRange, [content[newColorIndex.value].bg, content[currentIndex.value].bg], 'RGB') as any,
      transform: [{ translateX: currentX.value }],
      width: maskWidth, height: responsiveMaskHeight,
      borderTopLeftRadius: responsiveMaskHeight / 2.2, borderBottomLeftRadius: responsiveMaskHeight / 2.2,
      zIndex: 1, position: 'absolute', left: '0%', opacity: labelWidth.value === -1 ? 0 : 1,
    };
  }, [currentIndex, currentX, labelWidth, half, newColorIndex, maskWidth, responsiveMaskHeight, responsiveBallSize]);

  const wrapperBackgroundStyle = useAnimatedStyle(() => {
    if ((labelWidth.value <= 0 || half.value === 0  && currentX.value === halfInitialValue) || currentX.value === undefined || half.value === undefined || newColorIndex.value === undefined) {
        return { backgroundColor: content[currentIndex.value].bg };
    }
    const inputRange = [half.value, half.value + (labelWidth.value > 0 ? labelWidth.value / 2 : responsiveBallSize)];
    return {
      backgroundColor: interpolateColor(
        currentX.value, inputRange, [content[newColorIndex.value].bg, content[currentIndex.value].bg], 'RGB') as any,
    };
  }, [currentX, half, labelWidth, newColorIndex, currentIndex, halfInitialValue, responsiveBallSize]);


  const currentText = useDerivedValue(() => {
    return content[currentIndex.value].title;
  }, [currentIndex]);

  // ... reactions ... (no changes to reactions)
    useAnimatedReaction( () => labelWidth.value, (newCalculatedTextWidth) => {
      if (newCalculatedTextWidth > 0 && isAtStart.value) {
        currentX.value = half.value;
        currentX.value = withDelay( 1000, withTiming( half.value + newCalculatedTextWidth / 2, { duration: 800 }, (finished) => {
              if (finished) { canGoToNext.value = true; isAtStart.value = false; }
            }
          )
        );
      }
    },
    []
  );
  useAnimatedReaction( () => canGoToNext.value, (shouldGoToNext) => {
      if (shouldGoToNext) {
        canGoToNext.value = false;
        currentX.value = withDelay( 1000, withTiming( half.value, { duration: 800 }, (finished) => {
              if (finished) {
                currentIndex.value = (currentIndex.value + 1) % content.length;
                isAtStart.value = true;
                labelWidth.value = -1;
              }
            }
          )
        );
      }
    },
    []
  );
  useAnimatedReaction( () => half.value, (newHalfValue) => {
        if (isAtStart.value && newHalfValue !== undefined && !isNaN(newHalfValue) && currentX.value !== newHalfValue) {
            currentX.value = newHalfValue;
            labelWidth.value = -1;
        }
    },
    []
  );

  return (
    <Animated.View style={[styles.wrapper, wrapperBackgroundStyle]}>
      <Animated.View style={[styles.content, { marginTop: responsiveContainerMarginTop }]}>
        <Animated.View style={ballStyle} />
        <Animated.View style={maskAnimatedStyle} />
        <ReText
          onLayout={(e) => { /* ... onLayout logic ... */
            const measuredWidth = e.nativeEvent.layout.width;
            if (measuredWidth > 0) {
              let calculatedNewLabelWidth = measuredWidth;
              if (measuredWidth > 10) {
                if (responsiveSmallOffset !== undefined && !isNaN(responsiveSmallOffset)) {
                  calculatedNewLabelWidth += responsiveSmallOffset;
                }
              }
              labelWidth.value = calculatedNewLabelWidth;
            }
          }}
          // The `textStyle` constant *should* now be inferred by TS as AnimateStyle<RNTextStyle>
          // which is compatible with ReText's expectations.
          style={textStyle}
          text={currentText}
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({ /* ... styles ... */
  wrapper: { flex: 1, },
  content: { position: 'relative', },
});
export default memo(AnimatedIntro);
