import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// Expo Go cannot use Android remote notifications from SDK 53 onward. Keep
// Expo Go usable for UI testing, while loading notifications in standalone
// and development builds where the native module is available.
const Notifications = Constants.appOwnership === 'expo' ? null : require('expo-notifications');

const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://gatedcart.cheritech.com';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://gatedcart-api.onrender.com/api/v1';

function compareVersions(left, right) {
  const a = String(left || '0.0.0').split('.').map(Number);
  const b = String(right || '0.0.0').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

Notifications?.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

export default function Home() {
  const [updateState, setUpdateState] = useState({ checked: false, available: false, mandatory: false, config: null });
  const webViewRef = useRef(null);
  const canNavigateBack = useRef(false);
  const pushToken = useRef(null);
  const pendingNotification = useRef(null);
  const deviceId = Application.androidId || Constants.deviceId || undefined;
  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/app-update?platform=android`)
      .then(response => response.ok ? response.json() : null)
      .then(config => {
        if (!active) return;
        const currentVersion = Application.nativeApplicationVersion || '0.0.0';
        const latestAvailable = config && compareVersions(currentVersion, config.latestVersion) < 0;
        const mandatory = latestAvailable && (config.mode === 'MANDATORY' || compareVersions(currentVersion, config.minimumVersion) < 0);
        setUpdateState({ checked: true, available: Boolean(latestAvailable), mandatory, config });
      })
      .catch(() => { if (active) setUpdateState({ checked: true, available: false, mandatory: false, config: null }); });
    return () => { active = false; };
  }, []);
  const injectPushContext = () => {
    if (!webViewRef.current) return;
    const tokenScript = pushToken.current ? `
      (() => {
        const token = ${JSON.stringify(pushToken.current)};
        const platform = ${JSON.stringify(Platform.OS)};
        const endpoint = ${JSON.stringify(`${apiUrl}/push-devices`)};
        const send = payload => { try { window.ReactNativeWebView?.postMessage(JSON.stringify(payload)); } catch (error) {} };
        window.__gatedcartNativePushToken = token;
        window.__gatedcartNativePushPlatform = platform;
        window.__gatedcartNativePushDeviceId = ${JSON.stringify(deviceId)};
        window.dispatchEvent(new CustomEvent('gatedcart-push-token', { detail: { token, platform, deviceId: window.__gatedcartNativePushDeviceId } }));
        if (window.__gatedcartNativePushTimer) clearInterval(window.__gatedcartNativePushTimer);
        const register = () => {
          let auth = '';
          try { auth = window.localStorage.getItem('gatedcart_access_token') || ''; } catch (error) { send({ type: 'push-registration-error', message: 'Unable to read the web session.' }); }
          if (!auth || window.__gatedcartNativePushRegistrationToken === token) return;
          window.__gatedcartNativePushRegistrationToken = token;
          fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth }, body: JSON.stringify({ token, platform, deviceId }) })
            .then(async response => { await response.text(); send({ type: 'push-registration', status: response.status, deviceId }); if (!response.ok) window.__gatedcartNativePushRegistrationToken = ''; else clearInterval(window.__gatedcartNativePushTimer); })
            .catch(error => { window.__gatedcartNativePushRegistrationToken = ''; send({ type: 'push-registration-error', message: String(error) }); });
        };
        register();
        window.__gatedcartNativePushTimer = setInterval(register, 1000);
      })();` : '';
    const notificationScript = pendingNotification.current ? `window.__gatedcartPendingNotification=${JSON.stringify(pendingNotification.current)};window.__gatedcartNativeNotification?.(window.__gatedcartPendingNotification);` : '';
    webViewRef.current.injectJavaScript(`${tokenScript}${notificationScript}true;`);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canNavigateBack.current) webViewRef.current?.injectJavaScript('window.__gatedcartNativeBack?.(); true;');
      return true;
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!Notifications) {
      return undefined;
    }
    let active = true;
    async function registerNotifications() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('seller_orders', { name: 'Seller orders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 250, 250, 250, 250, 250] });
        await Notifications.setNotificationChannelAsync('customer_updates', { name: 'Customer order updates', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default', vibrationPattern: [0, 180] });
      }
      const permissions = await Notifications.getPermissionsAsync();
      const finalStatus = permissions.status === 'granted' ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
      if (finalStatus !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      if (!projectId) throw new Error('Expo EAS project ID is missing from the native build.');
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      if (active) { pushToken.current = result.data; injectPushContext(); }
    }
    void registerNotifications().catch(error => console.error('[push] registration failed', error?.message || error));
    const received = Notifications.addNotificationReceivedListener(() => injectPushContext());
    const response = Notifications.addNotificationResponseReceivedListener(event => { pendingNotification.current = event.notification.request.content.data; injectPushContext(); });
    return () => { active = false; received.remove(); response.remove(); };
  }, []);
  function handleMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'push-registration' && message.status >= 400) console.error('[push] device registration failed', message.status);
      if (message.type === 'push-registration-error') console.error('[push] device registration failed', message.message);
      canNavigateBack.current = Boolean(message.canGoBack);
    } catch { canNavigateBack.current = false; }
  }
  if (!updateState.checked) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /><Text style={styles.loadingText}>Checking for updates…</Text></View></SafeAreaView>;
  if (updateState.available && updateState.config) return <SafeAreaView style={styles.safe}><View style={styles.updateCard}><Text style={styles.updateEyebrow}>{updateState.mandatory ? 'UPDATE REQUIRED' : 'UPDATE AVAILABLE'}</Text><Text style={styles.updateTitle}>{updateState.config.title}</Text><Text style={styles.updateMessage}>{updateState.config.message}</Text><TouchableOpacity style={styles.updateButton} onPress={() => Linking.openURL(updateState.config.storeUrl)}><Text style={styles.updateButtonText}>Update now</Text></TouchableOpacity>{!updateState.mandatory && <TouchableOpacity style={styles.laterButton} onPress={() => setUpdateState(current => ({ ...current, available: false }))}><Text style={styles.laterButtonText}>Not now</Text></TouchableOpacity>}</View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><WebView ref={webViewRef} source={{ uri: webUrl }} onMessage={handleMessage} onLoadEnd={injectPushContext} onError={event => console.error('[push] WebView load error', event.nativeEvent)} startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /></View>} javaScriptEnabled domStorageEnabled allowsBackForwardNavigationGestures /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f7fb' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f7fb' },
  loadingText: { marginTop: 12, color: '#6f6680', fontSize: 13 },
  updateCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f8f7fb' },
  updateEyebrow: { marginBottom: 12, color: '#ff6800', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  updateTitle: { color: '#142544', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  updateMessage: { maxWidth: 330, marginTop: 12, color: '#6f6680', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  updateButton: { width: '100%', maxWidth: 330, marginTop: 26, paddingVertical: 15, borderRadius: 12, backgroundColor: '#ff6800', alignItems: 'center' },
  updateButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  laterButton: { marginTop: 14, padding: 10 },
  laterButtonText: { color: '#6d4aff', fontSize: 13, fontWeight: '700' },
});
