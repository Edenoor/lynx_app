import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useNotifications, Noti } from '../../context/NotificationContext';
import global from '../../theme/global';

const kindLabel: Record<Noti['kind'], string> = {
  NEW_TRAD: 'Nuevo envío',
  TRAD_ACCEPTED: 'Envío aceptado',
  INFO: 'Info',
  ALERT: 'Alerta',
};

const formatDate = (ts: number) => {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
};

const Item: React.FC<{
  item: Noti;
  onPress: () => void;
}> = ({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.itemRow}>
        <Text style={styles.itemKind}>{kindLabel[item.kind] ?? 'Notificación'}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      <Text style={styles.itemTitle} numberOfLines={1}>
        {item.title}
      </Text>
      {!!item.body && (
        <Text style={styles.itemBody} numberOfLines={2}>
          {item.body}
        </Text>
      )}
      <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );
};

const NotificationsScreen: React.FC = () => {
  const { items, markRead, markAllRead, remove, clear } = useNotifications();
  const [selected, setSelected] = useState<Noti | null>(null);

  const data = useMemo(
    () => items.sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  return (
    <View style={styles.container}>
      {/* Header simple */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.headerAction}>Marcar todas leídas</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clear}>
            <Text style={styles.headerAction}>Vaciar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ padding: global.SPACING.md }}
        data={data}
        keyExtractor={(it) => it.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Item
            item={item}
            onPress={() => {
              setSelected(item);
              if (!item.read) markRead(item.id);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTxt}>No tenés notificaciones aún.</Text>
          </View>
        }
      />

      {/* Modal de detalle */}
      <Modal
        transparent
        visible={!!selected}
        onRequestClose={() => setSelected(null)}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalKind}>
              {selected ? kindLabel[selected.kind] : ''}
            </Text>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            {!!selected?.body && <Text style={styles.modalBody}>{selected?.body}</Text>}
            {!!selected?.data && (
              <Text style={styles.modalData}>
                {JSON.stringify(selected?.data, null, 2)}
              </Text>
            )}

            <View style={styles.modalFooter}>
              {!!selected && (
                <Pressable
                  style={[styles.btn, styles.btnDanger]}
                  onPress={() => {
                    remove(selected.id);
                    setSelected(null);
                  }}
                >
                  <Text style={styles.btnTxt}>Eliminar</Text>
                </Pressable>
              )}
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => setSelected(null)}>
                <Text style={styles.btnTxt}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
  },
  header: {
    paddingTop: global.SIZES.statusBarHeight + 8,
    paddingHorizontal: global.SPACING.md,
    paddingBottom: global.SPACING.sm,
    backgroundColor: global.COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitle: {
    fontSize: global.FONT.size.lg,
    fontWeight: '700',
    color: global.COLORS.text,
  },
  headerAction: {
    color: global.COLORS.blue,
    fontWeight: '600',
  },
  item: {
    backgroundColor: global.COLORS.white,
    borderRadius: 12,
    padding: global.SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6e6e6',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  itemKind: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: global.COLORS.text,
  },
  itemBody: {
    marginTop: 2,
    fontSize: 14,
    color: '#475569',
  },
  itemDate: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTxt: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: global.COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  modalKind: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: global.COLORS.text,
  },
  modalBody: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569',
  },
  modalData: {
    marginTop: 12,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#334155',
  },
  modalFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: '#7A40F2',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
  },
  btnTxt: {
    color: '#fff',
    fontWeight: '700',
  },
});
