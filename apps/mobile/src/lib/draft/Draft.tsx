import { View, Text, StyleSheet } from "react-native";
import { palette, spacing } from "../ui/theme";

export default function Draft() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Draft Center</Text>
      <Text style={styles.subheading}>
        Your stock picking view will appear here soon.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    backgroundColor: palette.background,
    gap: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  subheading: {
    color: palette.textSecondary,
    textAlign: "center",
  },
});
