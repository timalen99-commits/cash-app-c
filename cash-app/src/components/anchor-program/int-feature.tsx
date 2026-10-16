import { View } from "react-native";
import { useTheme } from "react-native-paper";
import { useAuthorization } from "../../utils/useAuthorization";
import InitAccount from "./init-ui";
export function InitAccountFeature() {
  const { selectedAccount } = useAuthorization();

  if (!selectedAccount) {
    return null;
  }
  const user = selectedAccount.publicKey;
  const theme = useTheme();

  return (
    <>
      <View style={{ marginTop: 24, marginBottom: 24, alignItems: "center" }}>
        <InitAccount user={user!} />
      </View>
    </>
  );
}
