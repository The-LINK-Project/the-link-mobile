import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { Screen, Text, ErrorState, LoadingState } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { spacing } from "@/lib/theme";
export default function HomeScreen() {
  const t=useTranslations("mobile.foundation");
  const me=useMe();
  return <Screen edges={["top","left","right"]}>
    <View style={styles.header}><Image source={require("../../../../assets/images/icon.png")} style={styles.logo}/><Text variant="title">{t("welcome")}</Text></View>
    {me.isPending ? <LoadingState/> : me.isError ? <ErrorState message={t("syncError")} onRetry={()=>void me.refetch()}/> :
    <View style={styles.empty}><Text variant="heading">{t("empty")}</Text><Text variant="caption">{t("emptyBody")}</Text></View>}
  </Screen>;
}
const styles=StyleSheet.create({header:{gap:spacing.lg,paddingTop:spacing.xl},logo:{width:56,height:56,borderRadius:12},empty:{flex:1,justifyContent:"center",gap:spacing.sm,paddingVertical:spacing.xxl}});

