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
console.log('[push] web configuration', { webUrl, apiUrl });

Notifications?.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

export default function Home() {
  const webViewRef = useRef(null);
  const canNavigateBack = useRef(false);
  const pushToken = useRef(null);
  const pendingNotification = useRef(null);
  const injectPushContext = () => {
    if (!webViewRef.current) return;
    console.log('[push] injecting native push context into WebView', { hasToken: Boolean(pushToken.current), tokenSuffix: pushToken.current?.slice(-8), hasPendingNotification: Boolean(pendingNotification.current) });
    const bridgeProbe = `(() => { try { window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'webview-probe', url: window.location.href })); } catch (error) {} })();`;
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
        let attempts = 0;
        const register = () => {
          attempts += 1;
          let auth = '';
          try { auth = window.localStorage.getItem('gatedcart_access_token') || ''; } catch (error) { send({ type: 'push-storage-error', message: String(error) }); }
          send({ type: 'push-debug', attempt: attempts, hasToken: true, tokenSuffix: token.slice(-8), hasAccessToken: Boolean(auth), url: window.location.href });
          if (!auth || window.__gatedcartPushRegistrationToken === token) return;
          window.__gatedcartPushRegistrationToken = token;
          send({ type: 'push-registration-start', api: endpoint });
          fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth }, body: JSON.stringify({ token, platform }) })
            .then(async response => { const body = await response.text(); send({ type: 'push-registration', status: response.status, body: body.slice(0, 300) }); if (!response.ok) window.__gatedcartPushRegistrationToken = ''; else clearInterval(window.__gatedcartNativePushTimer); })
            .catch(error => { window.__gatedcartPushRegistrationToken = ''; send({ type: 'push-registration-error', message: String(error) }); });
        };
        register();
        window.__gatedcartNativePushTimer = setInterval(register, 1000);
      })();` : '';
    const notificationScript = pendingNotification.current ? `window.__gatedcartPendingNotification=${JSON.stringify(pendingNotification.current)};window.__gatedcartNativeNotification?.(window.__gatedcartPendingNotification);` : '';
    webViewRef.current.injectJavaScript(`${bridgeProbe}${tokenScript}${notificationScript}true;`);
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
      console.log('[push] Expo Go detected; native remote notifications are skipped. Use an APK/development build for push testing.');
      return undefined;
    }
    let active = true;
    async function registerNotifications() {
      console.log('[push] starting native notification registration', { platform: Platform.OS });
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('orders', { name: 'Orders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 250, 250, 250] });
      const permissions = await Notifications.getPermissionsAsync();
      console.log('[push] existing notification permission', permissions.status);
      const finalStatus = permissions.status === 'granted' ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
      console.log('[push] final notification permission', finalStatus);
      if (finalStatus !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      console.log('[push] resolved EAS project ID', projectId || 'missing');
      if (!projectId) throw new Error('Expo EAS project ID is missing from the native build.');
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      console.log('[push] Expo push token acquired', { projectId, tokenSuffix: result.data.slice(-8) });
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
      if (message.type === 'push-debug') console.log('[push] WebView state', message);
      if (message.type === 'push-registration') console.log('[push] WebView registration response', message.status);
      if (message.type === 'push-registration-error') console.error('[push] WebView registration error', message.message);
      canNavigateBack.current = Boolean(message.canGoBack);
    } catch { canNavigateBack.current = false; }
  }
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><WebView ref={webViewRef} source={{ uri: webUrl }} onMessage={handleMessage} onLoadStart={event => console.log('[push] WebView load started', event.nativeEvent.url)} onLoadEnd={event => { console.log('[push] WebView load finished', event.nativeEvent.url); injectPushContext(); }} onError={event => console.error('[push] WebView load error', event.nativeEvent)} startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /></View>} javaScriptEnabled domStorageEnabled allowsBackForwardNavigationGestures /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f8f7fb' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f7fb' } });
