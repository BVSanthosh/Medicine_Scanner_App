import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../../components/ScreenHeader";
import type { VerificationStatus } from "../../services/medicine";
import { colors, radius, shadow, spacing, typography } from "../../theme";

type ScanHistoryEntry = {
  id: string;
  name: string;
  dose?: string;
  batchNumber: string;
  /** ISO 8601 timestamp. */
  scannedAt: string;
  status: VerificationStatus;
};

// ==== TODO: REPLACE WITH THE REAL API CALL ================================
//
// const response = await fetch(`${API_BASE_URL}/scans`, {
//   headers: { Authorization: `Bearer ${token}` },
// });
// const history = (await response.json()) as ScanHistoryEntry[];
//
// ==========================================================================
const MOCK_HISTORY: ScanHistoryEntry[] = [
  {
    id: "1",
    name: "Panadol",
    dose: "500mg",
    batchNumber: "49302",
    scannedAt: "2026-08-14T09:12:00Z",
    status: "safe",
  },
  {
    id: "2",
    name: "Unknown medicine",
    batchNumber: "FAKE-999",
    scannedAt: "2026-08-13T18:40:00Z",
    status: "unsafe",
  },
  {
    id: "3",
    name: "Crocin Advance",
    dose: "500mg",
    batchNumber: "LOT9",
    scannedAt: "2026-08-10T07:55:00Z",
    status: "safe",
  },
];

const STATUS_META = {
  safe: {
    label: "Safe",
    icon: "shield-checkmark" as const,
    tint: colors.successText,
    surface: colors.successSurface,
    border: colors.successBorder,
  },
  unsafe: {
    label: "Flagged",
    icon: "alert-circle" as const,
    tint: colors.dangerText,
    surface: colors.dangerSurface,
    border: colors.dangerBorder,
  },
  unknown: {
    label: "Unverified",
    icon: "help-circle" as const,
    tint: colors.warningText,
    surface: colors.warningSurface,
    border: colors.warningBorder,
  },
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function HistoryScreen() {
  const router = useRouter();

  const entries = MOCK_HISTORY;

  const renderItem = ({ item }: { item: ScanHistoryEntry }) => {
    const meta = STATUS_META[item.status];

    return (
      <View style={styles.card}>
        <View
          style={[
            styles.statusStripe,
            { backgroundColor: meta.tint },
          ]}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.medicineName} numberOfLines={1}>
              {item.name}
              {item.dose ? (
                <Text style={styles.dose}>{`  ${item.dose}`}</Text>
              ) : null}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: meta.surface, borderColor: meta.border },
              ]}
            >
              <Ionicons name={meta.icon} size={12} color={meta.tint} />
              <Text style={[styles.badgeText, { color: meta.tint }]}>
                {meta.label}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name="barcode-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.metaText}>{item.batchNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.metaText}>{formatDate(item.scannedAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="History"
        subtitle={`${entries.length} ${entries.length === 1 ? "scan" : "scans"} on record`}
      />

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="time-outline"
                size={32}
                color={colors.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyBody}>
              Medicines you verify will show up here so you can look them up
              later.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/scan")}
              style={styles.emptyAction}
            >
              <Text style={styles.emptyActionText}>Scan a medicine</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.xl, flexGrow: 1 },

  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  statusStripe: { width: 4 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  medicineName: {
    ...typography.heading,
    fontSize: 16,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.md,
  },
  dose: { ...typography.caption, color: colors.textMuted, fontWeight: "500" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    marginLeft: 4,
    fontWeight: "700",
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...typography.title, color: colors.text },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  emptyAction: { marginTop: spacing.lg, padding: spacing.md },
  emptyActionText: { ...typography.heading, fontSize: 15, color: colors.primary },
});
