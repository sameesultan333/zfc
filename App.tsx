import React from 'react';
import { StatusBar } from 'react-native';
import AppNavigator from './navigation/AppNavigator';

function App(): JSX.Element {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <AppNavigator />
    </>
  );
}

export default App;
