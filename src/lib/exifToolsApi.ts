/**
 * ExifTools.com API 集成
 * 
 * 用於提取照片 EXIF GPS 數據的第三方服務
 * 網站: https://exiftools.com/
 * 
 * ⚠️ 注意：使用此服務會將照片上傳到第三方服務器
 * 請確保用戶同意隱私條款
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { EncodingType } from 'expo-file-system/legacy';
import { isValidGPS } from '../utils/exifGpsParser';

const EXIFTOOLS_API_URL = 'https://exiftools.com/api/v1/extract';
const EXIFTOOLS_API_KEY = '327071d597a7b75f';

interface ExifToolsResponse {
  success: boolean;
  status: string;
  fileName: string;
  metadata?: {
    EXIF?: Record<string, any>;
    GPS?: Record<string, any>;
    Composite?: Record<string, any>;
  };
  error?: string;
}

export interface GPSExtractionResult {
  gps: { latitude: number; longitude: number } | null;
  source: 'local' | 'exiftools-api' | 'manual' | 'failed';
  error?: string;
}

/**
 * 從 ExifTools.com API 提取 GPS
 * 
 * ⚠️ Expo Go 兼容性說明：
 * - ✅ 使用 expo-file-system 讀取文件（支持 file:// 和 content:// URI）
 * - ✅ 使用 React Native 的 FormData 上傳
 * - ⚠️ 需要網絡連接
 * 
 * @param imageUri 本地圖片 URI (file:// 或 content://)
 * @returns GPS 坐標或 null
 */
/**
 * 像網頁一樣上傳文件到 ExifTools.com
 * 
 * 問題：React Native 的 FormData 和 Blob 實現與網頁不同
 * 特別是 Android 的 content:// URI 需要特殊處理
 */
