-- 필요한 조미료 추가
-- Supabase SQL Editor에서 실행하세요

-- 고추가루, 설탕이 없으면 추가
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
VALUES 
  (
    (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
    '고추가루',
    'SEASON_03',
    '조미료대 3번',
    'g'
  ),
  (
    (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
    '설탕',
    'SEASON_04',
    '조미료대 4번',
    'g'
  )
ON CONFLICT DO NOTHING;

-- 간장이 없으면 추가
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
VALUES (
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '간장',
  'SEASON_05',
  '조미료대 5번',
  'g'
)
ON CONFLICT DO NOTHING;
