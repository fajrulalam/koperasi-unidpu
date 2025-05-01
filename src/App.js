// src/App.js
import React from 'react';
import MainPage from './pages/MainPage';
import { AuthProvider } from './context/AuthContext';
import { EnvironmentProvider } from './context/EnvironmentContext';
import { FirestoreProvider } from './context/FirestoreContext';
import { DatabaseProvider } from './context/DatabaseContext';

function App() {
  return (
    <AuthProvider>
      <EnvironmentProvider>
        <FirestoreProvider>
          <DatabaseProvider>
            <MainPage />
          </DatabaseProvider>
        </FirestoreProvider>
      </EnvironmentProvider>
    </AuthProvider>
  );
}

export default App;