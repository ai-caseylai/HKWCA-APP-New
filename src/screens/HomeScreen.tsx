import React, { useState, useMemo } from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { AppMode, MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { NetworkIndicator } from '../components/NetworkIndicator';

import {
  FishPondSubmitIcon,
  BirdSubmitIcon,
  FishPondRecordsIcon,
  BirdRecordsIcon,
  FishPondGalleryIcon,
  BirdGalleryIcon,
} from '../components/CustomIcons';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isApproved } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<AppMode>('fish');

  const handleLoginPress = () => {
    navigation.navigate('Auth');
  };

  const handleMorePress = () => {
    navigation.navigate('Main', { screen: 'More' });
  };

  const checkLoginAndNavigate = (action: () => void, actionName: string) => {
    if (!isApproved) {
      Alert.alert(
        '請先登入',
        '請先登入以使用本APP',
        [
          { text: '取消', style: 'cancel' },
          { text: '登入', onPress: handleLoginPress },
        ]
      );
      return;
    }
    action();
  };

  const goSubmit = () => {
    navigation.navigate('Main', {
      screen: 'Submit',
      params: {
        type: mode,
      },
    });
  };

  const goGallery = (galleryMode: AppMode) => {
    if (galleryMode === 'fish') {
      navigation.navigate('FishGallery');
    } else {
      navigation.navigate('BirdGallery');
    }
  };

  const goRecords = (recordMode: AppMode) => {
    if (recordMode === 'fish') {
      navigation.navigate('FishRecords');
    } else {
      navigation.navigate('BirdRecords');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* 网络状态指示器 */}
      <NetworkIndicator />

      {/* 顶部标题 */}
      <View style={[styles.header, { paddingTop: 16 }]}>
        <Text style={styles.appTitle}>主頁</Text>
      </View>

      {/* 未登入時顯示登入按鈕 - 在 header 下方，左對齊 */}
      {!isApproved && (
        <View style={styles.userBarContainer}>
          <Pressable style={styles.loginButton} onPress={handleLoginPress}>
            <Ionicons name="person-circle-outline" size={32} color="#374151" />
            <Text style={styles.loginText}>用戶登入</Text>
          </Pressable>
        </View>
      )}

      {/* 塘主標籤 - 移到 header 下方，左對齊，添加人像圖標 */}
      {isApproved && user && (
        <View style={styles.userBarContainer}>
          <View style={styles.userInfoSection}>
            <Ionicons name="person-circle" size={28} color="#000000" />
            <Text style={styles.pondIdLabel}>{user.name || user.owner_id || '已登錄'}</Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* 主選單 - 3行2列 */}
        <View style={[styles.menuGrid, { paddingBottom: 60 + insets.bottom + 10 }]}>
          <View style={styles.menuRow}>
            <Pressable 
              style={styles.menuItem} 
              onPress={() => {
                checkLoginAndNavigate(() => {
                  setMode('fish');
                  navigation.navigate('FishSubmit', {
                    type: 'fish',
                  });
                }, '提交魚塘相片');
              }}
            >
              <FishPondSubmitIcon size={140} />
              <Text style={styles.menuLabel}>提交魚塘相片</Text>
            </Pressable>

            <Pressable 
              style={styles.menuItem} 
              onPress={() => {
                checkLoginAndNavigate(() => {
                  setMode('bird');
                  navigation.navigate('BirdSubmit', {
                    type: 'bird',
                  });
                }, '提交雀鳥相片');
              }}
            >
              <BirdSubmitIcon size={140} />
              <Text style={styles.menuLabel}>提交雀鳥相片</Text>
            </Pressable>
          </View>

          <View style={styles.menuRow}>
            <Pressable 
              style={styles.menuItem} 
              onPress={() => checkLoginAndNavigate(() => goRecords('fish'), '我的魚塘記錄')}
            >
              <FishPondRecordsIcon size={140} />
              <Text style={styles.menuLabel}>我的魚塘記錄</Text>
            </Pressable>

            <Pressable 
              style={styles.menuItem} 
              onPress={() => checkLoginAndNavigate(() => goRecords('bird'), '我的雀鳥記錄')}
            >
              <BirdRecordsIcon size={140} />
              <Text style={styles.menuLabel}>我的雀鳥記錄</Text>
            </Pressable>
          </View>

          <View style={styles.menuRow}>
            <Pressable 
              style={styles.menuItem} 
              onPress={() => checkLoginAndNavigate(() => goGallery('fish'), '魚塘相片庫')}
            >
              <FishPondGalleryIcon size={140} />
              <Text style={styles.menuLabel}>魚塘相片庫</Text>
            </Pressable>

            <Pressable 
              style={styles.menuItem} 
              onPress={() => checkLoginAndNavigate(() => goGallery('bird'), '雀鳥相片庫')}
            >
              <BirdGalleryIcon size={140} />
              <Text style={styles.menuLabel}>雀鳥相片庫</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 153, 153, 1)'
  },

  header: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12, 
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 153, 153, 1)',
    position: 'relative',
    minHeight: 24,
  },
  appTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#FFFFFF', 
    textAlign: 'center',
    lineHeight: 24,
    flex: 1,
  },
  
  // 用戶欄容器 - 包含登入按鈕/用戶信息和更多按鈕
  userBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  
  // 未登入時的登入按鈕
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  loginText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  
  // 用戶信息區域（已登入）
  userInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pondIdLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  
  // 更多按鈕（三橫線）
  moreButton: {
    padding: 8,
    marginLeft: 8,
  },


  menuGrid: {
    flex: 1,
    paddingHorizontal: 16, // 与其他页面保持一致
    paddingTop: 10,
    // paddingBottom 通过动态样式设置，以适应不同设备的底部安全区域
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10, // 添加垂直间距
  },
  menuItem: {
    width: '48%',
    aspectRatio: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8, // 统一所有图标和文字之间的间距
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginTop: 0,
  },
  menuIcon: {
    width: 110,
    height: 110,
    marginBottom: 0,
  },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  modalClose: { color: '#111827', fontWeight: '900' },

  modalItem: { paddingHorizontal: 16, paddingVertical: 12 },
  modalItemActive: { backgroundColor: '#34D399' },
  modalItemTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  modalItemTitleActive: { color: '#065F46' },
  modalItemSub: { marginTop: 2, color: '#374151' },
  modalItemSubActive: { color: '#E5E7EB' },
  modalItemMeta: { marginTop: 6, color: '#6b7280', fontSize: 12 },

  sep: { height: 1, backgroundColor: '#F3F4F6' },
});
