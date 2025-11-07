import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import CreateTicketScreen from './src/screens/CreateTicketScreen';
import ChatScreen from './src/screens/ChatScreen';
import { AuthProvider } from './src/context/AuthContext';
import { setNavigationRef } from './src/services/api';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigationRef = useRef();

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Error checking authentication:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Ou um componente de loading
  }

  return (
    <AuthProvider>
      <NavigationContainer 
        ref={navigationRef}
        onReady={() => {
          // Configura a referência de navegação quando estiver pronto
          setNavigationRef(navigationRef.current);
        }}
      >
        <Stack.Navigator
          initialRouteName={isAuthenticated ? "CreateTicket" : "Login"}
          screenOptions={{
            headerStyle: {
              backgroundColor: '#254396ff',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ title: '' }}
          />
          <Stack.Screen 
            name="CreateTicket" 
            component={CreateTicketScreen}
            options={{ 
              title: 'SmartCall',
              headerLeft: () => null, // Remove back button
            }}
          />
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen}
            options={{ 
              title: 'Chat',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
