import { useClerk } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Screen, Text, TextField, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";
export default function DeleteAccount() {
  const t=useTranslations("mobile.account"), f=useTranslations("mobile.foundation");
  const {signOut}=useClerk(), router=useRouter();
  const [confirmation,setConfirmation]=useState(""), [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function remove(){
    if(confirmation!=="DELETE"||busy)return;
    setBusy(true);setError("");
    try{await api.deleteAccount();try{await signOut();}catch{/* Deleted Clerk sessions may already be gone. */}router.replace("/sign-in");}
    catch{setError(t("deleteFailed"));}finally{setBusy(false);}
  }
  return <Screen contentContainerStyle={{gap:spacing.lg}}>
    <Stack.Screen options={{title:t("deleteAccount")}}/>
    <Text variant="heading">{t("deleteTitle")}</Text><Text>{f("deleteWarning")}</Text>
    <TextField label={f("deleteTyped")} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false}/>
    {error?<Text color={colors.destructive}>{error}</Text>:null}
    <Button title={t("deleteConfirm")} variant="destructive" loading={busy} disabled={confirmation!=="DELETE"} onPress={()=>void remove()}/>
    <Button title={t("cancel")} variant="outline" disabled={busy} onPress={()=>router.back()}/>
  </Screen>;
}
