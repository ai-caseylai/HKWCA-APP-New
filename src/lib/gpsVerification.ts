/**
 * 後端 GPS 驗證服務
 * 
 * 結合後端進行 GPS 驗證，提高準確性
 */

import { functionsFetch } from './api';

export interface GPSVerificationResult {
  backendGps: {
    latitude: number;
    longitude: number;
    source: string;
  } | null;
  consistency: {
    status: 'consistent' | 'slight_diff' | 'significant_diff' | 'app_missing' | 'no_exif_gps';
    distanceDiff?: number;
    confidence: 'high' | 'medium' | 'low';
  };
  validation: {
    valid: boolean;
    issues: string[];
  };
  recommendation: {
    action: 'auto_accept' | 'accept_with_warning' | 'manual_verification';
    confidence: 'high' | 'medium' | 'low';
    reasons: string[];
    useGps?: { latitude: number; longitude: number };
  };
}

/**
 * 上傳照片到後端進行 GPS 驗證
 * 
 * @param uri 照片 URI
 * @param appGps App 端讀取的 GPS（如果有）
 * @param context 上下文（預期位置等）
 */
export async function verifyPhotoGPS(
  uri: string,
  appGps?: { latitude: number; longitude: number } | null,
  context?: {
    expectedLocation?: { latitude: number; longitude: number };
    pondName?: string;
  }
): Promise<GPSVerificationResult | null> {
  try {
    // 讀取文件為 base64
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // 轉換為 base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // 去掉 data:image/jpeg;base64, 前綴
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 調用後端 API
    const result = await functionsFetch('verify-photo-gps', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: base64,
        appGps,
        context,
        timestamp: Date.now()
      })
    });

    return result;
  } catch (error) {
    console.error('後端 GPS 驗證失敗:', error);
    return null;
  }
}

/**
 * 快速驗證（不上傳完整圖片，只發送 EXIF 數據）
 * 
 * 適用於已經在 App 端讀取到 GPS 的情況，後端只進行合理性驗證
 */
export async function verifyGPSOnly(
  gps: { latitude: number; longitude: number },
  context?: {
    expectedLocation?: { latitude: number; longitude: number };
    pondName?: string;
  }
): Promise<{
  valid: boolean;
  issues: string[];
  inHongKong: boolean;
  distanceFromExpected?: number;
}> {
  try {
    const result = await functionsFetch('verify-gps-only', {
      method: 'POST',
      body: JSON.stringify({
        gps,
        context,
        timestamp: Date.now()
      })
    });

    return result;
  } catch (error) {
    console.error('GPS 驗證失敗:', error);
    return {
      valid: false,
      issues: ['verification_failed'],
      inHongKong: false
    };
  }
}

/**
 * 處理後端驗證結果，返回用戶友好的提示
 */
export function handleVerificationResult(
  result: GPSVerificationResult,
  onAutoAccept: (gps: { latitude: number; longitude: number }) => void,
  onManualSelect: () => void
): string | null {
  const { recommendation } = result;
  
  switch (recommendation.action) {
    case 'auto_accept':
      // 自動接受後端 GPS
      if (recommendation.useGps) {
        onAutoAccept(recommendation.useGps);
      }
      return null;
      
    case 'accept_with_warning':
      // 返回警告信息，讓 UI 層顯示 Alert
      return `位置警告：\n${recommendation.reasons.join('\n')}`;
      
    case 'manual_verification':
    default:
      // 需要人工確認
      return `無法自動驗證照片位置。\n原因：\n${recommendation.reasons.join('\n')}`;
  }
}

/**
 * 批量驗證多張照片（提交前最終驗證）
 */
export async function batchVerifyPhotos(
  photos: Array<{
    uri: string;
    location?: { latitude: number; longitude: number } | null;
  }>,
  context?: {
    expectedLocation?: { latitude: number; longitude: number };
  }
): Promise<{
  verified: number;
  failed: number;
  needsManual: number;
  results: Array<{
    uri: string;
    status: 'verified' | 'failed' | 'needs_manual';
    finalLocation?: { latitude: number; longitude: number };
  }>;
}> {
  const results = await Promise.all(
    photos.map(async (photo) => {
      try {
        const verification = await verifyPhotoGPS(
          photo.uri,
          photo.location,
          context
        );
        
        if (!verification) {
          return {
            uri: photo.uri,
            status: 'failed' as const
          };
        }
        
        if (verification.recommendation.action === 'auto_accept' &&
            verification.recommendation.useGps) {
          return {
            uri: photo.uri,
            status: 'verified' as const,
            finalLocation: verification.recommendation.useGps
          };
        } else if (verification.recommendation.action === 'accept_with_warning' &&
                   verification.recommendation.useGps) {
          return {
            uri: photo.uri,
            status: 'verified' as const,
            finalLocation: verification.recommendation.useGps
          };
        } else {
          return {
            uri: photo.uri,
            status: 'needs_manual' as const
          };
        }
      } catch (error) {
        return {
          uri: photo.uri,
          status: 'failed' as const
        };
      }
    })
  );
  
  return {
    verified: results.filter(r => r.status === 'verified').length,
    failed: results.filter(r => r.status === 'failed').length,
    needsManual: results.filter(r => r.status === 'needs_manual').length,
    results
  };
}
