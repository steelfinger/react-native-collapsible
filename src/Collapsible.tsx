import React, {
  ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  EasingFunction,
  interpolate,
  measure,
  runOnJS,
  runOnUI,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface CollapsibleProps {
  /** Alignment of content during transition. @default "top" */
  align?: "top" | "center" | "bottom";
  /** Whether the content is collapsed. @default true */
  collapsed?: boolean;
  /** Height to collapse to. @default 0 */
  collapsedHeight?: number;
  /** Transition duration in milliseconds. @default 300 */
  duration?: number;
  /** Easing function for the transition. @default Easing.inOut(Easing.cubic) */
  easing?: EasingFunction;
  /** Allow pointer events while collapsed. @default false */
  enablePointerEvents?: boolean;
  /** Keep children mounted while collapsed. @default true */
  renderChildrenCollapsed?: boolean;
  /** Style for the content container */
  style?: StyleProp<ViewStyle>;
  /** Called when the expand/collapse animation completes */
  onAnimationEnd?: () => void;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type Phase =
  | { status: "collapsed" }
  | { status: "measuring" }
  | { status: "open"; contentHeight: number; animate: boolean };

type Action =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "MEASURED"; height: number }
  | { type: "CONTENT_RESIZED"; height: number };

function reducer(state: Phase, action: Action): Phase {
  switch (action.type) {
    case "OPEN":
      return state.status === "collapsed" ? { status: "measuring" } : state;
    case "CLOSE":
      return { status: "collapsed" };
    case "MEASURED":
      return { status: "open", contentHeight: action.height, animate: true };
    case "CONTENT_RESIZED":
      return { status: "open", contentHeight: action.height, animate: false };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Collapsible = ({
  align = "top",
  collapsed = true,
  collapsedHeight = 0,
  duration = 300,
  easing = Easing.inOut(Easing.cubic),
  enablePointerEvents = false,
  onAnimationEnd,
  renderChildrenCollapsed = true,
  style,
  children,
}: CollapsibleProps) => {
  const [phase, dispatch] = useReducer(
    reducer,
    collapsed ? { status: "collapsed" } : { status: "measuring" }
  );

  const prevCollapsed = useRef(collapsed);
  // When initially open, skip the opening animation
  const skipNextAnimation = useRef(!collapsed);

  const contentRef = useAnimatedRef<Animated.View>();
  const heightSV = useSharedValue(collapsed ? collapsedHeight : 0);
  const contentHeightSV = useSharedValue(0);

  const handleAnimationEnd = useCallback(() => {
    onAnimationEnd?.();
  }, [onAnimationEnd]);

  const animateTo = useCallback(
    (toValue: number) => {
      if (skipNextAnimation.current) {
        skipNextAnimation.current = false;
        heightSV.value = toValue;
        handleAnimationEnd();
        return;
      }
      heightSV.value = withTiming(
        toValue,
        { duration, easing },
        (finished: boolean | undefined) => {
          if (finished) runOnJS(handleAnimationEnd)();
        }
      );
    },
    [duration, easing, heightSV, handleAnimationEnd]
  );

  // React to collapsed prop flips
  useEffect(() => {
    if (collapsed === prevCollapsed.current) return;
    prevCollapsed.current = collapsed;

    if (collapsed) {
      dispatch({ type: "CLOSE" });
      animateTo(collapsedHeight);
    } else {
      dispatch({ type: "OPEN" });
    }
  }, [collapsed, collapsedHeight, animateTo]);

  // Trigger measurement when entering the measuring phase
  useEffect(() => {
    if (phase.status !== "measuring") return;

    const frameId = requestAnimationFrame(() => {
      runOnUI(() => {
        "worklet";
        const result = measure(contentRef);
        if (result !== null) {
          runOnJS(dispatch)({ type: "MEASURED", height: result.height });
        }
      })();
    });

    return () => cancelAnimationFrame(frameId);
  }, [phase.status, contentRef]);

  // Animate when content height becomes known
  useEffect(() => {
    if (phase.status !== "open" || !phase.animate) return;
    contentHeightSV.value = phase.contentHeight;
    animateTo(phase.contentHeight);
  }, [phase, contentHeightSV, animateTo]);

  const onLayoutWhenOpen = useCallback(
    (event: LayoutChangeEvent) => {
      if (phase.status !== "open") return;
      const newHeight = event.nativeEvent.layout.height;
      if (newHeight === phase.contentHeight) return;
      // Content resized while open — snap immediately, no animation
      heightSV.value = newHeight;
      contentHeightSV.value = newHeight;
      dispatch({ type: "CONTENT_RESIZED", height: newHeight });
    },
    [phase, heightSV, contentHeightSV]
  );

  const rootStyle = useAnimatedStyle(() => ({
    overflow: "hidden",
    height: heightSV.value,
  }));

  const innerStyle = useAnimatedStyle(() => {
    const ch = contentHeightSV.value;
    if (ch === 0 || align === "top") return {};

    if (align === "center") {
      return {
        transform: [
          {
            translateY: interpolate(heightSV.value, [0, ch], [ch / -2, 0]),
          },
        ],
      };
    }

    // bottom
    return {
      transform: [
        {
          translateY: interpolate(heightSV.value, [0, ch], [-ch, 0]),
        },
      ],
    };
  });

  const isOpen = phase.status === "open";
  const shouldRenderChildren =
    renderChildrenCollapsed || isOpen || phase.status === "measuring";

  return (
    <Animated.View
      style={[
        rootStyle,
        !enablePointerEvents && collapsed ? ({ pointerEvents: "none" } as ViewStyle) : undefined,
      ]}
    >
      <Animated.View
        ref={contentRef}
        style={[
          style,
          innerStyle,
          phase.status === "measuring"
            ? ({ position: "absolute", opacity: 0 } as ViewStyle)
            : undefined,
        ]}
        onLayout={isOpen ? onLayoutWhenOpen : undefined}
      >
        {shouldRenderChildren && children}
      </Animated.View>
    </Animated.View>
  );
};

export default Collapsible;
