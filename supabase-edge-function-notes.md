# Supabase Edge Functions GPS 驗證 - 真實情況

## ⚠️ 重要限制

Supabase Edge Functions 使用 **Deno 運行時**（JavaScript/TypeScript），**不支持 Python**。

這意味著：
- ❌ 無法直接使用 `PIL` (Pillow)
- ❌ 無法直接使用 `piexif`
- ✅ 需要使用 JavaScript/TypeScript 的 EXIF 庫

## Supabase Edge Function 實現

```typescript
// supabase/functions/gps-verification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// 使用 JS EXIF 庫（功能比 Python PIL 弱）
import * as exifReader from 'https://esm.sh/exifreader@4.13.0'

serve(async (req) => {
  try {
    const { imageBase64, appGps, context } = await req.json()
    
    // 解碼圖片
    const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
    
    // 解析 EXIF（JS 庫功能較弱）
    const tags = await exifReader.load(imageBuffer)
    
    const backendGps = extractGpsFromTags(tags)
    
    // 其他驗證邏輯...
    const result = {
      backendGps,
      consistency: verifyConsistency(appGps, backendGps),
      validation: validateGps(backendGps, context),
      recommendation: generateRecommendation(backendGps, appGps)
    }
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function extractGpsFromTags(tags: any) {
  // JS EXIF 庫返回的格式與 Python 不同
  const gps = tags.GPSInfo || tags.gps
  
  if (!gps) return null
  
  // 需要手動解析 DMS 格式
  // JS 庫的解析能力比 Python PIL 弱
  
  return {
    latitude: parseFloat(gps.GPSLatitude?.description),
    longitude: parseFloat(gps.GPSLongitude?.description),
    source: 'exif-js'
  }
}
```

## 準確性對比

| 功能 | Python PIL | JS exifreader | Deno Sharp |
|-----|------------|---------------|------------|
| JPEG EXIF | ✅ 完整 | ⚠️ 部分 | ✅ 完整 |
| HEIC 支持 | ✅ 支持 | ❌ 不支持 | ⚠️ 有限 |
| RAW 格式 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| DMS 解析 | ✅ 準確 | ⚠️ 可能出錯 | ✅ 準確 |
| GPS 精度 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

## 真實準確率預估

### Supabase Edge Function (JS)

| 場景 | 僅前端 | +Supabase Edge | 提升 |
|-----|--------|----------------|------|
| iOS JPEG | 90% | 92% | +2% |
| Android JPEG | 40% | 60% | +20% |
| HEIC | 30% | 30% | 0% |
| 壓縮圖片 | 20% | 25% | +5% |

### 為什麼提升有限？

1. **JS EXIF 庫功能較弱**
   - 不支持某些非標準 EXIF 格式
   - 對 DMS 格式的解析可能出錯
   - 不支持 HEIC 格式（iPhone 默認格式）

2. **Deno 環境限制**
   - 無法使用成熟的 Python 生態
   - 某些原生庫不可用

## 更好的後端選擇

### 選項 1: Python 服務器（推薦準確性）

```
Vercel Functions (Python)
AWS Lambda (Python)  
Google Cloud Functions (Python)
獨立 VPS
```

**準確性**: ⭐⭐⭐⭐⭐ (95%+)

### 選項 2: Supabase + Python（通過 HTTP）

```
App → Supabase Edge Function (Deno)
    → 調用外部 Python API
    → 返回結果
```

**準確性**: ⭐⭐⭐⭐⭐ (95%+)
**缺點**: 延遲增加

### 選項 3: 純 Supabase Edge Function

**準確性**: ⭐⭐⭐ (60-70%)
**優點**: 簡單、快速、免費額度高

## 建議方案

### 如果追求準確性：使用 Python 後端

部署到支持 Python 的服務：
- Vercel Serverless Functions (Python)
- AWS Lambda
- Google Cloud Run

### 如果追求簡單：純前端 + 手動選擇

```typescript
// 前端盡力而為
const result = await checkPhotoGPS(uri, exif);

if (!result.hasGPS) {
  // 直接讓用戶手動選擇
  Alert.alert(
    '無法讀取位置',
    '請在下方地圖選擇拍攝位置',
    [{ text: '選擇位置', onPress: () => openMapPicker() }]
  );
}
```

**準確性**: 100%（因為強制用戶確認）

## 結論

| 方案 | 準確性 | 複雜度 | 成本 | 推薦度 |
|-----|--------|--------|------|--------|
| 純前端 | 40-90% | ⭐ | 免費 | ⭐⭐⭐ |
| Supabase Edge (JS) | 60-70% | ⭐⭐ | 免費 | ⭐⭐ |
| Python 後端 | 95%+ | ⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ |
| 純前端 + 強制手動 | 100% | ⭐ | 免費 | ⭐⭐⭐⭐ |

**最誠實的建議**：
- 如果技術能力允許 → **Python 後端**
- 如果追求簡單可靠 → **純前端 + 強制手動選擇**
- Supabase Edge Functions 的性價比不高（比純前端好不了多少）
