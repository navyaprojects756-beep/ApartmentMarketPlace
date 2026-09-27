import { useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// Expo Go cannot use Android remote notifications from SDK 53 onward. Keep
// Expo Go usable for UI testing, while loading notifications in standalone
// and development builds where the native module is available.
const Notifications = Constants.appOwnership === 'expo' ? null : require('expo-notifications');

const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://gatedcart.cheritech.com';
const apiUrl = 'https://gatedcart-api.onrender.com/api/v1';

Notifications?.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

export default function Home() {
  const webViewRef = useRef(null);
  const canNavigateBack = useRef(false);
  const pushToken = useRef(null);
  const pendingNotification = useRef(null);
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
        window.dispatchEvent(new CustomEvent('gatedcart-push-token', { detail: { token, platform } }));
        if (window.__gatedcartNativePushTimer) clearInterval(window.__gatedcartNativePushTimer);
        const register = () => {
          let auth = '';
          try { auth = window.localStorage.getItem('gatedcart_access_token') || ''; } catch (error) { send({ type: 'push-registration-error', message: 'Unable to read the web session.' }); }
          if (!auth || window.__gatedcartNativePushRegistrationToken === token) return;
          window.__gatedcartNativePushRegistrationToken = token;
          fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth }, body: JSON.stringify({ token, platform }) })
            .then(async response => { await response.text(); send({ type: 'push-registration', status: response.status }); if (!response.ok) window.__gatedcartNativePushRegistrationToken = ''; else clearInterval(window.__gatedcartNativePushTimer); })
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
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('orders', { name: 'Orders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 250, 250, 250] });
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
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><WebView ref={webViewRef} source={{ uri: webUrl }} onMessage={handleMessage} onLoadEnd={injectPushContext} onError={event => console.error('[push] WebView load error', event.nativeEvent)} startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /></View>} javaScriptEnabled domStorageEnabled allowsBackForwardNavigationGestures /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f8f7fb' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f7fb' } });
