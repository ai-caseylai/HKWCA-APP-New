# HKWCA App - GPS 驗證完整方案

## 📋 方案概述

結合 **前端三重驗證** + **後端獨立解析** + **GPS 合理性驗證**，最大程度確保照片 GPS 的準確性。

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (App)                           │
├─────────────────────────────────────────────────────────────┤
│  1. ImagePicker exif 對象  ←── 最快，但可能不完整           │
│  2. FileSystem 文件解析    ←── 受限於 Android 10+           │
│  3. MediaLibrary 查詢      ←── iOS 效果好                   │
└────────────────────────┬────────────────────────────────────┘
                         │ 上傳照片 + 本地GPS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        後端 (Server)                         │
├─────────────────────────────────────────────────────────────┤
│  1. PIL/piexif EXIF 解析   ←── 最強大的解析庫               │
│  2. 前後端 GPS 交叉驗證    ←── 發現不一致                   │
│  3. GPS 合理性驗證         ←── 檢查是否在香港、默認坐標等   │
│  4. 圖片真實性驗證         ←── 檢查是否被編輯               │
│  5. 生成最終建議                                         │
└────────────────────────┬────────────────────────────────────┘
                         │ 返回驗證結果
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      用戶界面反饋                            │
├─────────────────────────────────────────────────────────────┤
│  ✅ auto_accept         → 自動接受，無需用戶干預            │
│  ⚠️  accept_with_warning → 顯示警告，但允許繼續             │
│  ❌ manual_verification → 強制手動選擇位置                  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 文件結構

```
HKWCA APP/
├── src/
│   ├── utils/
│   │   └── exifGpsParser.ts          # 前端 GPS 解析
│   └── lib/
│       └── gpsVerification.ts        # 後端驗證 API 調用
├── backend/
│   └── gps_verification_api.py       # Python 後端實現
├── backend-gps-strategy.md           # 後端策略文檔
└── GPS_VERIFICATION_COMPLETE_GUIDE.md # 本文檔
```

## 🚀 使用方式

### 1. 基本使用（已在前端集成）

```typescript
import { checkPhotoGPS } from './utils/exifGpsParser';

// 前端驗證
const result = await checkPhotoGPS(uri, asset.exif);

if (result.hasGPS) {
  console.log('找到 GPS:', result.gps);
} else {
  console.log('原因:', result.reason);
}
```

### 2. 後端驗證（推薦）

```typescript
import { verifyPhotoGPS } from './lib/gpsVerification';

// 上傳照片到後端驗證
const verification = await verifyPhotoGPS(
  photo.uri,
  photo.exifGps,  // App 端讀取的 GPS
  {
    expectedLocation: selectedPondLocation,  // 預期位置
    pondName: selectedPondName
  }
);

if (verification) {
  const { recommendation } = verification;
  
  switch (recommendation.action) {
    case 'auto_accept':
      // 自動接受後端 GPS
      photo.location = recommendation.useGps;
      break;
      
    case 'accept_with_warning':
      // 顯示警告但接受
      Alert.alert('位置警告', recommendation.reasons.join('\n'));
      photo.location = recommendation.useGps;
      break;
      
    case 'manual_verification':
      // 強制手動選擇
      openMapPicker();
      break;
  }
}
```

### 3. 批量驗證（提交前）

```typescript
import { batchVerifyPhotos } from './lib/gpsVerification';

// 提交前批量驗證
const batchResult = await batchVerifyPhotos(photos, {
  expectedLocation: selectedPondLocation
});

console.log(`已驗證: ${batchResult.verified}`);
console.log(`失敗: ${batchResult.failed}`);
console.log(`需手動: ${batchResult.needsManual}`);
```

## 🔍 驗證流程詳細說明

### 前端驗證流程

```
用戶選擇照片
    │
    ▼
┌───────────────────────┐
│ 1. 檢查 ImagePicker   │
│    返回的 exif 對象   │
└───────────┬───────────┘
            │ 有 GPS?
    ┌───────┴───────┐
   是               否
    │               │
    ▼               ▼
返回 GPS      ┌───────────────────┐
              │ 2. 嘗試讀取文件   │
              │    解析 EXIF      │
              └─────────┬─────────┘
                        │ 成功?
              ┌─────────┴─────────┐
             是                   否
              │                   │
              ▼                   ▼
        返回 GPS         ┌───────────────────┐
                       │ 3. 查詢 MediaStore│
                       │    系統媒體庫     │
                       └─────────┬─────────┘
                                 │ 成功?
                       ┌─────────┴─────────┐
                      是                   否
                       │                   │
                       ▼                   ▼
                 返回 GPS         返回失敗 + 原因
```