export async function extractGPSFromExifTools(
  imageUri: string
): Promise<{ latitude: number; longitude: number } | null> {
  console.log(`🌐 [ExifTools] 開始提取 GPS: ${imageUri.substring(0, 50)}...`);
  
  try {
    // 方法 1: 像網頁一樣使用 fetch + FormData（適用於 file:// URI）
    if (imageUri.startsWith('file://')) {
      console.log(`📖 [ExifTools] 讀取 file:// 文件...`);
      
      // 讀取文件內容
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: EncodingType.Base64,
      });
      
      // 創建一個類似網頁 File 對象的結構
      const fileData = {
        uri: imageUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      };
      
      const formData = new FormData();
      formData.append('file', fileData as any);
      
      console.log(`🚀 [ExifTools] 使用 FormData 上傳 (類似網頁)...`);
      
      const response = await fetch(EXIFTOOLS_API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': EXIFTOOLS_API_KEY,
        },
        body: formData,
      });
      
      console.log(`📡 [ExifTools] 響應狀態: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [ExifTools] API error:', response.status, errorText);
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      
      const data: ExifToolsResponse = await response.json();
      console.log(`📄 [ExifTools] 響應:`, JSON.stringify(data, null, 2).substring(0, 500));
      
      if (!data.success) {
        console.log('❌ [ExifTools] API returned unsuccess:', data.error);
        return null;
      }
      
      const gps = parseGPSFromExifToolsResponse(data);
      console.log(`📍 [ExifTools] 提取結果:`, gps);
      return gps;
    }
    
    // 方法 2: 對於 content:// URI，先下載為 blob，再上傳
    console.log(`📖 [ExifTools] 下載 content:// 文件...`);
    const downloadRes = await fetch(imageUri);
    const blob = await downloadRes.blob();
    console.log(`✅ [ExifTools] 下載成功，大小: ${blob.size} bytes`);
    
    // 將 blob 轉為 base64
    console.log(`🔄 [ExifTools] 轉換為 base64...`);
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    console.log(`✅ [ExifTools] base64 長度: ${base64.length}`);
    
    // 使用 base64 上傳（像網頁 AJAX 一樣）
    console.log(`🚀 [ExifTools] 使用 base64 上傳...`);
    
    const response = await fetch(EXIFTOOLS_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': EXIFTOOLS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64,
        filename: 'photo.jpg',
      }),
    });
    
    console.log(`📡 [ExifTools] 響應狀態: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [ExifTools] API error:', response.status, errorText);
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data: ExifToolsResponse = await response.json();
    
    if (!data.success) {
      console.log('❌ [ExifTools] API returned unsuccess:', data.error);
      return null;
    }
    
    const gps = parseGPSFromExifToolsResponse(data);
    console.log(`📍 [ExifTools] 提取結果:`, gps);
    return gps;
    
  } catch (error: any) {
    console.error('❌ [ExifTools] extraction failed:', error.message);
    return null;
  }
}

/**
 * 解析 ExifTools API 響應中的 GPS
 */
function parseGPSFromExifToolsResponse(
  data: ExifToolsResponse
): { latitude: number; longitude: number } | null {
  console.log(`🔍 [ExifTools] 解析響應...`);
  
  if (!data.metadata) {
    console.log(`❌ [ExifTools] 無 metadata`);
    return null;
  }
  
  // 嘗試從不同位置提取 GPS
  const exif = data.metadata.EXIF || {};
  const gps = data.metadata.GPS || {};
  const composite = data.metadata.Composite || {};
  
  console.log(`📊 [ExifTools] Composite:`, JSON.stringify({
    GPSLatitude: composite.GPSLatitude,
    GPSLongitude: composite.GPSLongitude,
    GPSLatitudeRef: composite.GPSLatitudeRef,
    GPSLongitudeRef: composite.GPSLongitudeRef,
  }));
  console.log(`📊 [ExifTools] GPS:`, JSON.stringify({
    GPSLatitude: gps.GPSLatitude,
    GPSLongitude: gps.GPSLongitude,
  }));
  
  try {
    // 方法 1: Composite 中的簡化 GPS（可能是 DMS 字符串格式）
    if (composite.GPSLatitude && composite.GPSLongitude) {
      const latRef = composite.GPSLatitudeRef || 'N';
      const lngRef = composite.GPSLongitudeRef || 'E';
      
      // 嘗試使用 parseDMS 解析 DMS 字符串格式
      const lat = parseDMS(composite.GPSLatitude, latRef);
      const lng = parseDMS(composite.GPSLongitude, lngRef);
      
      if (lat !== null && lng !== null) {
        // 檢查 GPS 是否有效（排除 0.000, 0.000）
        if (!isValidGPS(lat, lng)) {
          console.log('⚠️ [ExifTools] Composite GPS 無效 (0.000,0.000):', lat, lng);
          return null;
        }
        
        console.log(`✅ [ExifTools] 從 Composite 提取成功: ${lat}, ${lng}`);
        return { latitude: lat, longitude: lng };
      }
      
      // 備用：嘗試直接解析數字格式
      const latNum = parseCoordinate(composite.GPSLatitude);
      const lngNum = parseCoordinate(composite.GPSLongitude);
      
      if (latNum !== null && lngNum !== null) {
        const latitude = latRef === 'S' ? -latNum : latNum;
        const longitude = lngRef === 'W' ? -lngNum : lngNum;
        
        if (!isValidGPS(latitude, longitude)) {
          console.log('⚠️ [ExifTools] Composite GPS 無效 (0.000,0.000):', latitude, longitude);
          return null;
        }
        
        console.log(`✅ [ExifTools] 從 Composite (數字格式) 提取成功: ${latitude}, ${longitude}`);
        return { latitude, longitude };
      }
    }
    
    // 方法 2: GPS 段中的數據
    if (gps.GPSLatitude && gps.GPSLongitude) {
      const lat = parseDMS(gps.GPSLatitude, gps.GPSLatitudeRef || 'N');
      const lng = parseDMS(gps.GPSLongitude, gps.GPSLongitudeRef || 'E');
      
      if (lat !== null && lng !== null) {
        // 檢查 GPS 是否有效（排除 0.000, 0.000）
        if (!isValidGPS(lat, lng)) {
          console.log('⚠️ [ExifTools] GPS 段無效 (0.000,0.000):', lat, lng);
          return null;
        }
        
        console.log(`✅ [ExifTools] 從 GPS 段提取成功: ${lat}, ${lng}`);
        return { latitude: lat, longitude: lng };
      }
    }
    
    // 方法 3: EXIF 段中的原始數據
    const latStr = exif.GPSLatitude;
    const lngStr = exif.GPSLongitude;
    
    if (latStr && lngStr) {
      // 可能是字符串格式
      const lat = parseCoordinate(latStr);
      const lng = parseCoordinate(lngStr);
      
      if (lat !== null && lng !== null) {
        const latRef = exif.GPSLatitudeRef || 'N';
        const lngRef = exif.GPSLongitudeRef || 'E';
        
        const latitude = latRef === 'S' ? -lat : lat;
        const longitude = lngRef === 'W' ? -lng : lng;
        
        // 檢查 GPS 是否有效（排除 0.000, 0.000）
        if (!isValidGPS(latitude, longitude)) {
          console.log('⚠️ [ExifTools] EXIF 段無效 (0.000,0.000):', latitude, longitude);
          return null;
        }
        
        console.log(`✅ [ExifTools] 從 EXIF 段提取成功: ${latitude}, ${longitude}`);
        return { latitude, longitude };
      }
    }
    
    console.log(`❌ [ExifTools] 未找到有效 GPS 數據`);
    
  } catch (error) {
    console.error('❌ [ExifTools] Error parsing GPS from response:', error);
  }
  
  return null;
}

/**
 * 解析坐標值（處理不同格式）
 */
function parseCoordinate(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * 解析度分秒（DMS）格式
 * ExifTools 可能返回數組格式 [度, 分, 秒]
 */
function parseDMS(dms: any, ref: string): number | null {
  try {
    let degrees = 0, minutes = 0, seconds = 0;
    
    if (Array.isArray(dms)) {
      // [度, 分, 秒] 格式
      degrees = parseFloat(dms[0]) || 0;
      minutes = parseFloat(dms[1]) || 0;
      seconds = parseFloat(dms[2]) || 0;
    } else if (typeof dms === 'string') {
      // 嘗試解析字符串 "22 deg 19' 15.48\" N"
      const match = dms.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"/);
      if (match) {
        degrees = parseFloat(match[1]);
        minutes = parseFloat(match[2]);
        seconds = parseFloat(match[3]);
      } else {
        // 嘗試直接解析為數字
        return parseFloat(dms);
      }
    }
    
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    // 應用方向
    if (ref === 'S' || ref === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  } catch (error) {
    console.error('Error parsing DMS:', error);
    return null;
  }
}

/**
 * 完整的 GPS 提取流程（帶後備方案）
 * 
 * 策略：
 * 1. 先嘗試前端本地提取（免費、快速、保護隱私）
 * 2. 如果失敗且用戶同意，調用 ExifTools.com API
 * 3. 如果都失敗，返回 null，由調用方引導用戶手動選擇
 */
export async function extractGPSWithFallback(
  uri: string,
  options: {
    localExif?: any;
    useApi?: boolean;  // 是否允許使用 API
    apiKey?: string;
  } = {}
): Promise<GPSExtractionResult> {
  const { localExif, useApi = true } = options;
  
  // 1. 嘗試本地提取
  if (localExif) {
    const localGPS = extractGpsFromLocalExif(localExif);
    if (localGPS) {
      return { gps: localGPS, source: 'local' };
    }
  }
  
  // 2. 嘗試 ExifTools.com API（如果用戶允許）
  if (useApi) {
    try {
      const apiGPS = await extractGPSFromExifTools(uri);
      if (apiGPS) {
        return { gps: apiGPS, source: 'exiftools-api' };
      }
    } catch (error: any) {
      console.log('API extraction failed:', error.message);
    }
  }
  
  // 3. 都失敗了
  return { gps: null, source: 'failed' };
}

/**
 * 從本地 exif 對象提取 GPS
 * 與 exifGpsParser.ts 中的函數類似
 */
function extractGpsFromLocalExif(exif: any): { latitude: number; longitude: number } | null {
  if (!exif) return null;
  
  try {
    // iOS 格式
    const gps = exif['{GPS}'] || exif.GPS;
    if (gps) {
      const lat = gps.Latitude ?? gps.latitude;
      const lng = gps.Longitude ?? gps.longitude;
      const latRef = gps.LatitudeRef ?? gps.latitudeRef;
      const lngRef = gps.LongitudeRef ?? gps.longitudeRef;
      
      if (typeof lat === 'number' && typeof lng === 'number') {
        const latitude = latRef === 'S' ? -lat : lat;
        const longitude = lngRef === 'W' ? -lng : lng;
        
        // 檢查 GPS 是否有效（排除 0.000, 0.000）
        if (!isValidGPS(latitude, longitude)) {
          console.log('⚠️ Local EXIF iOS GPS 無效 (0.000,0.000):', latitude, longitude);
          return null;
        }
        
        return { latitude, longitude };
      }
    }
    
    // Android 直接格式
    if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
      const latitude = exif.latitude;
      const longitude = exif.longitude;
      
      // 檢查 GPS 是否有效（排除 0.000, 0.000）
      if (!isValidGPS(latitude, longitude)) {
        console.log('⚠️ Local EXIF Android GPS 無效 (0.000,0.000):', latitude, longitude);
        return null;
      }
      
      return { latitude, longitude };
    }
  } catch (error) {
    console.log('Local EXIF extraction error:', error);
  }
  
  return null;
}

/**
 * 批量提取多張照片的 GPS
 */
export async function batchExtractGPS(
  photos: Array<{ uri: string; localExif?: any }>,
  options: { useApi?: boolean } = {}
): Promise<Array<{
  uri: string;
  result: GPSExtractionResult;
}>> {
  const results = await Promise.all(
    photos.map(async (photo) => {
      const result = await extractGPSWithFallback(photo.uri, {
        localExif: photo.localExif,
        useApi: options.useApi
      });
      
      return { uri: photo.uri, result };
    })
  );
  
  return results;
}

/**
 * 檢查 ExifTools API 是否可用
 */
export async function checkExifToolsAvailability(): Promise<boolean> {
  try {
    const response = await fetch(EXIFTOOLS_API_URL, {
      method: 'HEAD'
    });
    return response.ok;
  } catch {
    return false;
  }
}
