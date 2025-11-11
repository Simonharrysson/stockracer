import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions, // Import Dimensions to get screen width
} from 'react-native';
import { supabase } from '../auth/supabase';
import { Database } from '../../../../../database.types';
import { LineChart } from 'react-native-chart-kit'; // Import the chart

// Use the generated type
type Portfolio = Database["public"]["Views"]["portfolios"]["Row"];
// Type for our history data
type HistoryPoint = Database["public"]["Tables"]["investment_history"]["Row"];

// --- Helper Functions (now null-safe) ---
function formatCurrency(value: number | null | undefined): string {
  const val = value ?? 0;
  return val.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function formatChange(
  value: number | null | undefined,
  isPercent: boolean = false,
): string {
  const val = value ?? 0;
  const sign = val > 0 ? '+' : '';
  const formatted = isPercent ? (val * 100).toFixed(2) : val.toFixed(2);
  const suffix = isPercent ? '%' : '';
  return `${sign}${formatted}${suffix}`;
}

function getChangeStyle(value: number | null | undefined) {
  const val = value ?? 0;
  if (val > 0) return styles.positive;
  if (val < 0) return styles.negative;
  return styles.neutral;
}

// Get screen width for the chart
const screenWidth = Dimensions.get('window').width;

// --- Component ---
export default function PortfolioScreen() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]); // State for history
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    setError(null);

    // Fetch portfolio and history in parallel
    const [portfolioRes, historyRes] = await Promise.all([
      supabase.from('portfolios').select('*').single(),
      supabase
        .from('investment_history')
        .select('*')
        .order('snapshot_date', { ascending: true })
        .limit(30), // Get the last 30 days
    ]);

    // Handle portfolio data
    if (portfolioRes.error && portfolioRes.error.code !== 'PGRST116') {
      setError(portfolioRes.error.message);
      setPortfolio(null);
    } else if (portfolioRes.data) {
      console.log(portfolioRes.data)
      setPortfolio(portfolioRes.data as Portfolio);
    } else {
      setPortfolio(null);
    }

    // Handle history datar
    if (historyRes.error) {
      setError(historyRes.error.message);
      console.error(historyRes.error.message)
      setHistory([]);
    } else if (historyRes.data) {
      setHistory(historyRes.data);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadPortfolio();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPortfolio]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPortfolio();
    } finally {
      setRefreshing(false);
    }
  }, [loadPortfolio]);

  // Format data for the chart
  const formatChartData = () => {
    if (history.length === 0) {
      // Return default data to prevent chart crash
      return {
        labels: [''],
        datasets: [{ data: [0] }],
      };
    }

    // Format labels to be readable (e.g., "11/10")
    const labels = history.map((p) => {
      const date = new Date(p.snapshot_date);
      return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
    });

    const data = history.map((p) => p.total_worth ?? 0);

    // Ensure we have at least 2 labels for the chart to render properly
    if (labels.length === 1) {
      labels.unshift('');
      data.unshift(data[0]);
    }

    return {
      labels: labels,
      datasets: [
        {
          data: data,
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`, // Green
          strokeWidth: 2,
        },
      ],
    };
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading portfolio…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load portfolio</Text>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }

  // Safe calculations
  const totalWorth = portfolio?.total_worth ?? 0;
  const lastChangePct = portfolio?.last_change_pct ?? 0;
  const unrealizedPnl = portfolio?.unrealized_pnl ?? 0;
  const totalChangePct = portfolio?.total_change_pct ?? 0;
  const totalInvested = portfolio?.total_invested ?? 0;
  const positionCount = portfolio?.position_count ?? 0;
  const tickers = portfolio?.tickers ?? [];

  const lastChangeDollars =
    lastChangePct === 0
      ? 0
      : totalWorth - totalWorth / (1 + lastChangePct);


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.headerTitle}>My Portfolio</Text>

      {/* --- Main Value Card --- */}
      <View style={styles.valueCard}>
        <Text style={styles.totalWorth}>{formatCurrency(totalWorth)}</Text>
        <Text style={[styles.changeLarge, getChangeStyle(lastChangeDollars)]}>
          {formatChange(lastChangeDollars)} ({formatChange(lastChangePct, true)})
          Today
        </Text>
      </View>

      {/* --- Chart Card --- */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Performance (30d)</Text>
        {history.length > 0 ? (
          <LineChart
            data={formatChartData()}
            width={screenWidth - 72} // Screen width - (padding * 2) - (card padding * 2)
            height={220}
            withDots={true}
            withInnerLines={false}
            withOuterLines={false}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            chartConfig={chartConfig}
            bezier // Makes it a smooth curve
            style={styles.chart}
          />
        ) : (
          <Text style={styles.muted}>
            Not enough history to display a chart. Check back tomorrow.
          </Text>
        )}
      </View>

      {/* --- Details Card --- */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Details</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total P/L</Text>
          <Text style={[styles.statValue, getChangeStyle(unrealizedPnl)]}>
            {formatChange(unrealizedPnl)} ({formatChange(totalChangePct, true)})
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Invested</Text>
          <Text style={styles.statValue}>
            {formatCurrency(totalInvested)}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Positions</Text>
          <Text style={styles.statValue}>{positionCount}</Text>
        </View>
      </View>

      {/* --- Tickers List --- */}
      <View style={styles.tickersContainer}>
        <Text style={styles.tickersHeader}>My Positions</Text>
        {tickers.length > 0 ? (
          tickers.map((ticker) => (
            <View key={ticker} style={styles.tickerRow}>
              <Text style={styles.tickerSymbol}>{ticker}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>You have no open positions.</Text>
        )}
      </View>
    </ScrollView>
  );
}

// --- Chart style configuration ---
const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`, // gray-500
  strokeWidth: 2,
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#059669', // green-600
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    marginTop: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  valueCard: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  totalWorth: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
  },
  changeLarge: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  detailsCard: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 16,
    color: '#374151',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tickersContainer: {
    marginTop: 8,
  },
  tickersHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  tickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  tickerSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  positive: {
    color: '#059669',
  },
  negative: {
    color: '#dc2626',
  },
  neutral: {
    color: '#6b7280',
  },
  chart: {
    marginTop: 16,
    borderRadius: 16,
    marginLeft: -16, // Offset the chart's internal padding
  },
});