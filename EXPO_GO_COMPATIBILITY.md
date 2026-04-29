# Expo Go 兼容性說明

## ✅ ExifTools API 在 Expo Go 中的兼容性

### 支持的內容

| 功能 | Expo Go 支持 | 說明 |
|-----|-------------|------|
| `expo-file-system` | ✅ | 已經在項目中 |
| `FileSystem.readAsStringAsync` | ✅ | 支持 file:// 和 content:// URI |
| `FileSystem.EncodingType.Base64` | ✅ | 支持 base64 編碼 |
| `fetch` | ✅ | 全局可用 |
| `FormData` | ✅ | React Native 支持 |
| `Blob` | ✅ | 現代 RN 版本支持 |
| `atob` | ✅ | 全局可用 |

### 修改後的實現

為了兼容 Expo Go，代碼已經修改為：

```typescript
// ❌ 舊方法：在 React Native 中不工作
const response = await fetch(imageUri);  // imageUri 是 file://
const blob = await response.blob();

// ✅ 新方法：使用 expo-file-system
const base64 = await FileSystem.readAsStringAsync(imageUri, {
  encoding: FileSystem.EncodingType.Base64,
});
// ... 轉換為 blob
```

## ⚠️ 限制和注意事項

### 1. 網絡連接必需

```
ExifTools API 調用需要網絡
    │
    ├── ✅ WiFi 連接 - 正常工作
    ├── ✅ 4G/5G 連接 - 正常工作
    └── ❌ 離線模式 - 會失敗，回退到本地提取或手動選擇
```

### 2. 文件大小限制

| 限制來源 | 限制大小 | 說明 |
|---------|---------|------|
| ExifTools API | 100MB | 服務端限制 |
| Expo Go 內存 | ~50MB | 大文件可能導致 OOM |
| 網絡上傳 | 無限制 | 但大文件慢 |

**建議**: 如果圖片 > 10MB，跳過 API 調用，直接使用本地提取或手動選擇

### 3. 隱私提示

在 Expo Go 中使用時，每次調用 API 都會上傳照片。

建議添加用戶確認：

```typescript
Alert.alert(
  '提取位置信息',
  '需要上傳照片到線上服務提取 GPS 位置。照片會在處理後立即刪除。',
  [
    { text: '同意', onPress: () => callExifToolsAPI() },
    { text: '取消，手動選擇', onPress: () => openMapPicker() }
  ]
);
```

## 🧪 測試方法

### 在 Expo Go 中測試

```bash
# 1. 啟動 Expo Go
cd "/Users/apple/Desktop/development/hkwca-app-main/HKWCA APP"
npx expo start

# 2. 在手機上打開 Expo Go App

# 3. 選擇一張有 GPS 的照片

# 4. 查看日誌
# 預期輸出：
# ✅ 找到 GPS: {latitude: 22.3xxx, longitude: 114.1xxx} 來源: local
# 或
# ⚠️ 本地提取失敗，嘗試 ExifTools API...
# ✅ ExifTools API 找到 GPS: {latitude: 22.3xxx, longitude: 114.1xxx}
```

## 📱 平台差異

### iOS

```
ImagePicker 返回: file:///var/mobile/.../photo.jpg
    │
    ├── ✅ FileSystem.readAsStringAsync 可以讀取
    ├── ✅ Base64 編碼正常工作
    └── ✅ FormData + Blob 上傳正常工作
```

### Android

```
ImagePicker 返回: content://media/external/images/media/12345
    │
    ├── ✅ FileSystem.readAsStringAsync 可以讀取（Expo SDK 處理）
    ├── ✅ Base64 編碼正常工作
    └── ✅ FormData + Blob 上傳正常工作
```

## 🔧 故障排除

### 問題 1: "Network request failed"

**原因**: 網絡連接問題或 API 服務不可用

**解決**:
```typescript
// 添加錯誤處理，自動回退
try {
  const gps = await extractGPSFromExifTools(uri);
} catch (error) {
  console.log('API 失敗，使用本地提取');
  // 回退到本地提取
}
```

### 問題 2: "File not found"

**原因**: URI 格式不正確或文件已刪除

**解決**:
```typescript
// 檢查文件是否存在
const fileInfo = await FileSystem.getInfoAsync(uri);
if (!fileInfo.exists) {
  console.log('文件不存在');
  return null;
}
```

### 問題 3: 內存不足 (OOM)

**原因**: 圖片太大，讀取 base64 時耗盡內存

**解決**:
```typescript
// 檢查文件大小
const fileInfo = await FileSystem.getInfoAsync(uri);
if (fileInfo.size > 10 * 1024 * 1024) { // > 10MB
  console.log('文件太大，跳過 API 調用');
  return null;
}
```

## ✅ 總結

**ExifTools API 完全兼容 Expo Go**！

需要的條件：
- ✅ 網絡連接
- ✅ `expo-file-system` 權限（已配置）
- ✅ 用戶同意上傳照片（建議）

不需要：
- ❌ 原生模塊
- ❌ EAS Build
- ❌ 額外安裝
