"""
HKWCA App - GPS 驗證 API

部署到 Supabase Edge Functions 或獨立服務器
"""

import json
import base64
import io
import math
import urllib.request
import urllib.error
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

def handler(req):
    """
    Supabase Edge Function 入口
    """
    try:
        body = req.json
        
        action = body.get('action', 'verify-photo-gps')
        
        if action == 'verify-photo-gps':
            return verify_photo_gps(body)
        elif action == 'verify-gps-only':
            return verify_gps_only(body)
        elif action == 'extract-gps-from-storage':
            return extract_gps_from_storage(body)
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Unknown action'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def verify_photo_gps(body):
    """
    驗證照片的 GPS
    """
    image_base64 = body.get('imageBase64')
    app_gps = body.get('appGps')
    context = body.get('context', {})
    
    if not image_base64:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing imageBase64'})
        }
    
    # 解碼圖片
    try:
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': f'Invalid image: {str(e)}'})
        }
    
    # 1. 後端獨立解析 EXIF GPS
    backend_gps = extract_gps_from_exif(image)
    
    # 2. GPS 交叉驗證
    consistency = verify_gps_consistency(app_gps, backend_gps)
    
    # 3. GPS 合理性驗證
    gps_to_validate = backend_gps or app_gps
    if gps_to_validate:
        validation = validate_gps_reasonableness(
            gps_to_validate['latitude'],
            gps_to_validate['longitude'],
            context
        )
    else:
        validation = {'valid': False, 'issues': ['no_gps_found']}
    
    # 4. 圖片真實性驗證
    authenticity = verify_image_authenticity(image)
    
    # 5. 生成建議
    recommendation = generate_recommendation(
        backend_gps, app_gps, consistency, validation, authenticity
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'backendGps': backend_gps,
            'consistency': consistency,
            'validation': validation,
            'authenticity': authenticity,
            'recommendation': recommendation
        })
    }

def verify_gps_only(body):
    """
    只驗證 GPS 坐標（不上傳圖片）
    """
    gps = body.get('gps')
    context = body.get('context', {})
    
    if not gps:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing gps'})
        }
    
    validation = validate_gps_reasonableness(
        gps['latitude'],
        gps['longitude'],
        context
    )
    
    # 檢查是否在香港
    in_hk = is_in_hong_kong(gps['latitude'], gps['longitude'])
    
    # 計算與預期位置的距離
    distance = None
    if context.get('expectedLocation'):
        distance = calculate_distance(
            gps['latitude'], gps['longitude'],
            context['expectedLocation']['latitude'],
            context['expectedLocation']['longitude']
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'valid': validation['valid'] and in_hk,
            'issues': validation['issues'],
            'inHongKong': in_hk,
            'distanceFromExpected': distance
        })
    }

def extract_gps_from_exif(image):
    """
    從圖片 EXIF 提取 GPS
    """
    try:
        exif = image._getexif()
        if not exif:
            return None
        
        # 查找 GPSInfo tag (34853)
        gps_info = None
        for tag_id, value in exif.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag == 'GPSInfo':
                gps_info = value
                break
        
        if not gps_info:
            return None
        
        # 解析 GPS
        def get_gps_coord(key, ref_key):
            if key not in gps_info:
                return None
            
            coord = gps_info[key]
            if isinstance(coord, tuple):
                # DMS 格式 (度, 分, 秒)
                degrees = coord[0] if isinstance(coord[0], (int, float)) else coord[0][0] / coord[0][1]
                minutes = coord[1] if isinstance(coord[1], (int, float)) else coord[1][0] / coord[1][1]
                seconds = coord[2] if isinstance(coord[2], (int, float)) else coord[2][0] / coord[2][1]
                decimal = degrees + minutes / 60 + seconds / 3600
            else:
                decimal = float(coord)
            
            # 應用方向
            ref = gps_info.get(ref_key, 'N')
            if ref in ['S', 'W']:
                decimal = -decimal
            
            return decimal
        
        lat = get_gps_coord(2, 1)  # GPSLatitude, GPSLatitudeRef
        lng = get_gps_coord(4, 3)  # GPSLongitude, GPSLongitudeRef
        
        if lat is None or lng is None:
            return None
        
        return {
            'latitude': lat,
            'longitude': lng,
            'source': 'exif-backend'
        }
        
    except Exception as e:
        print(f'EXIF extraction error: {e}')
        return None

def verify_gps_consistency(app_gps, backend_gps):
    """
    驗證 App 端和後端 GPS 的一致性
    """
    if not backend_gps:
        return {
            'status': 'no_exif_gps',
            'confidence': 'low',
            'message': 'Backend could not extract GPS from image'
        }
    
    if not app_gps:
        return {
            'status': 'app_missing',
            'confidence': 'medium',
            'message': 'App did not provide GPS'
        }
    
    # 計算距離差異
    distance = calculate_distance(
        app_gps['latitude'], app_gps['longitude'],
        backend_gps['latitude'], backend_gps['longitude']
    )
    
    if distance < 10:  # 10米內
        return {
            'status': 'consistent',
            'confidence': 'high',
            'distanceDiff': distance
        }
    elif distance < 100:  # 100米內
        return {
            'status': 'slight_diff',
            'confidence': 'medium',
            'distanceDiff': distance
        }
    else:
        return {
            'status': 'significant_diff',
            'confidence': 'low',
            'distanceDiff': distance
        }

