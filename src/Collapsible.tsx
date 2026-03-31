import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  EasingFunction,
  LayoutChangeEvent,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";

export interface CollapsibleProps {
  /**
   * Alignment of the content when transitioning, can be top, center or bottom
   *
   * @default top
   */
  align?: "top" | "center" | "bottom";
  /**
   * Whether to show the child components or not
   *
   * @default true
   */
  collapsed?: boolean;
  /**
   * Which height should the component collapse to
   *
   * @default 0
   */
  collapsedHeight?: number;
  /**
   * Duration of transition in milliseconds
   *
   * @default 300
   */
  duration?: number;

  /**
   * Enable pointer events on collapsed view
   *
   * @default false
   */
  enablePointerEvents?: boolean;

  /**
   * Function or function name from Easing (or tween-functions if < RN 0.8). Collapsible will try to combine Easing functions for you if you name them like tween-functions
   *
   * @default easeOutCubic
   */
  easing?: EasingFunction;

  /**
   * Render children in collapsible even if not visible
   *
   * @default true
   */
  renderChildrenCollapsed?: boolean;

  /**
   * Optional styling for the container
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Function called when the animation finished
   */
  onAnimationEnd?: () => void;

  children: ReactNode;
}

const normalizeSpeed = (duration: number, height: number) => {
  if (height > 800) {
    return duration;
  }
  return Math.max(0.25, height / 800) * duration;
};

/**
 * Component goes through 3 states:
 * initial: initial state, component mounted and content not measured yet
 * measuring: component measuring content by showing content with opacity 0
 * measured: component finished measuring content and can transition
 * stale: in-between state reserved for extra render cycle when content is re-opened
 */
type MeasureState = "initial" | "measuring" | "measured" | "stale";

const Collapsible = ({
  align = "top",
  collapsed = true,
  collapsedHeight = 0,
  enablePointerEvents = false,
  duration = 800,
  easing = Easing.inOut(Easing.cubic),
  onAnimationEnd,
  renderChildrenCollapsed = true,
  style,
  children,
}: CollapsibleProps) => {
  const [measureState, setMeasureState] = useState<MeasureState>("initial");

  const [contentHeight, setContentHeight] = useState(0);
  const [animating, setAnimating] = useState(false);

  const heightValue = useRef(new Animated.Value(collapsedHeight)).current;
  const animationRef = useRef<Animated.CompositeAnimation>(undefined);
  const contentRef = useRef<View | Animated.LegacyRef<View>>(null);
  const unmounted = useRef(false);
  const savedState = useRef({
    collapsed,
    measureState,
    initiallyOpen: !collapsed,
  }).current;

  useEffect(
    () => () => {
      unmounted.current = true;
    },
    []
  );

  const transitionToHeight = useCallback(
    (height = 0) => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
      if (savedState.initiallyOpen) {
        // If the content is initially open, we don't want to animate the initial height
        savedState.initiallyOpen = false;
        heightValue.setValue(height);
        return;
      }
      const animation = Animated.timing(heightValue, {
        useNativeDriver: false,
        toValue: height,
        duration: normalizeSpeed(duration, height),
        easing,
      });
      animation.start(() => {
        if (unmounted.current) {
          return;
        }
        setAnimating(false);
        if (typeof onAnimationEnd === "function") {
          onAnimationEnd();
        }
      });
      animationRef.current = animation;
      setAnimating(true);
    },
    [duration, easing, heightValue, onAnimationEnd, savedState]
  );

  useEffect(() => {
    /**
     * React on collapsed prop change
     */

    if (collapsed !== savedState.collapsed) {
      savedState.collapsed = collapsed;
      if (collapsed) {
        transitionToHeight(collapsedHeight);
      } else if (measureState === "initial") {
        setMeasureState("measuring");
      } else {
        setMeasureState("stale");
      }
    } else if (measureState === "initial" && !collapsed) {
      setMeasureState("stale");
    }
  }, [
    collapsed,
    collapsedHeight,
    contentHeight,
    measureState,
    savedState,
    transitionToHeight,
  ]);

  useEffect(() => {
    /**
     * Measure the height of the content before expanding the first time
     * onLayout handle should take care of future updates
     */
    if (savedState.measureState !== measureState) {
      savedState.measureState = measureState;
      if (measureState === "stale") {
        /**
         * "stale" measure state means that we are not opening the content first time
         * We need one render cycle more to get the right height of the content
         * We need to do this because the content might have been updated
         */
         
        requestAnimationFrame(() => {
          if (!unmounted.current) {
            setMeasureState("measuring");
          }
        });
        return;
      }
      if (measureState === "measuring") {
        (contentRef.current as View).measure((x, y, width, height) => {
          if (unmounted.current) {
            return;
          }
          setMeasureState("measured");
          setContentHeight(height);
          transitionToHeight(height);
        });
      }
    }
  }, [measureState, savedState, transitionToHeight]);

  const onLayoutWhenOpen = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (measureState === "measuring" || height === contentHeight) {
      return;
    }

    heightValue.setValue(height);
    setContentHeight(height);
  };

  const contentStyle = useMemo(() => {
    const contentStyle: ViewStyle = {};
    if (measureState !== "measured") {
      /**
       * Let's render the content with opacity 0 until
       * we have measured it
       */
      contentStyle.position = "absolute";
      contentStyle.opacity = 0;
    } else if (align === "center") {
      contentStyle.transform = [
        {
          translateY: heightValue.interpolate({
            inputRange: [0, contentHeight],
            outputRange: [contentHeight / -2, 0],
          }),
        },
      ];
    } else if (align === "bottom") {
      contentStyle.transform = [
        {
          translateY: heightValue.interpolate({
            inputRange: [0, contentHeight],
            outputRange: [-contentHeight, 0],
          }),
        },
      ];
    }
    if (animating) {
      contentStyle.height = contentHeight;
    }
    return contentStyle;
  }, [align, animating, contentHeight, heightValue, measureState]);

  const rootStyle = useMemo(() => {
    const hasKnownHeight = measureState === "measured" || collapsed;
    return hasKnownHeight
      ? ({
          overflow: "hidden",
          height: heightValue,
        } as ViewStyle)
      : undefined;
  }, [collapsed, heightValue, measureState]);

  /**
   * Render children
   * if renderChildrenCollapsed prop is true
   *  or if not then
   * if content is not collapsed
   *  or if not then
   * if content is animating
   *  or if not then
   * if measureState is "stale" or "measuring"
   */
  const shouldRenderChildren =
    renderChildrenCollapsed ||
    !collapsed ||
    animating ||
    measureState === "stale" ||
    measureState === "measuring";

  return (
    <Animated.View
      style={rootStyle}
      pointerEvents={!enablePointerEvents && collapsed ? "none" : "auto"}
    >
      <Animated.View
        ref={contentRef}
        style={[style, contentStyle]}
        onLayout={!animating && !collapsed ? onLayoutWhenOpen : undefined}
      >
        {shouldRenderChildren && children}
      </Animated.View>
    </Animated.View>
  );
};

export default Collapsible;
