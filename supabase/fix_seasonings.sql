-- 1단계: 현재 등록된 조미료 확인
SELECT seasoning_name, position_code 
FROM seasonings 
WHERE store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
ORDER BY position_code;

-- 2단계: 고추가루, 설탕, 간장이 있는지 확인
SELECT seasoning_name 
FROM seasonings 
WHERE store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
AND seasoning_name IN ('고추가루', '설탕', '간장');

-- 3단계: 없는 것만 추가 (position_code를 빈 번호로)
-- 고추가루
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '고추가루',
  'SEASON_06',
  '조미료대 6번',
  'g'
WHERE NOT EXISTS (
  SELECT 1 FROM seasonings 
  WHERE seasoning_name = '고추가루' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 설탕
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '설탕',
  'SEASON_07',
  '조미료대 7번',
  'g'
WHERE NOT EXISTS (
  SELECT 1 FROM seasonings 
  WHERE seasoning_name = '설탕' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 간장
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '간장',
  'SEASON_08',
  '조미료대 8번',
  'g'
WHERE NOT EXISTS (
  SELECT 1 FROM seasonings 
  WHERE seasoning_name = '간장' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 4단계: 최종 확인
SELECT seasoning_name, position_code, base_unit 
FROM seasonings 
WHERE store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
ORDER BY position_code;
