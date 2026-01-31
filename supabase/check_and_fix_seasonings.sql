-- 조미료 확인 및 누락된 항목 추가

-- 1. 현재 등록된 조미료 확인
SELECT seasoning_name, position_code, base_unit 
FROM seasonings 
WHERE store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
ORDER BY position_code;

-- 2. 고추가루가 없으면 추가
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '고추가루',
  'SEASON_03',
  '조미료대 3번',
  'g'
WHERE NOT EXISTS (
  SELECT 1 FROM seasonings 
  WHERE seasoning_name = '고추가루' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 3. 설탕이 없으면 추가
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '설탕',
  'SEASON_04',
  '조미료대 4번',
  'g'
WHERE NOT EXISTS (
  SELECT 1 FROM seasonings 
  WHERE seasoning_name = '설탕' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 4. 간장이 없으면 추가
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '간장',
  'SEASON_05',
  '조미료대 5번',
  'g'
WHERE NOT EXISTS (
  SELECT 1 FROM seasonings 
  WHERE seasoning_name = '간장' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 5. 최종 확인
SELECT seasoning_name, position_code, base_unit 
FROM seasonings 
WHERE store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
ORDER BY position_code;
