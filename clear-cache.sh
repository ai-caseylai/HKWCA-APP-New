#!/bin/bash
# 完全清除所有緩存腳本

echo "🧹 開始清除所有緩存..."

# 1. 停止所有進程
echo "1. 停止所有 Expo/Node 進程..."
pkill -f expo 2>/dev/null || true
pkill -f node 2>/dev/null || true
sleep 2

# 2. 清除 Metro 緩存
echo "2. 清除 Metro 緩存..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true
rm -rf dist 2>/dev/null || true

# 3. 清除 React Native 緩存
echo "3. 清除 React Native 緩存..."
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true

# 4. 清除 Watchman
echo "4. 清除 Watchman 緩存..."
watchman watch-del-all 2>/dev/null || true

# 5. 清除 npm 緩存（可選）
# echo "5. 清除 npm 緩存..."
# npm cache clean --force 2>/dev/null || true

echo "✅ 緩存清除完成！"
echo ""
echo "請運行以下命令重新啟動:"
echo "  npx expo start --clear --tunnel"
