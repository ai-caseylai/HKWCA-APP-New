import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../assets/hkwca-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* 空白佔位符 */}
      <View style={{ flex: 1 }} />

      {/* 按鈕區域 */}
      <View style={styles.buttonsContainer}>
        {/* 進入主頁按鈕 */}
        <Pressable 
          style={styles.enterButton}
          onPress={() => navigation.replace('Main')}
        >
          <Text style={styles.enterButtonText}>進入主頁</Text>
        </Pressable>

        {/* 登入按鈕 */}
        <Pressable 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Auth')}
        >
          <Text style={styles.loginButtonText}>登入</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 0,
    width: '100%',
  },
  logo: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    marginBottom: 40,
  },
  buttonsContainer: {
    width: '100%',
    paddingHorizontal: 40,
    gap: 16,
    marginBottom: 40,
  },
  enterButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  enterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
