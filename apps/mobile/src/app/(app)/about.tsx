import { Image } from "expo-image";
import { Stack } from "expo-router";
import { View } from "react-native";
import { Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { spacing } from "@/lib/theme";
const team=[
  {name:"Adrish Majumder",image:require("../../../assets/about-us/mun.jpeg")},
  {name:"Alexandre Lee",image:require("../../../assets/about-us/Alex.jpeg")},
  {name:"Ruhan Gupta",image:require("../../../assets/about-us/Ruhan.jpeg")},
  {name:"Videep Agarwal",image:require("../../../assets/about-us/Videep.jpeg")},
];
export default function About(){
 const t=useTranslations("aboutUs");
 return <Screen contentContainerStyle={{gap:spacing.xl}}><Stack.Screen options={{title:t("headerTitle")}}/>
   <Text>{t("headerDescription")}</Text><Text variant="heading">{t("headerCall")}</Text>
   {team.map(member=><View key={member.name} style={{flexDirection:"row",gap:spacing.lg,alignItems:"center"}}>
     <Image source={member.image} style={{width:64,height:64,borderRadius:32}} accessibilityLabel={member.name}/>
     <View style={{flex:1}}><Text variant="bodyStrong">{member.name}</Text><Text variant="caption">{t("role")}</Text></View>
   </View>)}
 </Screen>;
}

