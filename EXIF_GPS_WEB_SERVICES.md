# EXIF GPS 網絡服務列表

## 🌟 推薦服務

### 1. ExifTools.com ⭐⭐⭐ (推薦)

**網站**: https://exiftools.com/

**特點**:
- ✅ 100% 免費
- ✅ 無需註冊（基礎功能）
- ✅ REST API 可用
- ✅ 支持 GPS 提取
- ✅ 支持 100+ 文件格式（包括 HEIC、RAW）

**API 使用**:
```bash
curl -X POST https://exiftools.com/api/v1/extract \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "file=@image.jpg"
```

**響應示例**:
```json
{
  "success": true,
  "status": "completed",
  "fileName": "image.jpg",
  "metadata": {
    "EXIF": {
      "GPSLatitude": "22.3193",
      "GPSLongitude": "114.1694",
      "GPSLatitudeRef": "N",
      "GPSLongitudeRef": "E"
    }
  }
}
```

**限制**: 最大 100MB 文件

---

### 2. RapidAPI - Metadata Extractor ⭐⭐

**網站**: https://rapidapi.com/igniwork/api/metadata-extractor

**特點**:
- ✅ 免費套餐：150 請求/月
- ✅ 支持圖片和視頻
- ✅ REST API

**價格**:
- 免費：150 請求/月
- 超出：$0.02/請求

**API 使用**:
```javascript
fetch('https://metadata-extractor.p.rapidapi.com/extract', {
  method: 'POST',
  headers: {
    'X-RapidAPI-Key': 'YOUR_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ image_url: 'https://example.com/photo.jpg' })
})
```

---

### 3. RapidAPI - AirExif ⭐⭐

**網站**: https://rapidapi.com/studioxolo-air-exif/api/airexif

**特點**:
- ✅ 免費套餐：100 請求/月
- ✅ 專注 EXIF 提取
- ✅ 支持 GPS

**價格**:
- 免費：100 請求/月
- 超出：$0.02/請求

---

### 4. ApyHub - Image Metadata Extractor ⭐

**網站**: https://apyhub.com/utility/image-processor-extract-metadata

**特點**:
- ✅ 提取完整 EXIF
- ⚠️ 不確定是否支持 GPS

**限制**: 免費額度較低

---

## 🚀 在 App 中使用 ExifTools.com

這是最推薦的方案，因為它免費且支持 GPS。

### 實現代碼

```typescript
// src/lib/exifToolsApi.ts

const EXIFTOOLS_API_URL = 'https://exiftools.com/api/v1/extract';

interface ExifToolsResponse {
  success: boolean;
  status: string;
  fileName: string;
  metadata?: {
    EXIF?: {
      GPSLatitude?: string;
      GPSLongitude?: string;
      GPSLatitudeRef?: string;
      GPSLongitudeRef?: string;
      GPSInfo?: any;
    };
  };
}

/**
 * 使用 ExifTools.com 提取 GPS
 */
export async function extractGPSFromExifTools(
  imageUri: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // 讀取文件
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // 創建 FormData
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    
    // 調用 API
    const apiResponse = await fetch(EXIFTOOLS_API_URL, {
      method: 'POST',
      body: formData,
      headers: {
        // 基礎功能可能不需要 API Key
        // 'X-API-Key': 'YOUR_API_KEY'
      }
    });
    
    if (!apiResponse.ok) {
      throw new Error(`API error: ${apiResponse.status}`);
    }
    
    const data: ExifToolsResponse = await apiResponse.json();
    
    if (!data.success || !data.metadata?.EXIF) {
      return null;
    }
    
    const exif = data.metadata.EXIF;
    
    // 解析 GPS
    if (exif.GPSLatitude && exif.GPSLongitude) {
      let lat = parseFloat(exif.GPSLatitude);
      let lng = parseFloat(exif.GPSLongitude);
      
      // 應用方向
      if (exif.GPSLatitudeRef === 'S') lat = -lat;
      if (exif.GPSLongitudeRef === 'W') lng = -lng;
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    
    return null;
  } catch (error) {
    console.error('ExifTools API error:', error);
    return null;
  }
}

/**
 * 完整的 GPS 提取流程
 * 
 * 策略：
 * 1. 先嘗試前端本地提取（免費、快速）
 * 2. 如果失敗，調用 ExifTools.com API
 * 3. 如果都失敗，引導用戶手動選擇
 */
export async function extractGPSWithFallback(
  uri: string,
  localExif?: any
): Promise<{
  gps: { latitude: number; longitude: number } | null;
  source: 'local' | 'exiftools-api' | 'manual';
}> {
  // 1. 嘗試本地提取
  if (localExif) {
    const localGPS = extractGpsFromExifObject(localExif);
    if (localGPS) {
      return { gps: localGPS, source: 'local' };
    }
  }
  
  // 2. 嘗試 ExifTools.com API
  try {
    const apiGPS = await extractGPSFromExifTools(uri);
    if (apiGPS) {
      return { gps: apiGPS, source: 'exiftools-api' };
    }
  } catch (error) {
    console.log('ExifTools API failed:', error);
  }
  
  // 3. 無法自動提取
  return { gps: null, source: 'manual' };
}

// 輔助函數：從本地 exif 對象提取
define function extractGpsFromExifObject(exif: any): { latitude: number; longitude: number } | null {
  if (!exif) return null;
  
  try {
    const gps = exif['{GPS}'] || exif.GPS;
    if (gps?.Latitude && gps?.Longitude) {
      let lat = gps.Latitude;
      let lng = gps.Longitude;
      if (gps.LatitudeRef === 'S') lat = -lat;
      if (gps.LongitudeRef === 'W') lng = -lng;
      return { latitude: lat, longitude: lng };
    }
  } catch (e) {}
  
  return null;
}
```

