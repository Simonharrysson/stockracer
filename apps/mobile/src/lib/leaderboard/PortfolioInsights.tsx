import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { Card, StateNotice } from "../ui/components";
import { palette, radii, spacing } from "../ui/theme";
import type { SymbolInsight } from "./api";
import { fetchSymbolInsights } from "./api";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatMarketCap(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  // Finnhub's profile endpoint returns marketCapitalization in millions of USD,
  // so convert to an absolute dollar amount before formatting for display.
  const normalized = value * 1_000_000;

  const units = [
    { value: 1_000_000_000_000, suffix: "T" },
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "K" },
  ];
  for (const unit of units) {
    if (normalized >= unit.value) {
      return `${(normalized / unit.value).toFixed(2)}${unit.suffix}`;
    }
  }
  return currencyFormatter.format(normalized);
}

function formatPrice(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return currencyFormatter.format(value);
}

export default function PortfolioInsights() {
  const route = useRoute<RouteProp<RootStackParamList, "PortfolioInsights">>();
  const { username, symbols } = route.params;
  const [insights, setInsights] = useState<SymbolInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedSymbols = useMemo(() => {
    return symbols.filter((symbol) => !!symbol?.trim());
  }, [symbols]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchSymbolInsights(normalizedSymbols);
        if (!isMounted) return;
        setInsights(data);
      } catch (err) {
        if (!isMounted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load symbol insights";
        setError(message);
        setInsights([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [normalizedSymbols]);

  const heading = `${username}'s deeper insights`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.subheading}>Company-by-company breakdown</Text>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.accentBlueSoft} />
          <Text style={styles.loadingLabel}>Gathering quotes…</Text>
        </View>
      ) : error ? (
        <StateNotice tone="error" title="Unable to load" message={error} />
      ) : insights.length === 0 ? (
        <StateNotice
          tone="muted"
          title="No picks to analyze"
          message="Draft picks will appear here with market cap, logos, and live prices."
        />
      ) : (
        insights.map((insight) => (
          <Card key={insight.symbol} tone="raised" style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.logoWrapper}>
                {insight.logo ? (
                  <Image
                    source={{ uri: insight.logo }}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.logoFallback}>
                    <Text style={styles.logoFallbackText}>
                      {insight.symbol.slice(0, 1)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.companyMeta}>
                <Text style={styles.companyName}>{insight.companyName}</Text>
                <Text style={styles.companySymbol}>{insight.symbol}</Text>
              </View>
              <Text style={styles.price}>{formatPrice(insight.price)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Market cap</Text>
              <Text style={styles.metaValue}>
                {formatMarketCap(insight.marketCap)}
              </Text>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    color: palette.textPrimary,
  },
  subheading: {
    color: palette.textSecondary,
    marginBottom: spacing.sm,
  },
  loading: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  loadingLabel: {
    color: palette.textSecondary,
  },
  insightCard: {
    gap: spacing.md,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: 48,
    height: 48,
  },
  logoFallback: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: {
    color: palette.textSecondary,
    fontWeight: "700",
    fontSize: 18,
  },
  companyMeta: {
    flex: 1,
  },
  companyName: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  companySymbol: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  price: {
    color: palette.textPrimary,
    fontSize: 32,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  metaValue: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
});
