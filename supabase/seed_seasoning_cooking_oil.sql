-- 조미료대에 식용유 추가
-- Supabase SQL Editor에서 실행

INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
VALUES (
  (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1),
  '식용유',
  'SEASON_01',
  '조미료대 1번',
  'ml'
);
