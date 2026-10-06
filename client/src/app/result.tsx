import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../components/AppButton";
import type { VerificationStatus } from "../services/medicine";
import { colors, radius, shadow, spacing, typography } from "../theme";

const asText = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

const STATUS_STYLES: Record<
  VerificationStatus,
  {
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    surface: string;
    border: string;
    label: string;
  }
> = {
  safe: {
    icon: "shield-checkmark",
    tint: colors.success,
    surface: colors.successSurface,
    border: colors.successBorder,
    label: "Verified",
  },
  unsafe: {
    icon: "alert-circle",
    tint: colors.danger,
    surface: colors.dangerSurface,
    border: colors.dangerBorder,
    label: "Flagged",
  },
  unknown: {
    icon: "help-circle",
    tint: colors.warning,
    surface: colors.warningSurface,
    border: colors.warningBorder,
    label: "Unverified",
  },
};

const METHOD_LABELS: Record<string, string> = {
  barcode: "Barcode scan",
  barcode_corrected: "Barcode scan (completed by hand)",
  ocr: "Label scan",
  ocr_corrected: "Label scan (corrected)",
  manual: "Entered manually",
};

const isStatus = (value: string): value is VerificationStatus =>
  value === "safe" || value === "unsafe" || value === "unknown";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const batchNumber = asText(
    params.batchNumber as string | string[] | undefined,
  );

  // The verdict is the backend's, not ours. This screen only presents it - the
  // register check happened in the same call that parsed the scan.
  const verdict = useMemo(() => {
    const status = asText(params.status as string | string[] | undefined);
    return {
      status: isStatus(status) ? status : ("unknown" as VerificationStatus),
      title:
        asText(params.title as string | string[] | undefined) ||
        "Could not verify",
      message:
        asText(params.message as string | string[] | undefined) ||
        "This pack could not be checked against the register.",
    };
  }, [params.status, params.title, params.message]);

  const visuals = STATUS_STYLES[verdict.status];

  const method = asText(params.method as string | string[] | undefined);
  const lat = asText(params.lat as string | string[] | undefined);
  const lng = asText(params.lng as string | string[] | undefined);

  const details = [
    { label: "Name", value: asText(params.name as string | string[]) },
    { label: "Active ingredient", value: asText(params.salt as string | string[]) },
    { label: "Batch number", value: batchNumber },
    { label: "Dose", value: asText(params.dose as string | string[]) },
    { label: "Manufactured", value: asText(params.mfdDate as string | string[]) },
    { label: "Expires", value: asText(params.expDate as string | string[]) },
    { label: "GTIN", value: asText(params.gtin as string | string[]) },
    { label: "Serial", value: asText(params.serial as string | string[]) },
  ].filter((row) => row.value);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.statusCard,
            { backgroundColor: visuals.surface, borderColor: visuals.border },
          ]}
        >
          <View style={[styles.statusIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name={visuals.icon} size={40} color={visuals.tint} />
          </View>
          <View style={[styles.statusPill, { backgroundColor: visuals.tint }]}>
            <Text style={styles.statusPillText}>
              {visuals.label.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.statusTitle}>{verdict.title}</Text>
          <Text style={styles.statusMessage}>{verdict.message}</Text>
        </View>

        {details.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medicine details</Text>
            {details.map((row, index) => (
              <View
                key={row.label}
                style={[styles.row, index === details.length - 1 && styles.rowLast]}
              >
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue} selectable>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medicine details</Text>
            <Text style={styles.emptyText}>
              Nothing was captured from the pack. Add the details by hand to run
              a check.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scan info</Text>
          <View style={styles.metaRow}>
            <Ionicons
              name="finger-print-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text style={styles.metaText}>
              {METHOD_LABELS[method] ?? "Unknown source"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color={colors.textMuted}
            />
            <Text style={styles.metaText}>
              {lat && lng
                ? `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
                : "Location not recorded"}
            </Text>
          </View>
        </View>

        {verdict.status !== "safe" ? (
          <AppButton
            label="Correct the details"
            variant="secondary"
            icon="create-outline"
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/manual-entry",
                params: {
                  name: asText(params.name as string | string[]),
                  salt: asText(params.salt as string | string[]),
                  batchNumber,
                  mfdDate: asText(params.mfdDate as string | string[]),
                  expDate: asText(params.expDate as string | string[]),
                  dose: asText(params.dose as string | string[]),
                  gtin: asText(params.gtin as string | string[]),
                  serial: asText(params.serial as string | string[]),
                  barcode: asText(params.barcode as string | string[]),
                  lat,
                  lng,
                },
              })
            }
            style={styles.secondaryAction}
          />
        ) : null}

        <AppButton
          label="Scan another medicine"
          icon="scan-outline"
          onPress={() => router.replace("/(tabs)/scan")}
          style={styles.primaryAction}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },

  statusCard: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  statusIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textInverse,
  },
  statusTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: "center",
  },
  statusMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
  rowLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  rowValue: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
    textAlign: "right",
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  metaText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },

  secondaryAction: { marginBottom: spacing.md },
  primaryAction: { marginTop: spacing.xs },
});
