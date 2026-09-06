import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Pads its content by the keyboard's height so nothing sits underneath it.
//
// Why not a KeyboardAvoidingView? Expo SDK 57 apps are edge-to-edge, which
// disables Android's "resize the window for the keyboard" mode and stops
// React Native's keyboardDidShow event from firing at all, so the core
// component is inert. react-native-keyboard-controller's replacement does
// receive the keyboard animation, but its frame-versus-window arithmetic
// produced no padding on Android in our layouts (verified on the emulator),
// so this view applies the measured height directly — the value it exposes
// is 0 when closed and -height while open, animated frame by frame.
//
// Mount it inside the SafeAreaView: the bottom inset is already padding
// under the keyboard, so it is subtracted to avoid a double gap.
export function KeyboardAvoiding({
    children,
    style,
    /** Extra space to leave, e.g. for a bar rendered below this view */
    extraOffset = 0,
}: {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    extraOffset?: number;
}) {
    const { height } = useReanimatedKeyboardAnimation();
    const insets = useSafeAreaInsets();
    const bottomInset = insets.bottom;

    const animatedStyle = useAnimatedStyle(() => ({
        paddingBottom: Math.max(-height.value - bottomInset - extraOffset, 0),
    }));

    return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
