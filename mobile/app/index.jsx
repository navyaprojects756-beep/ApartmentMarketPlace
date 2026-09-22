import { useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api/v1';
const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || apiUrl.replace(/:5000\/api\/v1$/, ':5173');

export default function Home() {
  const webViewRef = useRef(null);
  const canNavigateBack = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canNavigateBack.current) webViewRef.current?.injectJavaScript('window.__gatedcartNativeBack?.(); true;');
      return true;
    });
    return () => subscription.remove();
  }, []);
  function handleMessage(event) {
    try { canNavigateBack.current = Boolean(JSON.parse(event.nativeEvent.data).canGoBack); } catch { canNavigateBack.current = false; }
  }
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><WebView ref={webViewRef} source={{ uri: webUrl }} onMessage={handleMessage} startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /></View>} javaScriptEnabled domStorageEnabled allowsBackForwardNavigationGestures /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f8f7fb' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f7fb' } });
