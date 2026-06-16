import { AppRegistry } from 'react-native';
import { registerBackgroundHandler } from './src/services/fcmManager';
import App from './src/App';

// Must be called at top level before any React component mounts
registerBackgroundHandler();

AppRegistry.registerComponent('NurseryMonitor', () => App);
