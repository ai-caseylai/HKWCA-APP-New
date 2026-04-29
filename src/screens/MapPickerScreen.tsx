import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MapPressEvent, Region } from 'react-native-maps';

import type { PickedLocation, RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MapPicker'>;

type PermissionStatus = 'unknown' | 'granted' | 'denied';

const DEFAULT_REGION: Region = {
  latitude: 22.3193,
  longitude: 114.1694,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

function regionFromLocation(loc: PickedLocation): Region {
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function MapPickerScreen({ navigation, route }: Props) {
  const mapRef = useRef<any>(null);
  const webRef = useRef<WebView | null>(null);

  const returnTo = route.params.returnTo;
  const initial = route.params.initial;

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [selected, setSelected] = useState<PickedLocation | null>(initial ?? null);
  const [isLocating, setIsLocating] = useState(false);

  const initialRegion = useMemo(() => (initial ? regionFromLocation(initial) : DEFAULT_REGION), [initial]);

  const isAndroid = Platform.OS === 'android';

  const leafletHtml = useMemo(() => {
    const startLat = selected?.latitude ?? initialRegion.latitude;
    const startLng = selected?.longitude ?? initialRegion.longitude;

    // Leaflet in a self-contained HTML string.
    // - Click to set marker
    // - PostMessage selected coordinates back to React Native
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    .hint { position: absolute; top: 10px; left: 10px; right: 10px; z-index: 9999; padding: 10px 12px; border-radius: 12px; background: rgba(17,24,39,0.85); color: #fff; font-family: -apple-system, Roboto, Arial; font-size: 13px; }
    /* 隱藏 Leaflet logo 和 attribution */
    .leaflet-control-attribution {
      display: none !important;
    }
    .leaflet-bottom.leaflet-right {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="hint">點選地圖以設定位置</div>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      var start = { lat: ${startLat}, lng: ${startLng} };
      var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([start.lat, start.lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '' }).addTo(map);

      var marker = null;
      function setMarker(lat, lng) {
        if (!marker) {
          marker = L.marker([lat, lng]).addTo(map);
        } else {
          marker.setLatLng([lat, lng]);
        }
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
        }
      }

      setMarker(start.lat, start.lng);

      map.on('click', function (e) {
        setMarker(e.latlng.lat, e.latlng.lng);
      });

      window.__setCenter = function(lat, lng) {
        map.setView([lat, lng], 16);
        setMarker(lat, lng);
      };
    })();
  </script>
</body>
</html>`;
  }, [initialRegion.latitude, initialRegion.longitude, selected?.latitude, selected?.longitude]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;

        const normalized: PermissionStatus = status === 'granted' ? 'granted' : 'denied';
        setPermissionStatus(normalized);

        if (normalized === 'granted') {
          if (!initial) {
            void locateToDevice();
          }
        }
      } catch {
        if (!isMounted) return;
        setPermissionStatus('denied');
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert('提示', '請到系統設定中開啟定位權限');
    }
  };

  const locateToDevice = async () => {
    if (permissionStatus !== 'granted') {
      Alert.alert('需要定位權限', '請允許定位權限以便自動定位到你的位置。', [
        { text: '取消', style: 'cancel' },
        { text: '去設定', onPress: () => void openSettings() },
      ]);
      return;
    }

    try {
      setIsLocating(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc: PickedLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setSelected(loc);

      if (isAndroid) {
        webRef.current?.injectJavaScript(`window.__setCenter && window.__setCenter(${loc.latitude}, ${loc.longitude}); true;`);
      } else {
        mapRef.current?.animateToRegion(regionFromLocation(loc), 600);
      }
    } catch (e: unknown) {
      Alert.alert('定位失敗', e instanceof Error ? e.message : '請稍後再試');
    } finally {
      setIsLocating(false);
    }
  };

  const onMapPress = (e: MapPressEvent) => {
    const loc: PickedLocation = {
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
    };
    setSelected(loc);
  };

  const onConfirm = () => {
    if (!selected) {
      Alert.alert('提示', '請在地圖上點選位置');
      return;
    }

    if (returnTo === 'Home' || returnTo === 'Submit') {
      navigation.navigate('Main', {
        screen: returnTo,
        params: { pickedLocation: selected },
      });
      return;
    }

    if (returnTo === 'BirdSubmit') {
      navigation.navigate('BirdSubmit', {
        pickedLocation: selected,
      });
      return;
    }

    navigation.navigate('Main', { screen: returnTo });
  };

  // Avoid rendering react-native-maps on Android (often crashes with New Architecture).
  const ReactNativeMaps: any = useMemo(() => {
    if (isAndroid) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('react-native-maps');
    } catch {
      return null;
    }
  }, [isAndroid]);

  const MapView = ReactNativeMaps?.default as any;
  const Marker = ReactNativeMaps?.Marker as any;

  return (
    <View style={styles.container}>
      {permissionStatus === 'denied' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>未取得定位權限</Text>
          <Text style={styles.bannerText}>你仍可手動點選位置；若要自動定位，請到系統設定開啟定位權限。</Text>
          <Pressable style={styles.bannerButton} onPress={openSettings}>
            <Text style={styles.bannerButtonText}>開啟設定</Text>
          </Pressable>
        </View>
      ) : null}

      {isAndroid ? (
        <WebView
          ref={(r) => {
            webRef.current = r;
          }}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          onMessage={(e) => {
            const msg = safeJsonParse<PickedLocation>(e.nativeEvent.data);
            if (msg && typeof msg.latitude === 'number' && typeof msg.longitude === 'number') {
              setSelected({ latitude: msg.latitude, longitude: msg.longitude });
            }
          }}
          javaScriptEnabled
          domStorageEnabled
          style={styles.map}
        />
      ) : MapView ? (
        <MapView
          ref={(r: any) => {
            mapRef.current = r;
          }}
          style={styles.map}
          initialRegion={initialRegion}
          onPress={onMapPress}
          showsUserLocation={permissionStatus === 'granted'}
          showsMyLocationButton={false}
        >
          {selected && Marker ? <Marker coordinate={selected} /> : null}
        </MapView>
      ) : (
        <View style={styles.mapFallback}>
          <Text style={styles.mapFallbackText}>地圖元件載入失敗</Text>
        </View>
      )}

      <View style={styles.bottomPanel}>
        <View style={styles.coordRow}>
          <Text style={styles.coordLabel}>座標：</Text>
          {selected ? (
            <Text style={styles.coordValue}>
              {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
            </Text>
          ) : (
            <Text style={styles.coordEmpty}>尚未選擇</Text>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.secondaryBtn, (permissionStatus !== 'granted' || isLocating) && styles.disabledBtn]}
            onPress={() => void locateToDevice()}
            disabled={permissionStatus !== 'granted' || isLocating}
          >
            <Text style={[styles.actionText, styles.secondaryText]}>{isLocating ? '定位中...' : '定位到我'}</Text>
          </Pressable>

          <Pressable style={[styles.actionBtn, !selected && styles.disabledBtn]} onPress={onConfirm} disabled={!selected}>
            <Text style={styles.actionText}>確定</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  mapFallbackText: { color: '#6b7280', fontWeight: '800' },

  banner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  bannerText: { marginTop: 4, fontSize: 12, lineHeight: 16, color: '#92400E' },
  bannerButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#92400E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerButtonText: { color: '#fff', fontWeight: '800' },

  bottomPanel: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  coordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  coordLabel: { color: '#6b7280', fontSize: 12 },
  coordValue: { fontWeight: '800' },
  coordEmpty: { color: '#6b7280' },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#34D399',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  secondaryBtn: { backgroundColor: '#F3F4F6' },
  actionText: { color: '#065F46', fontSize: 16, fontWeight: '800' },
  secondaryText: { color: '#111827' },
  disabledBtn: { opacity: 0.5 },
});
