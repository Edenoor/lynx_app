import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import useEnviosViewModel from './ViewModel';
import global from '../../../theme/global';

/** ===== Types ===== */
type Envio = {
  numero_tracking: string | null;
  fecha_colecta: string | null;
  fecha_estado: string | null;
  nombre_fantasia: string | null;
  direccion: string | null;
  cp: string | null;
  estado: string | null;
  cadete: string | null;
  total: string | null;
  zona: string | null;
  precio_cliente: string | null;
  descuento: number;
  metodo_envio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
};

/** ===== Helpers ===== */
const fmtMoney = (v: any) => {
  const n = Number(v || 0);
  if (Number.isNaN(n)) return '$0';
  return `$${n.toLocaleString('es-AR')}`;
};
const tryParseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const trimmed = String(s).trim();
  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) return iso;
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]) - 1, y = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    const dt = new Date(y, mo, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const statusColor = (estado?: string | null, cadete?: string | null) => {
  if (!cadete) return '#c62828';
  const s = (estado || '').toLowerCase();
  if (s.includes('entregado')) return '#16a34a';
  if (s.includes('retirado') || s.includes('en camino') || s.includes('transit')) return '#0ea5e9';
  if (s.includes('solicitado') || s.includes('creado') || s.includes('pendiente')) return '#f59e0b';
  if (s.includes('cancel')) return '#ef4444';
  return '#64748b';
};
const statusLabel = (estado?: string | null, cadete?: string | null) => {
  if (!cadete) return 'Sin asignar';
  const s = (estado || '').toLowerCase();
  if (s.includes('entregado')) return 'Entregado';
  if (s.includes('retirado') || s.includes('en camino') || s.includes('transit')) return 'En camino';
  if (s.includes('solicitado') || s.includes('creado') || s.includes('pendiente')) return 'A retirar';
  return estado || 'Estado';
};

const fmtDate = (d?: Date | null) => {
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};
const metodoLabel = (m?: string | null) => {
  const s = (m || '').toLowerCase();
  if (s === 'tradicional') return 'Tradicional';
  if (s === 'turbo') return 'Turbo';
  return s ? s[0].toUpperCase() + s.slice(1) : '—';
};

/** Zona “inteligente”: tolera null/undefined */
const zoneText = (it?: Envio | null) => {
  if (!it) return '—';
  const loc = (it.localidad || '').toLowerCase();
  const isCaba =
    loc.includes('ciudad autónoma') ||
    loc.includes('caba') ||
    loc.includes('cdad. autónoma');
  if (isCaba) return 'CABA';
  if (it.localidad) return it.localidad;
  if (it.provincia) return it.provincia;
  return it.zona ? `Zona ${it.zona}` : '—';
};

/** On demand vs Flex */
const isOnDemand = (m?: string | null) =>
  ['tradicional', 'turbo'].includes((m || '').toLowerCase());

/** ===== Screen ===== */
export const EnviosScreen = () => {
  const { list, loading, error, reload } = useEnviosViewModel();
  const rows = list as Envio[];

  const [refreshing, setRefreshing] = useState(false);

  // filtros
  const [quickToday, setQuickToday] = useState<boolean>(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [picker, setPicker] = useState<null | 'FROM' | 'TO'>(null);

  // tabs: On demand / Flex
  const [tab, setTab] = useState<'ondemand' | 'flex'>('ondemand');

  // modales
  const [selected, setSelected] = useState<Envio | null>(null);
  const [showTotals, setShowTotals] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const filtered = useMemo(() => {
    // por fecha
    const base = rows.filter(r => {
      const d = tryParseDate(r.fecha_estado) || tryParseDate(r.fecha_colecta);
      if (from && to) {
        if (!d) return false;
        const f = startOfDay(from), t = endOfDay(to);
        return d >= f && d <= t;
      }
      if (quickToday) {
        if (!d) return false;
        const now = new Date();
        return d >= startOfDay(now) && d <= endOfDay(now);
      }
      return true;
    });

    // por tab
    if (tab === 'ondemand') return base.filter(r => isOnDemand(r.metodo_envio));
    return base.filter(r => !isOnDemand(r.metodo_envio));
  }, [rows, quickToday, from, to, tab]);

  const visibleTotals = useMemo(() => {
    const monto = filtered.reduce((acc, it) => acc + Number(it.precio_cliente || 0), 0);
    const desc = filtered.reduce((acc, it) => acc + Number(it.precio_cliente || 0) * Number(it.descuento || 0), 0);
    return { totalEnvios: filtered.length, montoTotal: monto, netoFinal: monto - desc };
  }, [filtered]);

  if (loading && rows.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Detalle</Text>

        {/* Tabs On demand / Flex */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 }}>
          <Pressable
            onPress={() => setTab('ondemand')}
            style={[styles.tabBtn, tab === 'ondemand' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'ondemand' && styles.tabTextActive]}>
              On demand
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('flex')}
            style={[styles.tabBtn, tab === 'flex' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'flex' && styles.tabTextActive]}>
              Flex
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.totalCard} onPress={() => setShowTotals(true)}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{fmtMoney(visibleTotals.netoFinal)}</Text>
        </Pressable>

        <View style={styles.filtersBox}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => { setQuickToday(true); setFrom(null); setTo(null); }}
              style={[styles.chip, quickToday && !from && !to && styles.chipActive]}
            >
              <Text style={[styles.chipText, quickToday && !from && !to && styles.chipTextActive]}>Hoy</Text>
            </Pressable>

            <Pressable onPress={() => setCalendarOpen(true)} style={[styles.chip, (from && to) && styles.chipActive]}>
              <Text style={[styles.chipText, (from && to) && styles.chipTextActive]}>
                {(from && to) ? `${fmtDate(from)} → ${fmtDate(to)}` : 'Fecha'}
              </Text>
            </Pressable>

            {(quickToday || (from && to)) && (
              <Pressable
                onPress={() => { setQuickToday(false); setFrom(null); setTo(null); }}
                style={[styles.chip, styles.chipClear]}
              >
                <Text style={[styles.chipText, styles.chipTextClear]}>Limpiar</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

        {!!error && <Text style={styles.errorText}>⚠️ {error}</Text>}
      </View>

      {/* Lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item, i) => `${item.numero_tracking ?? 'nt'}-${i}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const color = statusColor(item.estado, item.cadete);
          const label = statusLabel(item.estado, item.cadete);

          return (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.9}>
              <View style={styles.cardRow}>
                {/* Columna izquierda */}
                <View style={styles.leftCol}>
                  <Text style={styles.clientTiny} numberOfLines={1}>
                    {(item.nombre_fantasia && item.nombre_fantasia.trim()) ? item.nombre_fantasia : 'Cliente'}
                  </Text>
                  <Text style={styles.tracking}>{item.numero_tracking ?? '—'}</Text>
                  <Text style={styles.address} numberOfLines={2}>
                    {item.direccion ? item.direccion : '—'}
                    {item.cp ? ` (${item.cp})` : ''}
                  </Text>
                  {(item.localidad || item.provincia || item.zona) && (
                    <Text style={styles.zone} numberOfLines={1}>{zoneText(item)}</Text>
                  )}
                </View>

                {/* Columna derecha */}
                <View style={styles.rightCol}>
                  <View style={[styles.statusPill, { backgroundColor: color }]}>
                    <Text style={styles.statusPillText}>{label}</Text>
                  </View>
                  <Text style={styles.priceBig}>{fmtMoney(item.precio_cliente)}</Text>
                  {!!item.metodo_envio && (
                    <View style={styles.methodBadge}>
                      <Text style={styles.methodBadgeText}>{metodoLabel(item.metodo_envio)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centerPad}>
            <Text style={styles.emptyText}>No hay envíos para mostrar</Text>
          </View>
        }
      />

      {/* Modal detalle */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del envío</Text>
              <Pressable onPress={() => setSelected(null)}><Text style={styles.close}>✕</Text></Pressable>
            </View>
            <View style={styles.modalBody}>
              <Row label="Tracking" value={selected?.numero_tracking ?? '—'} />
              <Row label="Cliente" value={selected?.nombre_fantasia ?? '—'} />
              <Row label="Tipo" value={metodoLabel(selected?.metodo_envio)} />
              <Row label="Estado" value={statusLabel(selected?.estado, selected?.cadete)} />
              <Row label="Dirección" value={`${selected?.direccion || ''}${selected?.cp ? ` (${selected?.cp})` : ''}`} />
              <Row label="Zona" value={zoneText(selected)} />
              <Row label="Cadete" value={selected?.cadete ?? '—'} />
              <Row label="Precio cliente" value={fmtMoney(selected?.precio_cliente)} />
              <Row label="Colecta" value={selected?.fecha_colecta ?? '—'} />
              <Row label="Últ. estado" value={selected?.fecha_estado ?? '—'} />
            </View>
            <Pressable style={styles.primaryBtn} onPress={() => setSelected(null)}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal totales */}
      <Modal visible={showTotals} transparent animationType="fade" onRequestClose={() => setShowTotals(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowTotals(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Totales</Text>
              <Pressable onPress={() => setShowTotals(false)}><Text style={styles.close}>✕</Text></Pressable>
            </View>
            <View style={styles.modalBody}>
              <Row label="Envíos" value={String(visibleTotals.totalEnvios)} />
              <Row label="Monto" value={fmtMoney(visibleTotals.montoTotal)} />
              <Row label="Neto" value={fmtMoney(visibleTotals.netoFinal)} />
            </View>
            <Pressable style={styles.primaryBtn} onPress={() => setShowTotals(false)}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal calendario */}
      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar rango</Text>
              <Pressable onPress={() => setCalendarOpen(false)}><Text style={styles.close}>✕</Text></Pressable>
            </View>

            <View style={[styles.modalBody, { gap: 12 }]}>
              <Pressable style={styles.dateBtn} onPress={() => setPicker('FROM')}>
                <Text style={styles.dateBtnText}>Desde: {fmtDate(from)}</Text>
              </Pressable>
              {picker === 'FROM' && (
                <DateTimePicker
                  value={from || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => { setPicker(null); if (d) setFrom(d); }}
                />
              )}
              <Pressable style={styles.dateBtn} onPress={() => setPicker('TO')}>
                <Text style={styles.dateBtnText}>Hasta: {fmtDate(to)}</Text>
              </Pressable>
              {picker === 'TO' && (
                <DateTimePicker
                  value={to || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => { setPicker(null); if (d) setTo(d); }}
                />
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={() => { setQuickToday(false); setCalendarOpen(false); }}
              >
                <Text style={styles.primaryBtnText}>Aplicar</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtnFull, { flex: 1 }]}
                onPress={() => { setFrom(null); setTo(null); setCalendarOpen(false); }}
              >
                <Text style={styles.secondaryBtnText}>Limpiar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

/** ===== Mini components ===== */
const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.rowLine}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={3}>{value ?? '—'}</Text>
  </View>
);

/** ===== Styles ===== */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: global.COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { padding: 24, alignItems: 'center' },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  title: { color: global.COLORS.text, fontSize: global.FONT?.size?.lg ?? 20, fontWeight: '800', marginBottom: 10 },

  // Tabs
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: global.COLORS.white,
  },
  tabBtnActive: {
    backgroundColor: global.COLORS.blue,
    borderColor: global.COLORS.blue,
  },
  tabText: { color: global.COLORS.text, fontWeight: '700' },
  tabTextActive: { color: global.COLORS.white, fontWeight: '800' },

  totalCard: {
    backgroundColor: global.COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
    marginBottom: 12,
  },
  totalLabel: { color: global.COLORS.gray, fontSize: global.FONT?.size?.sm ?? 12, marginBottom: 4 },
  totalValue: { color: global.COLORS.text, fontSize: global.FONT?.size?.xl ?? 22, fontWeight: '800' },

  filtersBox: { paddingHorizontal: 16, paddingVertical: 8 },

  chip: {
    borderWidth: 1, borderColor: '#DDD',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 9999, backgroundColor: global.COLORS.background,
  },
  chipActive: { backgroundColor: global.COLORS.blue, borderColor: global.COLORS.blue },
  chipText: { color: global.COLORS.text, fontSize: global.FONT?.size?.sm ?? 12, fontWeight: '600' },
  chipTextActive: { color: global.COLORS.white },
  chipClear: { backgroundColor: global.COLORS.white, borderColor: '#DDD' },
  chipTextClear: { color: global.COLORS.blue, fontWeight: '700' },

  errorText: { color: '#ef4444', marginHorizontal: 16, marginTop: 4 },

  card: {
    backgroundColor: global.COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leftCol: { flex: 1, paddingRight: 12 },
  rightCol: { alignItems: 'flex-end', gap: 6, minWidth: 110 },

  clientTiny: { color: global.COLORS.gray, fontSize: global.FONT?.size?.xs ?? 11, marginBottom: 2 },
  tracking: { color: global.COLORS.text, fontWeight: '800', fontSize: 15, marginBottom: 6 },
  address: { color: global.COLORS.text, fontSize: global.FONT?.size?.md ?? 13, lineHeight: 18 },
  zone: { color: global.COLORS.gray, marginTop: 6, fontSize: global.FONT?.size?.sm ?? 12 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusPillText: { color: global.COLORS.white, fontWeight: '800', fontSize: 11 },
  priceBig: { color: global.COLORS.text, fontSize: global.FONT?.size?.md ?? 14, fontWeight: '800' },

  methodBadge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#EEE' },
  methodBadgeText: { fontSize: 11, fontWeight: '700', color: global.COLORS.text },

  backdrop: { flex: 1, backgroundColor: '#00000055', padding: 20, justifyContent: 'center' },
  modalCard: { backgroundColor: global.COLORS.white, borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E6E6E6' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: global.COLORS.text, fontSize: global.FONT?.size?.md ?? 16, fontWeight: '800' },
  close: { color: global.COLORS.gray, fontSize: 18 },
  modalBody: { gap: 10, marginBottom: 12 },

  rowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowLabel: { width: 120, color: global.COLORS.gray, fontSize: global.FONT?.size?.sm ?? 12, textTransform: 'uppercase' },
  rowValue: { flex: 1, color: global.COLORS.text, fontSize: global.FONT?.size?.md ?? 13 },

  primaryBtn: { backgroundColor: global.COLORS.blue, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: global.COLORS.white, fontWeight: '800' },

  secondaryBtnFull: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: global.COLORS.background,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  secondaryBtnText: { color: global.COLORS.text, fontWeight: '600' },

  dateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: global.COLORS.background,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    alignItems: 'center',
  },
  dateBtnText: { color: global.COLORS.text, fontWeight: '600' },

  emptyText: { color: global.COLORS.gray },
});
