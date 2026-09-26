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

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.46:5000/api/v1';
const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'http://192.168.1.46:5173';

Notifications?.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

export default function Home() {
  const webViewRef = useRef(null);
  const canNavigateBack = useRef(false);
  const pushToken = useRef(null);
  const pendingNotification = useRef(null);
  const injectPushContext = () => {
    if (!webViewRef.current) return;
    console.log('[push] injecting native push context into WebView', { hasToken: Boolean(pushToken.current), hasPendingNotification: Boolean(pendingNotification.current) });
    const tokenScript = pushToken.current ? `window.__gatedcartNativePushToken=${JSON.stringify(pushToken.current)};window.__gatedcartNativePushPlatform=${JSON.stringify(Platform.OS)};window.dispatchEvent(new CustomEvent('gatedcart-push-token',{detail:{token:${JSON.stringify(pushToken.current)},platform:${JSON.stringify(Platform.OS)}}});` : '';
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
    try { canNavigateBack.current = Boolean(JSON.parse(event.nativeEvent.data).canGoBack); } catch { canNavigateBack.current = false; }
  }
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><WebView ref={webViewRef} source={{ uri: webUrl }} onMessage={handleMessage} onLoadEnd={injectPushContext} startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /></View>} javaScriptEnabled domStorageEnabled allowsBackForwardNavigationGestures /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f8f7fb' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f7fb' } });