### 後端驗證流程

```
接收照片 + App GPS
    │
    ▼
┌──────────────────────────┐
│ 1. 後端獨立解析 EXIF     │
│    (PIL/piexif)          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 2. 交叉驗證              │
│    App GPS vs 後端 GPS   │
│    計算距離差異          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 3. 合理性驗證            │
│    • 是否在香港          │
│    • 是否默認坐標        │
│    • 與預期位置距離      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 4. 真實性驗證            │
│    • 是否被編輯          │
│    • EXIF 完整性         │
│    • 分辨率檢查          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 5. 生成建議              │
│    • auto_accept         │
│    • accept_with_warning │
│    • manual_verification │
└──────────────────────────┘
```

## 📊 準確率預估

| 場景 | 僅前端 | +後端驗證 | +用戶手動 |
|-----|--------|----------|----------|
| iOS 原生相機 | 90% | 95% | 100% |
| Android 原生相機 | 40% | 75% | 100% |
| 微信/WhatsApp | 20% | 40% | 100% |
| 被壓縮的照片 | 5% | 15% | 100% |

## ⚠️ 限制說明

即使結合後端驗證，仍然有以下限制：

### 無法解決的問題

1. **系統自動剝離 GPS**
   - 小米、OPPO、vivo、華為等手機會自動移除第三方 App 訪問的 EXIF GPS
   - 無論前端還是後端都無法讀取

2. **照片本身沒有 GPS**
   - 用戶拍照時沒開位置權限
   - 室內無 GPS 信號
   - 無法找回這些信息

3. **網絡傳輸壓縮**
   - 某些通訊軟件（微信）會在上傳時壓縮圖片並剝離 EXIF

### 後端驗證的優勢

1. **更強大的解析庫** (PIL/piexif)
2. **交叉驗證發現不一致**
3. **GPS 合理性檢查**（香港範圍、默認坐標等）
4. **圖片真實性驗證**

## 🔧 部署後端

### Supabase Edge Functions

```bash
# 1. 安裝 Supabase CLI
npm install -g supabase

# 2. 初始化
supabase init

# 3. 創建 Edge Function
supabase functions new gps-verification

# 4. 複製代碼到 functions/gps-verification/index.ts
# 5. 部署
supabase functions deploy gps-verification
```

### 獨立服務器（Python Flask）

```bash
# 1. 安裝依賴
pip install flask pillow piexif

# 2. 運行服務
python backend/gps_verification_api.py

# 3. 配置 API 端點到 App
# 修改 src/lib/gpsVerification.ts 中的 API_URL
```

## 📱 用戶體驗建議

### 方案 1: 輕量級（不上傳圖片）

只在前端驗證，後端只驗證 GPS 坐標：

```typescript
// 快速驗證（不上傳圖片）
const result = await verifyGPSOnly(
  photo.location,
  { expectedLocation: pondLocation }
);

if (!result.valid) {
  Alert.alert('位置問題', result.issues.join('\n'));
}
```

**優點**：省流量、速度快  
**缺點**：無法後端解析 EXIF

### 方案 2: 嚴格模式（推薦）

上傳圖片進行完整驗證：

```typescript
// 完整驗證
const result = await verifyPhotoGPS(uri, appGps, context);

if (result.recommendation.action === 'manual_verification') {
  // 強制手動選擇
  Alert.alert(
    '需要確認位置',
    result.recommendation.reasons.join('\n'),
    [{ text: '手動選擇', onPress: () => openMapPicker() }]
  );
}
```

**優點**：最準確  
**缺點**：消耗流量、較慢

## 📝 總結

| 方法 | 準確性 | 速度 | 流量 | 適用場景 |
|-----|--------|------|------|---------|
| 僅前端 | 中等 | 快 | 無 | 快速體驗 |
| +後端 GPS 驗證 | 高 | 快 | 低 | 推薦方案 |
| +後端圖片驗證 | 最高 | 慢 | 高 | 嚴格要求 |

**推薦方案**：
1. 前端優先嘗試讀取 GPS
2. 後端驗證 GPS 合理性
3. 如無法驗證，引導用戶手動選擇

這樣可以在 **準確性**、**速度**、**用戶體驗** 之間取得平衡。
