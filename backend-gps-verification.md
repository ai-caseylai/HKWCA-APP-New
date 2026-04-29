# 後端 GPS 驗證方案

## 架構流程

```
App 端                    後端                    外部服務
  │                        │                        │
  │ 1. 選擇照片            │                        │
  │ 2. 嘗試本地讀取 GPS    │                        │
  │ 3. 上傳照片 + 本地GPS  │                        │
  │ ─────────────────────> │                        │
  │                        │ 4. 後端獨立解析 EXIF   │
  │                        │ 5. 對比 App 端 GPS     │
  │                        │ 6. 驗證 GPS 合理性     │
  │                        │ 7. 返回驗證結果        │
  │ <───────────────────── │                        │
  │ 8. 如有差異，提示用戶  │                        │
```

## 方案 1: 後端 EXIF 解析（推薦）

### 後端代碼（Python/Node.js）

後端使用專業的 EXIF 庫（比前端 JavaScript 更強大）：

```python
# Python 後端示例
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import piexif

def extract_gps_from_image(image_bytes):
    """
    使用 PIL + piexif 解析 EXIF GPS
    比前端 JavaScript 更準確、更完整
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # 方法 1: 使用 PIL
        exif = img._getexif()
        if exif:
            gps_info = exif.get(34853)  # GPSInfo tag
            if gps_info:
                lat = convert_to_degrees(gps_info[2])
                lng = convert_to_degrees(gps_info[4])
                if gps_info[1] == 'S': lat = -lat
                if gps_info[3] == 'W': lng = -lng
                return {'lat': lat, 'lng': lng, 'source': 'pil'}
        
        # 方法 2: 使用 piexif（更詳細）
        exif_dict = piexif.load(image_bytes)
        gps_ifd = exif_dict.get('GPS', {})
        
        if gps_ifd:
            lat = convert_dms_to_decimal(gps_ifd)
            lng = convert_dms_to_decimal(gps_ifd)
            return {'lat': lat, 'lng': lng, 'source': 'piexif'}
            
        return None
    except Exception as e:
        return {'error': str(e)}
```

```javascript
// Node.js 後端示例
const exifParser = require('exif-parser');
const sharp = require('sharp');

async function extractGPSFromImage(imageBuffer) {
  try {
    // 方法 1: exif-parser（快速）
    const parser = exifParser.create(imageBuffer);
    const result = parser.parse();
    
    if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
      return {
        lat: result.tags.GPSLatitude,
        lng: result.tags.GPSLongitude,
        source: 'exif-parser'
      };
    }
    
    // 方法 2: sharp（強大，支持更多格式）
    const metadata = await sharp(imageBuffer).metadata();
    if (metadata.exif) {
      const exif = await sharp(imageBuffer).exif();
      // 解析 exif...
    }
    
    return null;
  } catch (error) {
    return { error: error.message };
  }
}
```

## 方案 2: GPS 交叉驗證

後端比對 App 端和獨立解析的 GPS：

```python
def verify_gps_consistency(app_gps, backend_gps):
    """
    驗證兩個 GPS 是否一致
    """
    if not backend_gps:
        return {'status': 'no_exif_gps', 'recommendation': 'use_app_gps'}
    
    if not app_gps:
        return {'status': 'app_missing', 'recommendation': 'use_backend_gps'}
    
    # 計算距離差異
    distance = calculate_distance(
        app_gps['lat'], app_gps['lng'],
        backend_gps['lat'], backend_gps['lng']
    )
    
    if distance < 10:  # 10米內視為一致
        return {
            'status': 'consistent',
            'confidence': 'high',
            'distance_diff': distance
        }
    elif distance < 100:  # 100米內可能是精度問題
        return {
            'status': 'slight_diff',
            'confidence': 'medium',
            'distance_diff': distance,
            'recommendation': 'use_backend_gps'  # 後端解析通常更準確
        }
    else:
        return {
            'status': 'significant_diff',
            'confidence': 'low',
            'distance_diff': distance,
            'recommendation': 'manual_verification'  # 需要人工確認
        }
```

## 方案 3: GPS 合理性驗證

驗證 GPS 是否在合理範圍內：

```python
def validate_gps_reasonableness(lat, lng, context):
    """
    驗證 GPS 是否合理
    """
    issues = []
    
    # 1. 基本範圍檢查
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        issues.append('invalid_coordinates')
    
    # 2. 香港範圍檢查（假設項目在香港）
    HK_BOUNDS = {
        'lat_min': 22.15, 'lat_max': 22.55,
        'lng_min': 113.80, 'lng_max': 114.45
    }
    
    if not (HK_BOUNDS['lat_min'] <= lat <= HK_BOUNDS['lat_max'] and
            HK_BOUNDS['lng_min'] <= lng <= HK_BOUNDS['lng_max']):
        issues.append('outside_hk')
    
    # 3. 是否在指定的魚塘/濕地範圍內
    if context.get('expected_location'):
        distance = calculate_distance(
            lat, lng,
            context['expected_location']['lat'],
            context['expected_location']['lng']
        )
        if distance > 500:  # 超過 500 米
            issues.append(f'far_from_expected_location:{distance:.0f}m')
    
    # 4. 檢查是否是默認/測試坐標
    default_coords = [
        (0, 0),  #  null island
        (22.3193, 114.1694),  # 香港中環（可能是默認）
    ]
    for default_lat, default_lng in default_coords:
        if abs(lat - default_lat) < 0.001 and abs(lng - default_lng) < 0.001:
            issues.append('possible_default_coordinates')
    
    return {
        'valid': len(issues) == 0,
        'issues': issues
    }
```

## 方案 4: 圖片真實性驗證

驗證圖片是否被修改過：

