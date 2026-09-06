import { Stack } from "expo-router";
import { Screen, Text } from "@/components/ui";
import { spacing } from "@/lib/theme";
export default function Privacy(){
 return <Screen contentContainerStyle={{gap:spacing.lg}}><Stack.Screen options={{title:"Privacy"}}/>
 <Text variant="heading">Your Link account</Text>
 <Text>Clerk manages your sign-in details. The mobile app stores your Clerk account ID, email, username, name and profile image URL in its own database. It does not store your password.</Text>
 <Text variant="heading">Shared account, separate app data</Text>
 <Text>Your login and profile are shared with the Link website. Mobile activity data is kept separately. This version does not record audio or collect lesson results.</Text>
 <Text variant="heading">Deleting your account</Text>
 <Text>Deleting your account removes your shared Clerk identity and starts data removal in both apps. The mobile database retains only an opaque account ID and deletion time to prevent delayed updates from restoring deleted information. Technical request counters expire automatically.</Text>
 <Text>Use Contact us in Account to ask the LINK team about your data.</Text>
 </Screen>;
}

