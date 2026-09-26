import { useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.46:5000/api/v1';
const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'http://192.168.1.46:5173';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });

export default function Home() {
  const webViewRef = useRef(null);
  const canNavigateBack = useRef(false);
  const pushToken = useRef(null);
  const pendingNotification = useRef(null);
  const injectPushContext = () => {
    if (!webViewRef.current) return;
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
    let active = true;
    async function registerNotifications() {
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('orders', { name: 'Orders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 250, 250, 250] });
      const permissions = await Notifications.getPermissionsAsync();
      const finalStatus = permissions.status === 'granted' ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
      if (finalStatus !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const result = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (active) { pushToken.current = result.data; injectPushContext(); }
    }
    void registerNotifications().catch(error => console.warn('Push registration failed', error));
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
