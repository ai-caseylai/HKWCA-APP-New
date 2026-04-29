import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { functionsFetch, restFetch } from '../lib/api';
import { setAccessToken, setRefreshToken, setOnTokenExpired, clearTokens } from '../lib/authToken';

type AppUser = {
  id: string;
  email: string;
  owner_id?: string; // e.g. F001
  name?: string;
  owner_uuid?: string; // owners.id (uuid)
  project_year?: number;
  project_year_label?: string;
};

export type Pond = {
  id: string;
  pond_id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
};

type StoredSession = {
  access_token: string;
  refresh_token?: string;
  user: AppUser;
  credentials?: {
    owner_id: string;
    phone: string;
  };
  project_year?: number;
  project_year_label?: string;
};

const STORAGE_KEY = 'hkwca_app_session_v1';

type AuthContextType = {
  user: AppUser | null;
  isLoading: boolean;
  isApproved: boolean;
  userPonds: Pond[];
  signIn: (ownerId: string, phone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserPonds: () => Promise<void>;
  autoReSignIn: () => Promise<{ success: boolean }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchOwnerDetails(ownerId: string): Promise<{ name?: string; uuid?: string }> {
  console.log(`🔍 [Auth] 查詢塘主詳情: owner_id=${ownerId}`);
  const q = `/owners?select=id,name&owner_id=eq.${encodeURIComponent(ownerId)}&is_deleted=eq.false&limit=1`;
  console.log(`🔍 [Auth] 查詢 URL: ${q}`);
  try {
    const data = await restFetch<Array<{ id: string; name?: string }>>(q);
    console.log(`🔍 [Auth] 塘主查詢結果:`, data);
    if (data && data.length > 0) {
      console.log(`✅ [Auth] 找到塘主: uuid=${data[0].id}, name=${data[0].name}`);
      return { uuid: data[0].id, name: data[0].name };
    }
    console.warn(`⚠️ [Auth] 未找到塘主: owner_id=${ownerId}`);
    return {};
  } catch (error: any) {
    console.error(`❌ [Auth] 查詢塘主失敗:`, error.message);
    return {};
  }
}

async function fetchUserPonds(ownerUuid: string): Promise<Pond[]> {
  console.log(`🔍 [Auth] 查詢魚塘: owner_uuid=${ownerUuid}`);
  const q = `/ponds?select=id,pond_id,name,latitude,longitude&owner_id=eq.${encodeURIComponent(ownerUuid)}&is_deleted=eq.false&order=pond_id.asc`;
  console.log(`🔍 [Auth] 查詢 URL: ${q}`);
  try {
    const data = await restFetch<Pond[]>(q);
    console.log(`✅ [Auth] 魚塘查詢結果: ${data?.length || 0} 個魚塘`, data);
    return data || [];
  } catch (error: any) {
    console.error(`❌ [Auth] 查詢魚塘失敗:`, error.message);
    console.error(`   詳細錯誤:`, error);
    throw error; // 向上拋出錯誤以便顯示
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false); // 改為 false，啟動時不阻塞 UI
  const [isApproved, setIsApproved] = useState(false);
  const [userPonds, setUserPonds] = useState<Pond[]>([]);

  // 處理 token 過期 - 設置回調（實際處理在 signIn 之後定義）
  const handleTokenExpiredRef = useRef<(() => Promise<void>) | null>(null);
  
  useEffect(() => {
    setOnTokenExpired(() => {
      if (handleTokenExpiredRef.current) {
        handleTokenExpiredRef.current();
      }
    });
    return () => setOnTokenExpired(null);
  }, []);

  const refreshUserPonds = async () => {
    if (!user?.owner_uuid) return;
    const ponds = await fetchUserPonds(user.owner_uuid);
    setUserPonds(ponds);
  };

  useEffect(() => {
    const init = async () => {
      // 靜默檢查是否有已保存的 session，不阻塞 UI
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setAccessToken(null);
          setUser(null);
          setIsApproved(false);
          return;
        }

        let parsed: StoredSession | null = null;
        try {
          parsed = JSON.parse(raw) as StoredSession;
        } catch {
          parsed = null;
        }

        if (!parsed?.access_token || !parsed?.user?.id) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setAccessToken(null);
          setUser(null);
          setIsApproved(false);
          return;
        }

        setAccessToken(parsed.access_token);
        if (parsed.refresh_token) {
          setRefreshToken(parsed.refresh_token);
        }

        let nextUser = parsed.user;

        // 檢查 owner_uuid 是否是有效的 UUID 格式
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = parsed.user.owner_uuid && uuidRegex.test(parsed.user.owner_uuid);

        if (parsed.user.owner_id && (!parsed.user.name || !isValidUuid)) {
          console.log(`🔍 [Auth] 恢復 session 時缺少有效的 owner_uuid，從 owners 表查詢...`);
          const owner = await fetchOwnerDetails(parsed.user.owner_id);
          nextUser = {
            ...parsed.user,
            name: parsed.user.name || owner.name,
            owner_uuid: isValidUuid ? parsed.user.owner_uuid : owner.uuid,
          };
          console.log(`🔍 [Auth] 查詢結果: owner_uuid=${owner.uuid}`);
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              ...parsed,
              user: nextUser,
            })
          );
        }

        setUser(nextUser);
        setIsApproved(true);

        if (nextUser.owner_uuid) {
          const ponds = await fetchUserPonds(nextUser.owner_uuid);
          setUserPonds(ponds);
        }
      } catch (error) {
        // 靜默失敗，不影響 UI
        console.log('Session restore failed:', error);
        setAccessToken(null);
        setUser(null);
        setIsApproved(false);
      }
    };

    init();
  }, []);

  const signIn = async (ownerId: string, phone: string) => {
    setIsLoading(true);
    try {
      const data = await functionsFetch<any>('/app-login', {
        method: 'POST',
        body: { owner_id: ownerId.trim().toUpperCase(), phone: phone.trim() },
      });

      if (!data?.success) {
        return { error: new Error(data?.error || '登入失敗') };
      }
      if (!data?.access_token || !data?.user?.id) {
        return { error: new Error('登入回傳資料不完整') };
      }

      console.log(`🔍 [Auth] 登入成功，設置 access_token: ${data.access_token?.substring(0, 30)}...`);
      setAccessToken(data.access_token);
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }
      console.log(`🔍 [Auth] access_token 已設置`);

      let ownerName = data.user?.name;
      let ownerUuid = data.user?.owner_uuid;
      console.log(`🔍 [Auth] 登入返回: owner_id=${data.user?.owner_id}, owner_uuid=${ownerUuid}, name=${ownerName}`);

      // 檢查 ownerUuid 是否是有效的 UUID 格式（不是短 ID 如 "F001"）
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUuid = ownerUuid && uuidRegex.test(ownerUuid);

      if (!ownerName || !isValidUuid) {
        console.log(`🔍 [Auth] 缺少 ownerName 或 ownerUuid 不是有效的 UUID，從 owners 表查詢...`);
        const owner = await fetchOwnerDetails(data.user.owner_id);
        ownerName = ownerName || owner.name;
        ownerUuid = isValidUuid ? ownerUuid : owner.uuid;
        console.log(`🔍 [Auth] 查詢結果: uuid=${owner.uuid}, name=${owner.name}`);
      }

      const nextUser: AppUser = {
        id: data.user.id,
        email: data.user.email,
        owner_id: ownerId.trim().toUpperCase(), // 短 ID (如 F001)，用於 bird_submissions 查詢
        name: ownerName,
        owner_uuid: ownerUuid, // UUID，用於 submissions 表查詢
        project_year: data.project_year,
        project_year_label: data.project_year_label,
      };

      const session: StoredSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: nextUser,
        credentials: {
          owner_id: ownerId.trim().toUpperCase(),
          phone: phone.trim(),
        },
        project_year: data.project_year,
        project_year_label: data.project_year_label,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      setUser(nextUser);
      setIsApproved(true);

      if (nextUser.owner_uuid) {
        console.log(`🔍 [Auth] 登入成功，開始獲取魚塘，owner_uuid=${nextUser.owner_uuid}`);
        try {
          const ponds = await fetchUserPonds(nextUser.owner_uuid);
          console.log(`📊 [Auth] 設置魚塘數據: ${ponds.length} 個魚塘`);
          setUserPonds(ponds);
        } catch (err: any) {
          console.error(`❌ [Auth] 獲取魚塘失敗:`, err.message);
          // 顯示錯誤但不中斷登入流程
        }
      } else {
        console.warn(`⚠️ [Auth] 登入成功但缺少 owner_uuid，無法獲取魚塘`);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    clearTokens();
    setUser(null);
    setIsApproved(false);
    setUserPonds([]);
  };

  // 設置 token 過期處理函數
  handleTokenExpiredRef.current = async () => {
    console.log('🔒 [Auth] Token 已過期，嘗試自動重新登入...');
    const result = await autoReSignIn();
    if (!result.success) {
      console.log('🔒 [Auth] 自動重新登入失敗，執行登出...');
      await signOut();
      Alert.alert(
        '登入已過期',
        '您的登入狀態已過期，請重新登入',
        [{ text: '確定' }]
      );
    }
  };

  const autoReSignIn = async (): Promise<{ success: boolean }> => {
    try {
      // 从存储中获取保存的登录凭证
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { success: false };
      }

      let parsed: StoredSession | null = null;
      try {
        parsed = JSON.parse(raw) as StoredSession;
      } catch {
        return { success: false };
      }

      // 检查是否有保存的登录凭证
      if (!parsed?.credentials?.owner_id || !parsed?.credentials?.phone) {
        return { success: false };
      }

      // 使用保存的凭证自动重新登入
      console.log('自动重新登入中...');
      const result = await signIn(parsed.credentials.owner_id, parsed.credentials.phone);
      
      if (result.error) {
        console.error('自动重新登入失败:', result.error);
        return { success: false };
      }

      console.log('自动重新登入成功');
      return { success: true };
    } catch (error) {
      console.error('自动重新登入异常:', error);
      return { success: false };
    }
  };

  const value = useMemo(
    () => ({ user, isLoading, isApproved, userPonds, signIn, signOut, refreshUserPonds, autoReSignIn }),
    [user, isLoading, isApproved, userPonds]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
