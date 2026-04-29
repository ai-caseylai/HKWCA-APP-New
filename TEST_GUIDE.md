# GPS 功能測試指南

## 📱 測試 Expo Go

### 步驟 1: 啟動 Expo 服務

```bash
cd "/Users/apple/Desktop/development/hkwca-app-main/HKWCA APP"
npx expo start
```

### 步驟 2: 打開 Expo Go App

在 iPhone 或 Android 手機上：
1. 安裝 **Expo Go** App（App Store / Play Store）
2. 掃描終端顯示的 **QR Code**

### 步驟 3: 測試 GPS 提取

#### 測試 A: 拍攝照片（相機）

1. 進入 App 的提交頁面
2. 點擊「相機」拍攝一張照片
3. 確保手機 GPS 已開啟
4. 查看終端日誌輸出：
   ```
   ✅ 找到 GPS: {latitude: 22.3xxx, longitude: 114.1xxx} 來源: local
   ```

#### 測試 B: 選擇相冊照片

1. 進入提交頁面
2. 點擊「相冊」選擇一張有 GPS 的照片
3. 查看日誌：
   - 如果本地成功：`✅ 找到 GPS: ... 來源: local`
   - 如果本地失敗但 API 成功：`✅ ExifTools API 找到 GPS: ...`
   - 如果都失敗：`⚠️ 無法自動提取 GPS`

### 步驟 4: 查看網絡請求（調試）

```bash
# 在另一個終端窗口監控網絡請求
cd "/Users/apple/Desktop/development/hkwca-app-main/HKWCA APP"
npx expo start --lan
```

然後在 Chrome DevTools 中查看 Network 請求。

## 🔍 常見問題排查

### 問題 1: "⚠️ 本地提取失敗，嘗試 ExifTools API..."

這是正常現象，表示前端無法讀取 GPS，正在嘗試 API。

**檢查點**:
- 手機是否有網絡連接？
- 查看是否顯示 `✅ ExifTools API 找到 GPS`

### 問題 2: "Network request failed"

API 調用失敗。

**解決**:
1. 檢查網絡連接
2. 檢查 ExifTools.com 是否可訪問：`ping exiftools.com`

### 問題 3: 沒有任何 GPS 日誌

**檢查**:
1. 查看終端是否顯示紅色錯誤
2. 檢查 `src/screens/BirdSubmitScreen.tsx` 是否已導入 `exifToolsApi`
3. 重新加載 App：按 `r` 鍵（在終端中）

## 🧪 自動測試腳本

創建一個簡單的測試腳本：

```typescript
// 在 App.tsx 或任意頁面添加測試按鈕

import { extractGPSWithFallback } from './src/lib/exifToolsApi';

// 測試函數
async function testGPSExtraction() {
  // 使用一張測試圖片
  const testUri = 'file:///path/to/test/photo.jpg';
  
  console.log('=== GPS 提取測試開始 ===');
  
  // 測試本地提取
  const localResult = await extractGPSWithFallback(testUri, { useApi: false });
  console.log('本地提取結果:', localResult);
  
  // 測試 API 提取
  const apiResult = await extractGPSWithFallback(testUri, { useApi: true });
  console.log('API 提取結果:', apiResult);
  
  console.log('=== 測試結束 ===');
}
```

## 📊 預期結果

| 場景 | 預期輸出 |
|------|---------|
| iOS 原生相機照片 | `✅ 找到 GPS: ... 來源: local` |
| Android 原生相機 | `✅ 找到 GPS: ... 來源: local` 或 `✅ ExifTools API...` |
| 微信/WhatsApp 圖片 | `✅ ExifTools API...` 或 `⚠️ 無法自動提取` |
| 無 GPS 照片 | `⚠️ 無法自動提取 GPS` |

## 🆘 仍然有問題？

如果測試失敗，請收集以下信息：

1. **終端日誌**（複製粘貼）
2. **手機型號和系統版本**（如：iPhone 14, iOS 17）
3. **照片來源**（相機拍攝 / 相冊選擇 / 微信保存）

然後我可以幫您進一步排查！
