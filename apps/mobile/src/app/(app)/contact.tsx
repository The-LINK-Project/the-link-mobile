import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Button, Screen, Text } from "@/components/ui";
import { CONTACT_URL } from "@/lib/links";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";
export default function Contact(){
 const t=useTranslations("mobile.foundation"), a=useTranslations("mobile.account");
 const [error,setError]=useState("");
 return <Screen contentContainerStyle={{gap:spacing.lg}}><Stack.Screen options={{title:t("contact")}}/>
  <Text>{t("contactBody")}</Text><Button title={t("contactAction")} onPress={()=>void WebBrowser.openBrowserAsync(CONTACT_URL).catch(()=>setError(a("genericError")))}/>
  {error?<Text color={colors.destructive}>{error}</Text>:null}
 </Screen>;
}

