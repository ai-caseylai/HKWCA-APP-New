import React, { useState, useEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';

const REMEMBER_KEY = '@remember_password';
const SAVED_OWNER_ID_KEY = '@saved_owner_id';
const SAVED_PASSWORD_KEY = '@saved_password';

export function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [ownerId, setOwnerId] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 加載已保存的密碼
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const remember = await AsyncStorage.getItem(REMEMBER_KEY);
        if (remember === 'true') {
          const savedOwnerId = await AsyncStorage.getItem(SAVED_OWNER_ID_KEY);
          const savedPassword = await AsyncStorage.getItem(SAVED_PASSWORD_KEY);
          if (savedOwnerId) setOwnerId(savedOwnerId);
          if (savedPassword) setPhone(savedPassword);
          setRememberPassword(true);
        }
      } catch (error) {
        console.error('載入保存的密碼失敗:', error);
      }
    };
    void loadSavedCredentials();
  }, []);

  const onSubmit = async () => {
    if (!ownerId.trim()) {
      Alert.alert('提示', '請輸入用戶編號');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('提示', '請輸入密碼');
      return;
    }

    const { error } = await signIn(ownerId.trim(), phone);
    if (error) {
      Alert.alert('登入失敗', error.message || '請稍後再試');
    } else {
      // 保存或清除密碼
      try {
        if (rememberPassword) {
          await AsyncStorage.setItem(REMEMBER_KEY, 'true');
          await AsyncStorage.setItem(SAVED_OWNER_ID_KEY, ownerId.trim());
          await AsyncStorage.setItem(SAVED_PASSWORD_KEY, phone);
        } else {
          await AsyncStorage.removeItem(REMEMBER_KEY);
          await AsyncStorage.removeItem(SAVED_OWNER_ID_KEY);
          await AsyncStorage.removeItem(SAVED_PASSWORD_KEY);
        }
      } catch (error) {
        console.error('保存密碼失敗:', error);
      }
      
      // 登錄成功，返回主頁
      navigation.navigate('Main', { screen: 'Home' });
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: statusBarHeight + 20 }]}>
      {/* 返回按鈕 */}
      <Pressable style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={28} color="#059669" />
      </Pressable>

      {/* Logo 區域 */}
      <View style={styles.logoSection}>
        <Image source={require('../../assets/HKWCA_Logo_edited.jpg')} style={styles.logo} resizeMode="contain" />
      </View>

      {/* 登入卡片 */}
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="用戶編號"
          placeholderTextColor="#9CA3AF"
          value={ownerId}
          onChangeText={(t) => setOwnerId(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="密碼"
            placeholderTextColor="#9CA3AF"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showPassword}
          />
          <Pressable 
            style={styles.eyeIcon} 
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons 
              name={showPassword ? "eye-off" : "eye"} 
              size={22} 
              color="#6B7280" 
            />
          </Pressable>
        </View>

        {/* 記住密碼選項 */}
        <Pressable 
          style={styles.rememberContainer}
          onPress={() => setRememberPassword(!rememberPassword)}
        >
          <View style={styles.checkbox}>
            {rememberPassword && (
              <Ionicons name="checkmark" size={18} color="#059669" />
            )}
          </View>
          <Text style={styles.rememberText}>記住密碼</Text>
        </Pressable>

        <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={onSubmit} disabled={isLoading}>
          <Text style={styles.buttonText}>{isLoading ? '登入中...' : '登入'}</Text>
        </Pressable>

        <View style={styles.noticeBox}>
          <Text style={styles.notice}>如未登記，請聯絡香港濕地保育協會</Text>
        </View>
      </View>

      {/* 頁尾版本號 */}
      <View style={styles.footer}>
        <Text style={styles.version}>v1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 40,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: -135,
    marginBottom: 25,
  },
  logo: {
    width: '90%',
    minHeight: 200,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginTop: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 16,
    color: '#111827',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 48,
    fontSize: 16,
    color: '#111827',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#059669',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rememberText: {
    fontSize: 15,
    color: '#111827',
  },
  button: {
    backgroundColor: '#004667',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  noticeBox: {
    marginTop: 8,
  },
  notice: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  version: {
    fontSize: 14,
    fontWeight: '900',
    color: '#6B7280',
  },
});
