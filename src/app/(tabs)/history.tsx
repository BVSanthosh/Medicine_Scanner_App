import { FlatList, StyleSheet, Text, View } from "react-native";

// In a real app, this data will be fetched from your backend database.
const MOCK_HISTORY = [
  {
    id: "1",
    name: "Paracetamol 500mg",
    date: "2026-08-14",
    safe: true,
    batch: "BATCH-12345",
  },
  {
    id: "2",
    name: "Unknown Medicine",
    date: "2026-08-13",
    safe: false,
    batch: "FAKE-999",
  },
  {
    id: "3",
    name: "Amoxicillin 250mg",
    date: "2026-08-10",
    safe: true,
    batch: "AMX-4421",
  },
];

export default function HistoryScreen() {
  // This function tells FlatList how to draw a single item in the list
  const renderHistoryCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.medicineName}>{item.name}</Text>
        {/* Dynamic Badge */}
        <View
          style={[
            styles.badge,
            item.safe ? styles.safeBadge : styles.dangerBadge,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              item.safe ? styles.safeBadgeText : styles.dangerBadgeText,
            ]}
          >
            {item.safe ? "Safe" : "Flagged"}
          </Text>
        </View>
      </View>

      <Text style={styles.cardDetails}>Batch: {item.batch}</Text>
      <Text style={styles.cardDate}>Scanned on: {item.date}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header (No back button needed in a Tab screen) */}
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
      </View>

      {/* The List Component */}
      <FlatList
        data={MOCK_HISTORY}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60, // Added top padding to account for the physical phone notch
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 28, // Made slightly larger to act as a proper screen header
    fontWeight: "bold",
    color: "#0f172a",
  },
  listContent: {
    padding: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  safeBadge: { backgroundColor: "#dcfce7" },
  dangerBadge: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  safeBadgeText: { color: "#15803d" },
  dangerBadgeText: { color: "#b91c1c" },
  cardDetails: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
});
