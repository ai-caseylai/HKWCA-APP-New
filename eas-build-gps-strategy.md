# EAS Build GPS 讀取策略

## 最佳方案組合

### 方案 1: 使用原生 EXIF 庫（推薦）

安裝 `react-native-exif` 或類似原生庫：

```bash
npx expo install react-native-exif
```

這些庫使用 Android/iOS 原生代碼讀取 EXIF，比 JavaScript 解析更可靠。

### 方案 2: 複製到 Cache 目錄後讀取

在 EAS Build 中，可以將 content:// URI 複製到 App 的 cache 目錄，然後完整讀取：

```typescript
async function copyAndReadGPS(uri: string) {
  try {
    // 複製到 cache 目錄
    const cacheUri = FileSystem.cacheDirectory + 'temp_' + Date.now() + '.jpg';
    await FileSystem.copyAsync({ from: uri, to: cacheUri });
    
    // 現在可以完整讀取文件
    const base64 = await FileSystem.readAsStringAsync(cacheUri, {
      encoding: 'base64'
    });
    
    // 解析 EXIF
    const gps = await parseExifGpsFromBase64(base64);
    
    // 清理
    await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    
    return gps;
  } catch (error) {
    return null;
  }
}
```

### 方案 3: 使用 Android MediaStore API（最佳）

在 EAS Build 中可以使用 `expo-modules-core` 編寫原生模塊，
直接調用 Android MediaStore API：

```kotlin
// Android 原生代碼
val projection = arrayOf(MediaStore.Images.Media.LATITUDE, MediaStore.Images.Media.LONGITUDE)
contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
    if (cursor.moveToFirst()) {
        val lat = cursor.getDouble(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.LATITUDE))
        val lng = cursor.getDouble(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.LONGITUDE))
        // 返回 lat, lng
    }
}
```

## 現實的準確率預估

| 場景 | Expo Go | EAS Build |
|-----|---------|-----------|
| iOS 照片 | 90% | 95% |
| Android 原生相機 | 40% | 75% |
| 第三方 App 分享的照片 | 20% | 40% |
| 被壓縮的照片 | 5% | 10% |

## 最終建議

**不要依賴 100% 自動讀取**，而是：

1. **嘗試自動讀取**（EAS Build + 原生模塊）
2. **明確告知用戶結果**
   - ✅ "已從照片讀取位置"
   - ⚠️ "照片無位置信息，請手動選擇"
3. **提供手動選擇**（地圖選點）

這樣的用戶體驗最好，因為即使技術上讀取不到，用戶也能理解並補充信息。
