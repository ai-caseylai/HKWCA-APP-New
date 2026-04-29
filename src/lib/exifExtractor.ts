/**
 * EXIF GPS 提取 API
 * 
 * 重要：App 端不直接訪問 Supabase Storage
 * 流程：
 * 1. App 讀取本地照片，轉為 base64
 * 2. App 發送 base64 到 Edge Function
 * 3. Edge Function 上傳到臨時 Storage bucket
 * 4. Edge Function 調用 ExifTools.com API 解析 GPS
 * 5. Edge Function 自動刪除臨時文件
 * 6. Edge Function 返回 GPS 數據給 App
 * 
 * App 只負責：讀取文件 → 發送 base64 → 接收 GPS
 * 所有 Storage 操作由 Edge Function 處理
 */

// ==========================================
// Lovable Cloud - Edge Function URL
// ==========================================
const EXTRACT_EXIF_URL = 'https://tbcocbxpspekvqozfycu.supabase.co/functions/v1/extract-exif-url';

// Lovable Cloud - Anon Key
// 專案：tbcocbxpspekvqozfycu
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiY29jYnhwc3Bla3Zxb3pmeWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjM3ODMsImV4cCI6MjA4Mzk5OTc4M30.2ndCqUmoR1eeyV1-uwVTB4WDcLz__-fDssZ7j-jPNMk';

export interface ExtractExifResult {
  success: boolean;
  public_url?: string;
  gps_extracted?: boolean;
  latitude?: number;
  longitude?: number;
  photo_taken_at?: string;
  raw_metadata?: any;
  error?: string;
}

// 請求超時時間（毫秒）
const REQUEST_TIMEOUT = 60000; // 60秒

/**
 * 從照片提取 EXIF GPS
 * 
 * Edge Function 流程：
 * 1. 接收 base64 圖片
 * 2. 上傳到臨時 Storage bucket
 * 3. 獲取 public URL
 * 4. 調用 ExifTools.com API 解析 GPS
 * 5. 自動刪除臨時文件
 * 6. 返回 GPS 數據
 * 
 * @param uri 本地照片 URI (file:// 或 content://)
 * @param filename 文件名
 */
export async function extractExifFromPhoto(
  uri: string,
  filename: string = 'photo.jpg'
): Promise<ExtractExifResult> {
  console.log(`📸 [EXIF Extractor] 開始提取: ${filename}`);
  
  try {
    // 讀取文件為 base64
    console.log(`📖 讀取文件: ${uri.substring(0, 50)}...`);
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // 轉換為 base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // 去掉 data:image/jpeg;base64, 前綴
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
    
    console.log(`✅ 文件讀取成功，base64 長度: ${base64.length} bytes`);
    
    // 構建請求頭
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Supabase 需要 apikey 頭部
    if (API_KEY) {
      headers['apikey'] = API_KEY;
      headers['Authorization'] = `Bearer ${API_KEY}`;
      console.log(`🔑 已添加 API Key 認證`);
    } else {
      console.warn(`⚠️ 未配置 API_KEY，請在 exifExtractor.ts 中填入`);
    }
    
    // 調用 Edge Function（帶超時）
    console.log(`🚀 調用 Edge Function...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const result = await fetch(EXTRACT_EXIF_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filename,
        file_base64: base64,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!result.ok) {
      const errorText = await result.text();
      throw new Error(`HTTP ${result.status}: ${errorText}`);
    }
    
    const data: ExtractExifResult = await result.json();
    console.log(`📊 API 響應:`, JSON.stringify(data, null, 2));
    
    if (data.success && data.gps_extracted && data.latitude && data.longitude) {
      console.log(`✅ GPS 提取成功: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
    } else if (data.success) {
      console.log(`⚠️ 處理成功但未找到 GPS: ${data.error || 'No GPS data in EXIF'}`);
    } else {
      console.log(`❌ 處理失敗: ${data.error || 'Unknown error'}`);
    }
    
    return data;
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ [EXIF Extractor] 請求超時 (60秒)');
      return {
        success: false,
        error: 'Request timeout - 圖片太大或網絡緩慢',
      };
    }
    
    console.error('❌ [EXIF Extractor] 錯誤:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 批量提取 GPS
 * 
 * 注意：會並行處理所有照片，如果照片數量較多，可能需要較長時間
 */
export async function extractExifFromPhotos(
  photos: Array<{ uri: string; filename?: string }>
): Promise<ExtractExifResult[]> {
  console.log(`📸 [EXIF Extractor] 批量提取 ${photos.length} 張照片...`);
  
  const results = await Promise.all(
    photos.map((photo, idx) =>
      extractExifFromPhoto(photo.uri, photo.filename || `photo_${idx + 1}.jpg`)
    )
  );
  
  // 統計結果
  const successCount = results.filter(r => r.success && r.gps_extracted).length;
  const failCount = results.length - successCount;
  console.log(`📊 批量提取完成: ${successCount} 成功, ${failCount} 失敗`);
  
  return results;
}

/**
 * 檢查 GPS 是否有效
 */
export function isValidGPS(lat?: number, lng?: number): boolean {
  if (lat == null || lng == null) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // 排除 0,0 座標
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}
