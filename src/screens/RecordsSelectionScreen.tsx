import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { FishLogIcon, BirdLogIcon } from '../components/CustomIcons';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'Records'>;

export function RecordsSelectionScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: statusBarHeight + 16 }]}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>我的記錄</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.subtitle}>請選擇要查看的記錄類別</Text>
        
        <View style={styles.iconsContainer}>
          <Pressable 
            style={styles.iconButton}
            onPress={() => {
              navigation.navigate('FishRecords');
            }}
          >
            <FishLogIcon size={176} />
            <Text style={styles.iconLabel}>魚類記錄</Text>
          </Pressable>

          <Pressable 
            style={styles.iconButton}
            onPress={() => {
              navigation.navigate('BirdRecords');
            }}
          >
            <BirdLogIcon size={176} />
            <Text style={styles.iconLabel}>雀鳥記錄</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

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
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },

  content: {
    flex: 1,
    paddingTop: 25,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#065F46',
    textAlign: 'center',
    marginBottom: 48,
  },
  iconsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  iconButton: {
    alignItems: 'center',
    gap: 3,
  },
  iconLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#065F46',
    marginTop: 3,
  },
});
