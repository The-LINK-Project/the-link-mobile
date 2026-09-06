import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { LoadingState } from "@/components/ui";
import { colors } from "@/lib/theme";
export default function AppLayout() {
  const {isLoaded,isSignedIn}=useAuth();
  if(!isLoaded) return <LoadingState/>;
  if(!isSignedIn) return <Redirect href="/sign-in"/>;
  return <Stack screenOptions={{headerShadowVisible:false,headerTintColor:colors.foreground,headerStyle:{backgroundColor:colors.background},contentStyle:{backgroundColor:colors.background},headerBackButtonDisplayMode:"minimal",title:""}}>
    <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
  </Stack>;
}