```python
def verify_image_authenticity(image_bytes):
    """
    驗證圖片真實性
    """
    result = {
        'modified': False,
        'warnings': []
    }
    
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # 1. 檢查 EXIF 完整性
        exif = img._getexif()
        if not exif:
            result['warnings'].append('no_exif_data')
        else:
            # 2. 檢查軟件修改痕跡
            software = exif.get(305, '')  # Software tag
            if software and any(s in software.lower() for s in 
                ['photoshop', 'gimp', 'lightroom', 'snapseed']):
                result['warnings'].append(f'edited_with:{software}')
            
            # 3. 檢查修改時間
            modify_date = exif.get(306)  # ModifyDate
            create_date = exif.get(36867)  # DateTimeOriginal
            if modify_date and create_date and modify_date != create_date:
                result['warnings'].append('modified_after_capture')
        
        # 4. 檢查圖片尺寸（壓縮後通常變小）
        width, height = img.size
        if width < 1000 or height < 1000:
            result['warnings'].append('low_resolution_possible_compression')
            
    except Exception as e:
        result['warnings'].append(f'analysis_error:{str(e)}')
    
    return result
```

## 完整的後端 API

```python
@app.route('/api/verify-photo', methods=['POST'])
def verify_photo():
    """
    完整的照片驗證 API
    """
    # 接收數據
    image_file = request.files.get('photo')
    app_gps = request.form.get('app_gps')  # App 端讀取的 GPS
    context = request.form.get('context', {})  # 上下文（預期位置等）
    
    image_bytes = image_file.read()
    
    # 1. 後端獨立解析 EXIF
    backend_gps = extract_gps_from_image(image_bytes)
    
    # 2. GPS 交叉驗證
    consistency = verify_gps_consistency(
        json.loads(app_gps) if app_gps else None,
        backend_gps
    )
    
    # 3. GPS 合理性驗證
    if backend_gps:
        validation = validate_gps_reasonableness(
            backend_gps['lat'], 
            backend_gps['lng'],
            json.loads(context)
        )
    else:
        validation = {'valid': False, 'issues': ['no_gps_found']}
    
    # 4. 圖片真實性驗證
    authenticity = verify_image_authenticity(image_bytes)
    
    # 5. 綜合建議
    recommendation = generate_recommendation(
        consistency, validation, authenticity
    )
    
    return jsonify({
        'backend_gps': backend_gps,
        'consistency_check': consistency,
        'validation': validation,
        'authenticity': authenticity,
        'recommendation': recommendation,
        'final_gps': recommendation.get('use_gps')
    })

def generate_recommendation(consistency, validation, authenticity):
    """
    生成最終建議
    """
    recommendation = {
        'action': 'manual_verification',  # 默認需要人工確認
        'confidence': 'low',
        'reasons': []
    }
    
    # 高置信度情況
    if (consistency['status'] == 'consistent' and 
        validation['valid'] and 
        len(authenticity['warnings']) == 0):
        recommendation['action'] = 'auto_accept'
        recommendation['confidence'] = 'high'
        recommendation['use_gps'] = consistency.get('backend_gps')
    
    # 中等置信度
    elif (consistency['status'] in ['consistent', 'slight_diff'] and
          len(validation['issues']) <= 1):
        recommendation['action'] = 'accept_with_warning'
        recommendation['confidence'] = 'medium'
        recommendation['use_gps'] = consistency.get('backend_gps')
        recommendation['reasons'].extend(validation['issues'])
    
    # 低置信度 - 需要人工確認
    else:
        recommendation['reasons'].extend(validation['issues'])
        recommendation['reasons'].extend(authenticity['warnings'])
    
    return recommendation
```

## App 端調用

```typescript
async function uploadPhotoWithVerification(photo: LocalPhoto) {
  const formData = new FormData();
  formData.append('photo', {
    uri: photo.uri,
    type: 'image/jpeg',
    name: 'photo.jpg'
  } as any);
  
  // 發送 App 端讀取的 GPS
  formData.append('app_gps', JSON.stringify(photo.exifGps || photo.location));
  
  // 發送上下文（預期位置等）
  formData.append('context', JSON.stringify({
    expected_location: selectedPondLocation,
    timestamp: Date.now()
  }));
  
  const response = await fetch(`${API_URL}/verify-photo`, {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  
  // 處理後端返回的建議
  switch (result.recommendation.action) {
    case 'auto_accept':
      // 自動接受後端 GPS
      photo.location = result.final_gps;
      break;
      
    case 'accept_with_warning':
      // 顯示警告但接受
      Alert.alert(
        '位置警告',
        `發現以下問題：\n${result.recommendation.reasons.join('\n')}`,
        [
          { text: '使用系統位置', onPress: () => photo.location = result.final_gps },
          { text: '手動選擇', onPress: () => openMapPicker() }
        ]
      );
      break;
      
    case 'manual_verification':
      // 強制人工確認
      Alert.alert(
        '需要確認位置',
        `無法自動驗證照片位置。原因：\n${result.recommendation.reasons.join('\n')}`,
        [
          { text: '手動選擇位置', onPress: () => openMapPicker() }
        ]
      );
      break;
  }
}
```

## 優缺點分析

| 方案 | 優點 | 缺點 |
|-----|------|------|
| 後端 EXIF 解析 | 更準確、支持更多格式 | 需要上傳整張圖片，消耗流量 |
| GPS 交叉驗證 | 發現前後端不一致 | 增加 API 調用時間 |
| GPS 合理性驗證 | 防止錯誤數據 | 需要維護地理數據 |
| 圖片真實性驗證 | 發現修改痕跡 | 無法 100% 檢測 |

## 推薦組合

**輕量級方案**：後端 EXIF 解析 + GPS 交叉驗證
**嚴格方案**：全部四種驗證都做
