import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JobInboxScreen } from './src/screens/JobInboxScreen';

function App() {
  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar barStyle="light-content" />
      <JobInboxScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#10140F',
  },
});

export default App;
