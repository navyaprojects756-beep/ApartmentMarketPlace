import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api/v1';
const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || apiUrl.replace(/:5000\/api\/v1$/, ':5173');

export default function Home() {
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><WebView source={{ uri: webUrl }} startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#6d4aff" /></View>} javaScriptEnabled domStorageEnabled allowsBackForwardNavigationGestures /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f8f7fb' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f7fb' } });
