import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../auth/supabase';
import { Database, type Tables } from '../../../../../database.types';

function formatMarketCap(value: number | null | undefined): string {
  if (!value && value !== 0) return '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

type Symbols = Database['public']['Tables']['symbols']['Row'][]

export default function SymbolsList() {
  const [symbols, setSymbols] = useState<Symbols>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('symbols')
      .select('*')
      .order('marketCapitalization', { ascending: false, nullsFirst: false })
      .limit(500)
      .returns<Symbols>();
    if (error) {
      setError(error.message);
    } else {
      setSymbols(data ?? []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading symbols…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load symbols</Text>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }


  return (
    <FlatList
      data={symbols}
      keyExtractor={(item) => item.symbol}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.row}>
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]} />
          )}
          <View style={styles.meta}>
            <View style={styles.titleLine}>
              <Text style={styles.symbol}>{item.company_name}</Text>
              <View style={styles.priceBlock}>
                {typeof item.current_price === 'number' && (
                  <Text style={styles.price}>${item.current_price.toFixed(2)}</Text>
                )}
                {typeof item.day_change_pct === 'number' && (
                  <Text
                    style={[
                      styles.change,
                      item.day_change_pct * 100 > 0
                        ? styles.positive
                        : item.day_change_pct * 100 < 0
                          ? styles.negative
                          : null,
                    ]}
                  >
                    {item.day_change_pct * 100 > 0 ? '+' : ''}
                    {(item.day_change_pct * 100).toFixed(2)}%
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.company} numberOfLines={1}>
              {item.symbol}
            </Text>
            {item.marketCapitalization != null && (
              <Text style={styles.marketCap}>Mkt Cap {formatMarketCap(item.marketCapitalization)}</Text>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    marginLeft: 12,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  company: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  change: {
    fontSize: 12,
  },
  positive: {
    color: '#059669',
  },
  negative: {
    color: '#dc2626',
  },
  marketCap: {
    fontSize: 12,
    color: '#374151',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    marginTop: 8,
    color: '#6b7280',
  },
  error: {
    color: '#dc2626',
    fontWeight: '600',
  },
});
