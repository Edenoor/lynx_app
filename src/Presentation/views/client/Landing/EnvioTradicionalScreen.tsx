import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  TextInput, Pressable, KeyboardAvoidingView, Platform, Keyboard, ScrollView, TouchableWithoutFeedback
} from 'react-native';
import Constants from 'expo-constants';
import global from '../../../theme/global';
import { postJson } from '../../../config/Api';
import { UserContext } from '../../../context/UserContext';

type Place = {
  address: string;        // corto: "Yerbal 4354"
  fullAddress: string;    // formatted_address completo
  lat: number;
  lng: number;
  cp?: string | null;
  localidad?: string | null;
  provincia?: string | null;
} | null;

type Suggestion = { description: string; place_id: string };

const DEBOUNCE_MS = 250;
const useDebounced = (value: string, delay = DEBOUNCE_MS) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

export const EnvioTradicionalScreen = () => {
  const { user } = useContext(UserContext) as any;
  const username = user?.username || user?.email || 'lithium';

  const GOOGLE_KEY: string =
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

  const [origin, setOrigin] = useState<Place>(null);
  const [destination, setDestination] = useState<Place>(null);
  const [loading, setLoading] = useState(false);

  // inputs controlados
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');

  // flags para bloquear autocomplete al seleccionar
  const [originLocked, setOriginLocked] = useState(false);
  const [destLocked, setDestLocked] = useState(false);

  const dOrigin = useDebounced(originQuery);
  const dDest = useDebounced(destQuery);

  const [originSuggs, setOriginSuggs] = useState<Suggestion[]>([]);
  const [destSuggs, setDestSuggs] = useState<Suggestion[]>([]);
  const [loadingOriginSuggs, setLoadingOriginSuggs] = useState(false);
  const [loadingDestSuggs, setLoadingDestSuggs] = useState(false);

  const originInputRef = useRef<TextInput>(null);
  const destInputRef = useRef<TextInput>(null);

  const API_BASE_AUTOCOMPLETE =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json';
  const API_BASE_DETAILS =
    'https://maps.googleapis.com/maps/api/place/details/json';

  const countryComponent = 'country:ar';

  const fetchAutocomplete = async (text: string) => {
    const url =
      `${API_BASE_AUTOCOMPLETE}?input=${encodeURIComponent(text)}` +
      `&key=${GOOGLE_KEY}&language=es&components=${encodeURIComponent(countryComponent)}`;
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data?.predictions) ? data.predictions : [];
  };

  const fetchPlaceDetails = async (placeId: string) => {
    const url =
      `${API_BASE_DETAILS}?place_id=${encodeURIComponent(placeId)}` +
      `&key=${GOOGLE_KEY}&language=es&fields=formatted_address,geometry,address_components`;

    const res = await fetch(url);
    const data = await res.json();

    const comps: any[] = data?.result?.address_components || [];
    const get = (type: string) => comps.find(c => (c.types || []).includes(type));

    const route = get('route')?.long_name ?? '';
    const number = get('street_number')?.long_name ?? '';
    const locality = get('locality')?.long_name
                  ?? get('sublocality')?.long_name
                  ?? get('administrative_area_level_2')?.long_name
                  ?? null;
    const admin1 = get('administrative_area_level_1')?.long_name ?? null;
    const postal = get('postal_code')?.long_name ?? null;

    const loc = data?.result?.geometry?.location;
    const formatted = data?.result?.formatted_address || '';

    if (!loc?.lat || !loc?.lng) throw new Error('No se pudo obtener lat/lng');

    const short = [route, number].filter(Boolean).join(' ').trim(); // "Yerbal 4354"

    return {
      address: short || formatted,
      fullAddress: formatted,
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      cp: postal,
      localidad: locality,
      provincia: admin1,
    } as NonNullable<Place>;
  };

  // Autocomplete ORIGEN
  useEffect(() => {
    let canceled = false;
    const run = async () => {
      if (originLocked || !GOOGLE_KEY || !dOrigin || dOrigin.length < 3) {
        setOriginSuggs([]);
        return;
      }
      try {
        setLoadingOriginSuggs(true);
        const preds = await fetchAutocomplete(dOrigin);
        if (!canceled) {
          setOriginSuggs(preds.map((p: any) => ({ description: p.description, place_id: p.place_id })));
        }
      } catch {
        if (!canceled) setOriginSuggs([]);
      } finally {
        if (!canceled) setLoadingOriginSuggs(false);
      }
    };
    run();
    return () => { canceled = true; };
  }, [dOrigin, GOOGLE_KEY, originLocked]);

  // Autocomplete DESTINO
  useEffect(() => {
    let canceled = false;
    const run = async () => {
      if (destLocked || !GOOGLE_KEY || !dDest || dDest.length < 3) {
        setDestSuggs([]);
        return;
      }
      try {
        setLoadingDestSuggs(true);
        const preds = await fetchAutocomplete(dDest);
        if (!canceled) {
          setDestSuggs(preds.map((p: any) => ({ description: p.description, place_id: p.place_id })));
        }
      } catch {
        if (!canceled) setDestSuggs([]);
      } finally {
        if (!canceled) setLoadingDestSuggs(false);
      }
    };
    run();
    return () => { canceled = true; };
  }, [dDest, GOOGLE_KEY, destLocked]);

  const selectOrigin = async (s: Suggestion) => {
    try {
      const place = await fetchPlaceDetails(s.place_id);
      setOrigin(place);
      setOriginQuery(place.address);
      setOriginSuggs([]);
      setOriginLocked(true);
      originInputRef.current?.blur();
      setTimeout(() => destInputRef.current?.focus(), 50);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo obtener el origen');
    }
  };

  const selectDestination = async (s: Suggestion) => {
    try {
      const place = await fetchPlaceDetails(s.place_id);
      setDestination(place);
      setDestQuery(place.address);
      setDestSuggs([]);
      setDestLocked(true);
      destInputRef.current?.blur();
      Keyboard.dismiss();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo obtener el destino');
    }
  };

  const handleSubmit = async () => {
    if (!GOOGLE_KEY) {
      Alert.alert('Falta Google Key', 'Configura EXPO_PUBLIC_GOOGLE_MAPS_KEY y reiniciá (expo start -c).');
      return;
    }
    if (!origin || !destination) {
      Alert.alert('Faltan datos', 'Completá origen y destino.');
      return;
    }
    setLoading(true);
    try {
      const res = await postJson('/v1/delivery/envios/tradicional', {
        username,
        clienteNombre: user?.nombre_fantasia || user?.username || user?.email || username, // nombre visible del cliente
        origin,                         // address corta/full + lat/lng
        destination,                    // idem + cp/localidad/provincia
        contactName: '',
        contactPhone: '',
        notes: '',
        size: 'M',
      });
      if (!res?.ok) throw new Error(res?.error || 'No se pudo crear el envío');

      Alert.alert('Listo', `Envío creado: ${res.numero_tracking}`);
      // reset
      setOrigin(null); setDestination(null);
      setOriginQuery(''); setDestQuery('');
      setOriginLocked(false); setDestLocked(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo crear el envío');
    } finally {
      setLoading(false);
    }
  };

  const SuggestionList = ({
    items,
    onSelect,
    visible,
  }: {
    items: Suggestion[];
    onSelect: (s: Suggestion) => void;
    visible: boolean;
  }) => {
    if (!visible || items.length === 0) return null;
    return (
      <View style={styles.suggList}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {items.map((s) => (
            <Pressable key={s.place_id} onPress={() => onSelect(s)} style={styles.suggRow}>
              <Text style={styles.suggText}>{s.description}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={styles.title}>Nuevo Envío</Text>

          {!GOOGLE_KEY ? (
            <View style={styles.warning}>
              <Text style={styles.warningText}>
                Falta configurar EXPO_PUBLIC_GOOGLE_MAPS_KEY. Editá .env y reiniciá con "expo start -c".
              </Text>
            </View>
          ) : null}

          {/* ORIGEN */}
          <Text style={styles.label}>Dirección de origen</Text>
          <TextInput
            ref={originInputRef}
            value={originQuery}
            onFocus={() => setOriginLocked(false)}
            onChangeText={(t) => { setOriginQuery(t); setOrigin(null); }}
            placeholder="Ingresá la dirección de origen"
            style={styles.input}
            returnKeyType="next"
            autoCapitalize="words"
          />
          {loadingOriginSuggs ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
          <SuggestionList
            items={originSuggs}
            onSelect={selectOrigin}
            visible={!originLocked}
          />

          {/* DESTINO */}
          <Text style={styles.label}>Dirección de destino</Text>
          <TextInput
            ref={destInputRef}
            value={destQuery}
            onFocus={() => setDestLocked(false)}
            onChangeText={(t) => { setDestQuery(t); setDestination(null); }}
            placeholder="Ingresá la dirección de destino"
            style={styles.input}
            returnKeyType="done"
            autoCapitalize="words"
          />
          {loadingDestSuggs ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
          <SuggestionList
            items={destSuggs}
            onSelect={selectDestination}
            visible={!destLocked}
          />

          <TouchableOpacity
            style={[styles.button, (loading || !origin || !destination) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading || !origin || !destination}
          >
            {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>Confirmar envío</Text>}
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: global.COLORS.background, padding: 20, justifyContent: 'center' },
  title: { fontSize: global.FONT.size.xl, fontWeight: 'bold', color: global.COLORS.text, marginBottom: 20, textAlign: 'center' },
  label: { color: global.COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: global.COLORS.gray,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: global.BORDER_RADIUS.md,
    backgroundColor: global.COLORS.white,
    marginBottom: 8,
  },
  suggList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: global.COLORS.gray,
    borderRadius: global.BORDER_RADIUS.md,
    backgroundColor: global.COLORS.white,
    marginBottom: 12,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 3,
  },
  suggRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  suggText: { color: global.COLORS.text },
  button: { backgroundColor: global.COLORS.primary, padding: 15, borderRadius: global.BORDER_RADIUS.md, marginTop: 8 },
  buttonText: { textAlign: 'center', fontWeight: 'bold', color: global.COLORS.text },
  warning: { padding: 12, borderRadius: 8, backgroundColor: '#fff4cc', marginBottom: 12 },
  warningText: { color: '#7a5a00' },
});
