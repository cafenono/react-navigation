import * as React from 'react';
import {
  InteractionManager,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State as GestureState,
} from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { DrawerProps } from '../../types';
import DrawerProgressContext from '../../utils/DrawerProgressContext';
import Overlay from './Overlay';

const SWIPE_DISTANCE_MINIMUM = 5;
const DEFAULT_DRAWER_WIDTH = '80%';

// const minmax = (value: number, start: number, end: number) => {
//     'worklet';

//     return Math.min(Math.max(value, start), end);
// };

export default function Drawer({
  dimensions,
  drawerPosition,
  drawerStyle,
  drawerType,
  gestureHandlerProps,
  hideStatusBarOnOpen,
  keyboardDismissMode,
  onClose,
  onOpen,
  open,
  actionDirection,
  overlayStyle,
  renderRightDrawerContent,
  renderLeftDrawerContent,
  renderSceneContent,
  statusBarAnimation,
  swipeDistanceThreshold,
  swipeEdgeWidth,
  swipeEnabled,
  swipeVelocityThreshold,
}: DrawerProps) {
  const sharedDirectionStatus =
    useSharedValue<'left_open' | 'right_open' | 'close'>('close');

  const getDrawerWidth = (): number => {
    const { width = DEFAULT_DRAWER_WIDTH } =
      StyleSheet.flatten(drawerStyle) || {};

    if (typeof width === 'string' && width.endsWith('%')) {
      // Try to calculate width if a percentage is given
      const percentage = Number(width.replace(/%$/, ''));

      if (Number.isFinite(percentage)) {
        return dimensions.width * (percentage / 100);
      }
    }

    return typeof width === 'number' ? width : 0;
  };

  const drawerWidth = getDrawerWidth();

  const isOpen = drawerType === 'permanent' ? true : open;
  const isRight = drawerPosition === 'right';

  const getDrawerTranslationX = React.useCallback(
    (open: boolean, currentDirection?: string, isMesure?: boolean) => {
      'worklet';

      if (currentDirection === undefined) {
        return drawerWidth;
      }

      if (isMesure) {
        if (currentDirection === 'left') {
          return open ? drawerWidth * 2 : drawerWidth;
        }

        return open ? 0 : drawerWidth;
      }

      /**
       * 왼쪽 오른쪽 드로워 open/close translateX 상태 (drawerWidth: 390 을 가정 했을때)
       *
       * right: 닫힘 390, 열림 0
       * left: 닫힘  390, 열림 780
       */

      if (currentDirection === 'left') {
        if (sharedDirectionStatus.value === 'right_open') {
          // console.log('오른쪽 닫힘');
          sharedDirectionStatus.value = 'close';
          return drawerWidth;
        } else if (sharedDirectionStatus.value === 'left_open') {
          // 열려 있는 상태에서 여는 방향으로 다시 스와이프
          // console.log('왼쪽 열림');
          sharedDirectionStatus.value = 'left_open';
          return drawerWidth * 2;
        } else if (sharedDirectionStatus.value === 'close') {
          if (open) {
            // console.log('왼쪽 열림');
            sharedDirectionStatus.value = 'left_open';
            return drawerWidth * 2;
          } else {
            sharedDirectionStatus.value = 'close';
            return drawerWidth;
          }
        }
        return open ? 0 : drawerWidth;
      }

      if (currentDirection === 'right') {
        if (sharedDirectionStatus.value === 'left_open') {
          // console.log('왼쪽 닫힘');
          sharedDirectionStatus.value = 'close';
          return drawerWidth;
        } else if (sharedDirectionStatus.value === 'right_open') {
          // 열려 있는 상태에서 여는 방향으로 다시 스와이프
          // console.log('오른쪽쪽 열림');
          sharedDirectionStatus.value = 'right_open';
          return 0;
        } else if (sharedDirectionStatus.value === 'close') {
          if (open) {
            // console.log('오른쪽 열림');
            sharedDirectionStatus.value = 'right_open';
            return 0;
          } else {
            sharedDirectionStatus.value = 'close';
            return drawerWidth;
          }
        }
        return open ? 0 : drawerWidth;
      }
      return open ? 0 : drawerWidth;
    },
    [drawerPosition, drawerWidth]
  );

  const hideStatusBar = React.useCallback(
    (hide: boolean) => {
      if (hideStatusBarOnOpen) {
        StatusBar.setHidden(hide, statusBarAnimation);
      }
    },
    [hideStatusBarOnOpen, statusBarAnimation]
  );

  React.useEffect(() => {
    hideStatusBar(isOpen);

    return () => hideStatusBar(false);
  }, [isOpen, hideStatusBarOnOpen, statusBarAnimation, hideStatusBar]);

  const interactionHandleRef = React.useRef<number | null>(null);

  const startInteraction = () => {
    interactionHandleRef.current = InteractionManager.createInteractionHandle();
  };

  const endInteraction = () => {
    if (interactionHandleRef.current != null) {
      InteractionManager.clearInteractionHandle(interactionHandleRef.current);
      interactionHandleRef.current = null;
    }
  };

  const hideKeyboard = () => {
    if (keyboardDismissMode === 'on-drag') {
      Keyboard.dismiss();
    }
  };

  const onGestureStart = () => {
    startInteraction();
    hideKeyboard();
    hideStatusBar(true);
  };

  const onGestureEnd = () => {
    endInteraction();
  };

  // FIXME: Currently hitSlop is broken when on Android when drawer is on right
  // https://github.com/software-mansion/react-native-gesture-handler/issues/569
  // const hitSlop = isRight
  //     ? // Extend hitSlop to the side of the screen when drawer is closed
  //       // This lets the user drag the drawer from the side of the screen
  //       { right: 0, width: isOpen ? undefined : swipeEdgeWidth }
  //     : { left: 0, width: isOpen ? undefined : swipeEdgeWidth };

  // 화면 전체를 hitSlop 영역으로 지정한다.
  const hitSlop = { left: 0, width: isOpen ? undefined : swipeEdgeWidth };

  const touchStartX = useSharedValue(0);
  const touchX = useSharedValue(0);
  const translationX = useSharedValue(getDrawerTranslationX(open));
  const gestureState = useSharedValue<GestureState>(GestureState.UNDETERMINED);

  const toggleDrawer = React.useCallback(
    (open: boolean, velocity?: number) => {
      'worklet';

      // 속도가 없을 경우에는 return 시킨다.
      if (open && velocity === undefined) {
        return;
      }

      // DrawerActions로 닫았을 경우 처리
      let currentDirection = velocity < 0 ? 'right' : 'left';

      if (!open && velocity === undefined) {
        if (sharedDirectionStatus.value === 'left_open') {
          currentDirection = 'right';
        }

        if (sharedDirectionStatus.value === 'right_open') {
          currentDirection = 'left';
        }
      }

      console.log(open, velocity, currentDirection);

      const translateX = getDrawerTranslationX(open, currentDirection);
      touchStartX.value = 0;
      touchX.value = 0;
      translationX.value = withSpring(
        translateX,
        {
          velocity,
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        },
        () => {
          // translationX 390 닫힘
          // left 열림: 780
          // right 열림: 0
          // if (!open) {
          //     runOnJS(onClose)();
          //     return;
          // }

          if (
            translationX.value ===
            getDrawerTranslationX(true, currentDirection, true)
          ) {
            const leftOpenTranslationX = getDrawerTranslationX(
              true,
              'left',
              true
            );
            // const rightOpenTranslationX = getDrawerTranslationX(true, 'right', true);
            const direction =
              getDrawerTranslationX(true, currentDirection, true) ===
              leftOpenTranslationX
                ? 'left'
                : 'right';
            console.log('열림=====>');
            runOnJS(onOpen)(direction);
          } else if (
            translationX.value ===
            getDrawerTranslationX(false, currentDirection, true)
          ) {
            console.log('닫힘=====>');
            runOnJS(onClose)();
          }
        }
      );
    },
    [getDrawerTranslationX, onClose, onOpen, touchStartX, touchX, translationX]
  );

  React.useEffect(() => {
    if (sharedDirectionStatus.value === 'close' && !open) {
      return;
    }
    console.log('------------- toggle -------------------', open);
    toggleDrawer(
      open,
      actionDirection === undefined
        ? undefined
        : actionDirection === 'left'
        ? 10
        : -10
    );
  }, [open, toggleDrawer]);

  const onGestureEvent = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number }
  >({
    onStart: (event, ctx) => {
      ctx.startX = translationX.value;
      gestureState.value = event.state;
      touchStartX.value = event.x;

      runOnJS(onGestureStart)();
    },
    onActive: (event, ctx) => {
      touchX.value = event.x;
      translationX.value = ctx.startX + event.translationX;
      gestureState.value = event.state;
    },
    onEnd: (event) => {
      gestureState.value = event.state;

      const swipeDirection = event.translationX < 0 ? 'left' : 'right';
      let isOpen = open;

      if (sharedDirectionStatus.value === 'left_open') {
        if (swipeDirection === 'left') {
          isOpen = false;
        }
      } else if (sharedDirectionStatus.value === 'right_open') {
        if (swipeDirection === 'right') {
          isOpen = false;
        }
      } else if (sharedDirectionStatus.value === 'close') {
        // 닫힘
        if (swipeDirection === 'left') {
          isOpen =
            (event.velocityX === 0 ? event.translationX : event.velocityX) < 0;
        } else if (swipeDirection === 'right') {
          isOpen =
            (event.velocityX === 0 ? event.translationX : event.velocityX) > 0;
        }
      }

      // const nextOpen =
      //     (Math.abs(event.translationX) > SWIPE_DISTANCE_MINIMUM &&
      //         Math.abs(event.translationX) > swipeVelocityThreshold) ||
      //     Math.abs(event.translationX) > swipeDistanceThreshold
      //         ? drawerPosition === 'left'
      //             ? // If swiped to right, open the drawer, otherwise close it
      //               (event.velocityX === 0 ? event.translationX : event.velocityX) > 0
      //             : // If swiped to left, open the drawer, otherwise close it
      //               (event.velocityX === 0 ? event.translationX : event.velocityX) < 0
      //         : open;

      const nextOpen =
        (Math.abs(event.translationX) > SWIPE_DISTANCE_MINIMUM &&
          Math.abs(event.translationX) > swipeVelocityThreshold) ||
        Math.abs(event.translationX) > swipeDistanceThreshold;

      toggleDrawer(nextOpen ? isOpen : open, event.velocityX);
      runOnJS(onGestureEnd)();
    },
  });

  const translateX = useDerivedValue(() => {
    // Comment stolen from react-native-gesture-handler/DrawerLayout
    //
    // While closing the drawer when user starts gesture outside of its area (in greyed
    // out part of the window), we want the drawer to follow only once finger reaches the
    // edge of the drawer.
    // E.g. on the diagram below drawer is illustrate by X signs and the greyed out area by
    // dots. The touch gesture starts at '*' and moves left, touch path is indicated by
    // an arrow pointing left
    // 1) +---------------+ 2) +---------------+ 3) +---------------+ 4) +---------------+
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|.<-*..|    |XXXXXXXX|<--*..|    |XXXXX|<-----*..|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    +---------------+    +---------------+    +---------------+    +---------------+
    //
    // For the above to work properly we define animated value that will keep start position
    // of the gesture. Then we use that value to calculate how much we need to subtract from
    // the translationX. If the gesture started on the greyed out area we take the distance from the
    // edge of the drawer to the start position. Otherwise we don't subtract at all and the
    // drawer be pulled back as soon as you start the pan.
    //
    // This is used only when drawerType is "front"
    // const touchDistance =
    //     drawerType === 'front' && gestureState.value === GestureState.ACTIVE
    //         ? minmax(
    //               drawerPosition === 'left'
    //                   ? touchStartX.value - drawerWidth
    //                   : dimensions.width - drawerWidth - touchStartX.value,
    //               0,
    //               dimensions.width
    //           )
    //         : 0;

    // const translateX =
    //     drawerPosition === 'left'
    //         ? minmax(translationX.value + touchDistance, -drawerWidth, 0)
    //         : minmax(translationX.value - touchDistance, 0, drawerWidth);

    return translationX.value < 0 ? 0 : translationX.value;
  });

  const drawerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX:
            drawerType === 'permanent' || drawerType === 'back'
              ? 0
              : translateX.value,
        },
      ],
      // 스와이프 방향에 따라서 보여줄 drawer의 zIndex를 올려준다.
      zIndex: translationX.value > dimensions.width ? 1 : 0,
    };
  });

  const drawerAnimatedRightStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX:
            drawerType === 'permanent' || drawerType === 'back'
              ? 0
              : translateX.value,
        },
      ],
      // 스와이프 방향에 따라서 보여줄 drawer의 zIndex를 올려준다.
      zIndex: translationX.value < dimensions.width ? 1 : 0,
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX:
            drawerType === 'permanent' || drawerType === 'front'
              ? 0
              : translateX.value - drawerWidth,
          // drawerType === 'permanent' || drawerType === 'front'
          //     ? 0
          //     : drawerPosition === 'left'
          //     ? drawerWidth + translateX.value
          //     : translateX.value - drawerWidth
        },
      ],
      zIndex: 2,
    };
  });

  const progress = useDerivedValue(() => {
    const direction = translateX.value < drawerWidth ? 'right' : 'left';

    return drawerType === 'permanent'
      ? 1
      : interpolate(
          translateX.value,
          [
            getDrawerTranslationX(false, direction, true),
            getDrawerTranslationX(true, direction, true),
          ],
          [0, 1]
        );
  });

  return (
    <DrawerProgressContext.Provider value={progress}>
      <PanGestureHandler
        activeOffsetX={[-SWIPE_DISTANCE_MINIMUM, SWIPE_DISTANCE_MINIMUM]}
        failOffsetY={[-SWIPE_DISTANCE_MINIMUM, SWIPE_DISTANCE_MINIMUM]}
        hitSlop={hitSlop}
        enabled={drawerType !== 'permanent' && swipeEnabled}
        onGestureEvent={onGestureEvent}
        {...gestureHandlerProps}
      >
        {/* Immediate child of gesture handler needs to be an Animated.View */}
        <Animated.View
          style={[
            styles.main,
            {
              flexDirection:
                drawerType === 'permanent' && !isRight ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Animated.View style={[styles.content, contentAnimatedStyle]}>
            <View
              accessibilityElementsHidden={isOpen && drawerType !== 'permanent'}
              importantForAccessibility={
                isOpen && drawerType !== 'permanent'
                  ? 'no-hide-descendants'
                  : 'auto'
              }
              style={styles.content}
            >
              {renderSceneContent()}
            </View>
            {drawerType !== 'permanent' ? (
              <Overlay
                progress={progress}
                onPress={() => toggleDrawer(false)}
                style={overlayStyle}
              />
            ) : null}
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal={isOpen && drawerType !== 'permanent'}
            removeClippedSubviews={Platform.OS !== 'ios'}
            style={[
              styles.container,
              {
                position: drawerType === 'permanent' ? 'relative' : 'absolute',
                zIndex: drawerType === 'back' ? -1 : 0,
              },
              drawerAnimatedStyle,
              drawerStyle as any,
              { left: 0 },
            ]}
          >
            {renderLeftDrawerContent()}
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal={isOpen && drawerType !== 'permanent'}
            removeClippedSubviews={Platform.OS !== 'ios'}
            style={[
              styles.container,
              {
                position: drawerType === 'permanent' ? 'relative' : 'absolute',
                zIndex: drawerType === 'back' ? -1 : 0,
              },
              drawerAnimatedRightStyle,
              drawerStyle as any,
              { right: 0 },
            ]}
          >
            {renderRightDrawerContent()}
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </DrawerProgressContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    top: 0,
    bottom: 0,
    maxWidth: '100%',
    width: DEFAULT_DRAWER_WIDTH,
  },
  content: {
    flex: 1,
  },
  main: {
    flex: 1,
    ...Platform.select({
      // FIXME: We need to hide `overflowX` on Web so the translated content doesn't show offscreen.
      // But adding `overflowX: 'hidden'` prevents content from collapsing the URL bar.
      web: null,
      default: { overflow: 'hidden' },
    }),
  },
});
