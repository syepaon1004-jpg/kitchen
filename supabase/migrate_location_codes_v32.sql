-- ============================================================
-- Phase 3 마이그레이션: location_code 네이밍 규칙 통일
-- 기존: DRAWER_LT, FRIDGE_LT, FRIDGE_LT_F1 (번호 없음)
-- 신규: DRAWER_1_LT, FRIDGE_1_LT, FRIDGE_1_LT_F1 (항상 번호 포함)
--
-- ⚠️ 이 스크립트는 기존 데이터가 있는 매장에서만 실행.
-- 새 매장은 Phase 3 어드민에서 자동으로 올바른 코드 생성.
-- ============================================================

-- 1. storage_locations 코드 업데이트

-- DRAWER (번호 없음 → _1_ 삽입)
UPDATE storage_locations
SET location_code = 'DRAWER_1_LT'
WHERE location_code = 'DRAWER_LT';

UPDATE storage_locations
SET location_code = 'DRAWER_1_RT'
WHERE location_code = 'DRAWER_RT';

UPDATE storage_locations
SET location_code = 'DRAWER_1_LB'
WHERE location_code = 'DRAWER_LB';

UPDATE storage_locations
SET location_code = 'DRAWER_1_RB'
WHERE location_code = 'DRAWER_RB';

-- FRIDGE 부모 (번호 없음 → _1_ 삽입)
UPDATE storage_locations
SET location_code = 'FRIDGE_1_LT'
WHERE location_code = 'FRIDGE_LT';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_RT'
WHERE location_code = 'FRIDGE_RT';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_LB'
WHERE location_code = 'FRIDGE_LB';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_RB'
WHERE location_code = 'FRIDGE_RB';

-- FRIDGE_FLOOR 자식 (부모 코드 변경에 맞춰)
UPDATE storage_locations
SET location_code = 'FRIDGE_1_LT_F1'
WHERE location_code = 'FRIDGE_LT_F1';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_LT_F2'
WHERE location_code = 'FRIDGE_LT_F2';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_RT_F1'
WHERE location_code = 'FRIDGE_RT_F1';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_RT_F2'
WHERE location_code = 'FRIDGE_RT_F2';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_LB_F1'
WHERE location_code = 'FRIDGE_LB_F1';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_LB_F2'
WHERE location_code = 'FRIDGE_LB_F2';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_RB_F1'
WHERE location_code = 'FRIDGE_RB_F1';

UPDATE storage_locations
SET location_code = 'FRIDGE_1_RB_F2'
WHERE location_code = 'FRIDGE_RB_F2';

-- SEASONING
UPDATE storage_locations
SET location_code = 'SEASONING_1'
WHERE location_code = 'SEASONING_COUNTER';

-- FREEZER
UPDATE storage_locations
SET location_code = 'FREEZER_1'
WHERE location_code = 'FREEZER_MAIN';

-- 2. kitchen_equipment의 storage_location_ids 업데이트
-- (equipment_type별로 새 코드 배열 적용)

UPDATE kitchen_equipment
SET storage_location_ids = ARRAY['DRAWER_1_LT', 'DRAWER_1_RT', 'DRAWER_1_LB', 'DRAWER_1_RB']
WHERE equipment_type = 'DRAWER_FRIDGE'
  AND (storage_location_ids @> ARRAY['DRAWER_LT'] OR storage_location_ids IS NULL);

UPDATE kitchen_equipment
SET storage_location_ids = ARRAY['FRIDGE_1_LT', 'FRIDGE_1_RT', 'FRIDGE_1_LB', 'FRIDGE_1_RB']
WHERE equipment_type = 'FRIDGE_4BOX'
  AND (storage_location_ids @> ARRAY['FRIDGE_LT'] OR storage_location_ids IS NULL);

UPDATE kitchen_equipment
SET storage_location_ids = ARRAY['SEASONING_1']
WHERE equipment_type = 'SEASONING_COUNTER'
  AND (storage_location_ids @> ARRAY['SEASONING_COUNTER'] OR storage_location_ids IS NULL);

UPDATE kitchen_equipment
SET storage_location_ids = ARRAY['FREEZER_1']
WHERE equipment_type = 'FREEZER'
  AND (storage_location_ids @> ARRAY['FREEZER_MAIN'] OR storage_location_ids IS NULL);

-- 3. 검증 쿼리 (실행 후 결과 확인)
-- SELECT location_code, location_type FROM storage_locations ORDER BY location_code;
-- SELECT equipment_type, storage_location_ids FROM kitchen_equipment WHERE storage_location_ids IS NOT NULL;