def validate_gps_reasonableness(lat, lng, context):
    """
    驗證 GPS 合理性
    """
    issues = []
    
    # 1. 基本範圍檢查
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        issues.append('invalid_coordinates')
    
    # 2. 香港範圍檢查
    if not is_in_hong_kong(lat, lng):
        issues.append('outside_hong_kong')
    
    # 3. 與預期位置的距離
    if context.get('expectedLocation'):
        distance = calculate_distance(
            lat, lng,
            context['expectedLocation']['latitude'],
            context['expectedLocation']['longitude']
        )
        if distance > 1000:  # 超過 1 公里
            issues.append(f'far_from_expected:{distance:.0f}m')
        elif distance > 500:  # 超過 500 米
            issues.append(f'distant_from_expected:{distance:.0f}m')
    
    # 4. 檢查是否是默認坐標
    default_coords = [
        (0, 0),  # Null Island
        (22.3193, 114.1694),  # 香港中環
    ]
    for default_lat, default_lng in default_coords:
        if abs(lat - default_lat) < 0.001 and abs(lng - default_lng) < 0.001:
            issues.append('possible_default_coordinates')
    
    return {
        'valid': len(issues) == 0,
        'issues': issues
    }

def is_in_hong_kong(lat, lng):
    """
    檢查坐標是否在香港範圍內
    """
    # 香港大致範圍
    return (22.15 <= lat <= 22.55) and (113.80 <= lng <= 114.45)

def calculate_distance(lat1, lng1, lat2, lng2):
    """
    計算兩個 GPS 坐標之間的距離（米）
    使用 Haversine 公式
    """
    R = 6371000  # 地球半徑（米）
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def verify_image_authenticity(image):
    """
    驗證圖片真實性
    """
    warnings = []
    
    try:
        # 1. 檢查 EXIF 數據
        exif = image._getexif()
        if not exif:
            warnings.append('no_exif_data')
        else:
            # 檢查修改軟件
            software = exif.get(305, '')  # Software
            if software:
                software_lower = str(software).lower()
                editing_apps = ['photoshop', 'gimp', 'lightroom', 'snapseed', 'vsco', 'meitu']
                if any(app in software_lower for app in editing_apps):
                    warnings.append(f'edited_with:{software}')
            
            # 檢查修改時間
            modify_date = exif.get(306)
            create_date = exif.get(36867)
            if modify_date and create_date and modify_date != create_date:
                warnings.append('modified_after_capture')
        
        # 2. 檢查分辨率
        width, height = image.size
        if width < 1000 or height < 1000:
            warnings.append('low_resolution')
        
        # 3. 檢查文件格式
        if image.format not in ['JPEG', 'JPG', 'HEIC']:
            warnings.append(f'unusual_format:{image.format}')
            
    except Exception as e:
        warnings.append(f'analysis_error:{str(e)}')
    
    return {
        'modified': len(warnings) > 0,
        'warnings': warnings
    }

def generate_recommendation(backend_gps, app_gps, consistency, validation, authenticity):
    """
    生成最終建議
    """
    reasons = []
    confidence = 'low'
    action = 'manual_verification'
    use_gps = None
    
    # 決定使用哪個 GPS
    if consistency['status'] == 'consistent':
        # 前後端一致，使用後端（通常更準確）
        use_gps = backend_gps
        confidence = 'high'
    elif consistency['status'] == 'slight_diff':
        # 輕微差異，使用後端
        use_gps = backend_gps
        confidence = 'medium'
        reasons.append(f"前后端GPS差异: {consistency['distanceDiff']:.1f}米")
    elif consistency['status'] == 'app_missing':
        # App 端沒有，使用後端
        use_gps = backend_gps
        confidence = 'medium'
    elif consistency['status'] == 'no_exif_gps':
        # 後端讀不到，使用 App 端
        use_gps = app_gps
        confidence = 'low'
        reasons.append('后端无法从图片解析GPS')
    else:
        # 顯著差異
        use_gps = backend_gps  # 默認信任後端
        reasons.append(f"前后端GPS显著差异: {consistency['distanceDiff']:.1f}米")
    
    # 添加驗證問題
    reasons.extend(validation['issues'])
    
    # 添加真實性警告
    if authenticity['warnings']:
        reasons.extend(authenticity['warnings'])
    
    # 決定行動
    if (consistency['status'] in ['consistent', 'app_missing'] and 
        validation['valid'] and 
        len(authenticity['warnings']) <= 1):
        action = 'auto_accept'
    elif (consistency['status'] in ['consistent', 'slight_diff'] and
          len(validation['issues']) <= 1):
        action = 'accept_with_warning'
    else:
        action = 'manual_verification'
    
    return {
        'action': action,
        'confidence': confidence,
        'reasons': reasons,
        'useGps': use_gps
    }


# 本地測試
if __name__ == '__main__':
    # 測試用例
    test_cases = [
        {
            'name': 'Valid HK GPS',
            'gps': {'latitude': 22.3964, 'longitude': 114.1095},
            'expected': {'in_hk': True, 'valid': True}
        },
        {
            'name': 'Outside HK',
            'gps': {'latitude': 39.9042, 'longitude': 116.4074},  # Beijing
            'expected': {'in_hk': False, 'valid': False}
        },
        {
            'name': 'Null Island',
            'gps': {'latitude': 0, 'longitude': 0},
            'expected': {'in_hk': False, 'valid': False}
        }
    ]
    
    for test in test_cases:
        result = validate_gps_reasonableness(
            test['gps']['latitude'],
            test['gps']['longitude'],
            {}
        )
        in_hk = is_in_hong_kong(test['gps']['latitude'], test['gps']['longitude'])
        
        print(f"\nTest: {test['name']}")
        print(f"  GPS: {test['gps']}")
        print(f"  In HK: {in_hk} (expected: {test['expected']['in_hk']})")
        print(f"  Valid: {result['valid']} (expected: {test['expected']['valid']})")
        print(f"  Issues: {result['issues']}")