### 在 BirdSubmitScreen/FishSubmitScreen 中使用

```typescript
import { extractGPSWithFallback } from '../lib/exifToolsApi';

// 替換原來的 GPS 提取邏輯
async function handleImagePick() {
  const result = await ImagePicker.launchImageLibraryAsync({
    exif: true,
    // ...
  });
  
  for (const asset of result.assets) {
    // 使用新的提取流程
    const { gps, source } = await extractGPSWithFallback(
      asset.uri,
      asset.exif
    );
    
    if (gps) {
      console.log(`✅ GPS 找到，來源: ${source}`, gps);
      // 使用這個 GPS
    } else {
      console.log('❌ 無法自動提取 GPS，引導用戶手動選擇');
      // 引導用戶手動選擇
    }
  }
}
```

---

## ⚠️ 重要考慮因素

### 1. 隱私問題

使用第三方 API 上傳用戶照片：
- ⚠️ 照片數據會離開設備
- ⚠️ 需要遵守隱私法規（GDPR 等）
- ⚠️ 用戶可能不同意

**建議**：
```typescript
// 先詢問用戶是否同意上傳
Alert.alert(
  '提取位置',
  '需要上傳照片到第三方服務提取位置信息。是否同意？',
  [
    { text: '同意', onPress: () => useApiExtraction() },
    { text: '不同意，手動選擇', onPress: () => openMapPicker() }
  ]
);
```

### 2. 網絡依賴

- ❌ 需要網絡連接
- ❌ 可能比本地解析慢（上傳時間）
- ❌ API 服務可能宕機

### 3. 服務限制

| 服務 | 免費額度 | 文件大小限制 |
|-----|---------|------------|
| ExifTools.com | 無限制？ | 100MB |
| RapidAPI | 100-150/月 | 通常 5-10MB |

### 4. 服務穩定性

- ⚠️ 免費服務可能隨時更改條款或停止運營
- ⚠️ 建議有後備方案

---

## 📊 方案對比

| 方案 | 準確性 | 隱私 | 速度 | 成本 | 可靠性 |
|-----|--------|------|------|------|--------|
| 純前端 | 40-90% | ⭐⭐⭐ | ⭐⭐⭐ | 免費 | ⭐⭐⭐ |
| ExifTools.com | 85-95% | ⭐ | ⭐ | 免費 | ⭐⭐ |
| RapidAPI | 85-95% | ⭐ | ⭐ | 低 | ⭐⭐⭐ |
| Python 自建 | 95%+ | ⭐⭐⭐ | ⭐⭐ | 低 | ⭐⭐⭐⭐⭐ |
| 手動選擇 | 100% | ⭐⭐⭐ | ⭐⭐⭐ | 免費 | ⭐⭐⭐⭐⭐ |

---

## 💡 最終建議

### 推薦組合方案

```
1. 前端本地提取（首選）
   ↓ 失敗
2. ExifTools.com API（後備）
   ↓ 失敗或用戶拒絕
3. 引導用戶手動選擇（保證 100%）
```

這樣可以：
- 最大程度自動化
- 保護隱私（不強制上傳）
- 確保最終有位置（手動備份）
- 零成本或低成本
