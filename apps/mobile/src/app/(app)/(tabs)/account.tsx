import { useClerk, useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Screen, Text } from "@/components/ui";
import { LOCALES, LOCALE_LABELS, useLocale, useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";
export default function AccountScreen() {
  const {user}=useUser(), {signOut}=useClerk();
  const client=useQueryClient();
  const [locale,setLocale]=useLocale();
  const [languages,setLanguages]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const t=useTranslations("mobile.account"), f=useTranslations("mobile.foundation");
  async function logout(){setBusy(true);setError("");try{await signOut();client.clear();}catch{setError(f("signOutError"));}finally{setBusy(false);}}
  return <Screen edges={["top","left","right"]}>
    <Text variant="title" style={styles.title}>{t("title")}</Text>
    <Text variant="heading">{user?.username || user?.fullName || user?.primaryEmailAddress?.emailAddress}</Text>
    <Text variant="caption">{user?.primaryEmailAddress?.emailAddress}</Text>
    <Text variant="caption" style={styles.note}>{f("sharedAccount")}</Text>
    <Link href="/edit-profile" style={styles.row}>{t("editProfile")}</Link>
    {user?.passwordEnabled ? <Link href="/change-password" style={styles.row}>{t("changePassword")}</Link> : null}
    <Pressable accessibilityRole="button" accessibilityState={{expanded:languages}} onPress={()=>setLanguages(!languages)} style={styles.row}><Text>{t("language")} · {LOCALE_LABELS[locale]}</Text></Pressable>
    {languages ? <View>{LOCALES.map(l=><Pressable key={l} accessibilityRole="radio" accessibilityState={{selected:l===locale}} style={styles.row} onPress={()=>{void setLocale(l);setLanguages(false);}}><Text color={l===locale?colors.primaryDark:colors.foreground}>{LOCALE_LABELS[l]}</Text></Pressable>)}</View>:null}
    <Link href="/about" style={styles.row}>{t("about")}</Link>
    <Link href="/contact" style={styles.row}>{f("contact")}</Link>
    <Link href="/privacy" style={styles.row}>{t("privacy")}</Link>
    {error?<Text color={colors.destructive}>{error}</Text>:null}
    <Button title={t("signOut")} loading={busy} onPress={()=>void logout()} variant="outline" style={styles.signOut}/>
    <Link href="/delete-account" style={[styles.row,styles.delete]}>{t("deleteAccount")}</Link>
  </Screen>;
}
const styles=StyleSheet.create({title:{marginVertical:spacing.lg},note:{marginVertical:spacing.xl},row:{paddingVertical:spacing.lg,minHeight:52,fontSize:16,color:colors.foreground,borderBottomWidth:1,borderBottomColor:colors.hairline},signOut:{marginTop:spacing.xl},delete:{color:colors.destructive,marginTop:spacing.md}});
