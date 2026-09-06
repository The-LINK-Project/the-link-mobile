import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@/lib/theme";
import { useTranslations } from "@/lib/i18n";
export default function TabLayout() {
  const t=useTranslations("mobile.foundation"), a=useTranslations("mobile.account");
  return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.primaryDark,tabBarInactiveTintColor:colors.muted,tabBarStyle:{backgroundColor:colors.surface,borderTopColor:colors.border}}}>
    <Tabs.Screen name="index" options={{title:t("home"),tabBarIcon:({color,size})=><Ionicons name="home-outline" color={color} size={size}/>}}/>
    <Tabs.Screen name="account" options={{title:a("title"),tabBarIcon:({color,size})=><Ionicons name="person-outline" color={color} size={size}/>}}/>
  </Tabs>;
}

