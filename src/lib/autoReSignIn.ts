import { Alert } from 'react-native';

/**
 * 处理API调用中的401错误，自动尝试重新登入
 * @param error 捕获的错误
 * @param autoReSignIn 自动重新登入函数
 * @param signOut 登出函数
 * @param retryCallback 重新登入成功后的重试回调函数
 * @returns Promise<boolean> - 是否成功处理并重试
 */
export async function handleAuthError(
  error: unknown,
  autoReSignIn: () => Promise<{ success: boolean }>,
  signOut: () => Promise<void>,
  retryCallback?: () => Promise<void>
): Promise<boolean> {
  const errorMsg = error instanceof Error ? error.message : '請稍後再試';
  
  // 检查是否是认证错误
  if (!errorMsg.includes('登入憑證已過期') && !errorMsg.includes('401')) {
    // 不是认证错误，显示错误消息
    Alert.alert('載入失敗', errorMsg);
    return false;
  }

  // 尝试自动重新登入
  console.log('檢測到認證錯誤，嘗試自動重新登入...');
  const reSignInResult = await autoReSignIn();
  
  if (reSignInResult.success) {
    console.log('自動重新登入成功');
    
    // 如果提供了重试回调，执行它
    if (retryCallback) {
      try {
        await retryCallback();
        return true;
      } catch (retryError) {
        console.error('重試操作失敗:', retryError);
        Alert.alert('載入失敗', '自動重新登入後仍無法載入數據');
        return false;
      }
    }
    
    return true;
  } else {
    // 自动重新登入失败，显示提示并要求用户手动登入
    console.log('自動重新登入失敗，需要用戶手動登入');
    Alert.alert(
      '登入已過期',
      '您的登入憑證已過期，請重新登入',
      [
        {
          text: '重新登入',
          onPress: async () => {
            await signOut();
          },
        },
      ],
      { cancelable: false }
    );
    return false;
  }
}
