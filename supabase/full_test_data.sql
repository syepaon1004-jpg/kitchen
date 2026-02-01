-- =============================================
-- 전체 데이터 초기화 및 테스트 데이터 생성
-- =============================================

-- 1. 기존 데이터 삭제 (역순)
DELETE FROM recipe_ingredients;
DELETE FROM recipe_steps;
DELETE FROM recipes;
DELETE FROM ingredients_inventory;
DELETE FROM ingredients_master;
DELETE FROM seasonings;
DELETE FROM storage_locations WHERE location_type IN ('DRAWER', 'FRIDGE', 'FRIDGE_FLOOR', 'SEASONING');

-- 2. ingredients_master 추가
INSERT INTO ingredients_master (ingredient_name, ingredient_name_en, category, base_unit)
VALUES 
  ('양파', 'Onion', '채소', 'g'),
  ('다진김치', 'Chopped Kimchi', '채소', 'g'),
  ('당근', 'Carrot', '채소', 'g'),
  ('애호박', 'Zucchini', '채소', 'g'),
  ('밥', 'Rice', '곡물', 'g'),
  ('새우', 'Shrimp', '해산물', 'ea'),
  ('계란', 'Egg', '계란', 'ea');

-- 3. storage_locations 추가

-- 서랍냉장고 (4x2 그리드)
INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, position_order)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001'),
  'DRAWER',
  code,
  name,
  4,
  2,
  false,
  ord
FROM (VALUES 
  ('DRAWER_LT', '서랍 왼쪽 위', 1),
  ('DRAWER_RT', '서랍 오른쪽 위', 2),
  ('DRAWER_LB', '서랍 왼쪽 아래', 3),
  ('DRAWER_RB', '서랍 오른쪽 아래', 4)
) AS t(code, name, ord);

-- 4호박스 메인 (2x2)
INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, floor_count, position_order)
SELECT 
  (SELECT id FROM stores WHERE store_code = 'MARKET001'),
  'FRIDGE',
  code,
  name,
  2,
  2,
  true,
  2,
  ord
FROM (VALUES 
  ('FRIDGE_LT', '냉장고 왼쪽 위', 1),
  ('FRIDGE_RT', '냉장고 오른쪽 위', 2),
  ('FRIDGE_LB', '냉장고 왼쪽 아래', 3),
  ('FRIDGE_RB', '냉장고 오른쪽 아래', 4)
) AS t(code, name, ord);

-- 4호박스 층별 (3x2 그리드)
INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, parent_location_id)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), 
   'FRIDGE_FLOOR', 
   'FRIDGE_LT_F1', 
   '냉장고 왼쪽 위 1층', 
   3, 
   2, 
   false,
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001'))),
  
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), 
   'FRIDGE_FLOOR', 
   'FRIDGE_LT_F2', 
   '냉장고 왼쪽 위 2층', 
   3, 
   2, 
   false,
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')));

-- 4. ingredients_inventory 추가

-- DRAWER_LT (왼쪽 위)
INSERT INTO ingredients_inventory (store_id, ingredient_master_id, storage_location_id, sku_full, standard_amount, standard_unit, grid_positions, grid_size)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '양파'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_LT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_LT_ONION_50G',
   50,
   'g',
   '1,2,3,4',
   '2x2'),
  
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '다진김치'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_LT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_LT_KIMCHI_50G',
   50,
   'g',
   '5,6,7,8',
   '2x2');

-- DRAWER_RT (오른쪽 위)
INSERT INTO ingredients_inventory (store_id, ingredient_master_id, storage_location_id, sku_full, standard_amount, standard_unit, grid_positions, grid_size)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '당근'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RT_CARROT_30G',
   30,
   'g',
   '1,3',
   '1x2'),
  
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '애호박'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RT_ZUCCHINI_30G',
   30,
   'g',
   '2,4',
   '1x2'),
  
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '밥'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RT_RICE_300G',
   300,
   'g',
   '5,6,7,8',
   '2x2');

-- DRAWER_LB (왼쪽 아래)
INSERT INTO ingredients_inventory (store_id, ingredient_master_id, storage_location_id, sku_full, standard_amount, standard_unit, grid_positions, grid_size)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '새우'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_LB' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_LB_SHRIMP_10EA',
   10,
   'ea',
   '1,2,3,4,5,6,7,8',
   '4x2');

-- FRIDGE_LT_F2 (냉장고 왼쪽 위 2층)
INSERT INTO ingredients_inventory (store_id, ingredient_master_id, storage_location_id, sku_full, standard_amount, standard_unit, grid_positions, grid_size, floor_number)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '계란'),
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT_F2' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_FRIDGE_LT_F2_EGG_2EA',
   2,
   'ea',
   '1,2,4,5',
   '2x2',
   2);

-- 5. seasonings 추가
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '기름', 'SEASON_01', '조미료대 1번', 'ea'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '간장', 'SEASON_02', '조미료대 2번', 'ml'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '고추가루', 'SEASON_03', '조미료대 3번', 'g'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '다시다', 'SEASON_05', '조미료대 5번', 'g'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '설탕', 'SEASON_06', '조미료대 6번', 'g'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '소금', 'SEASON_07', '조미료대 7번', 'g'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '굴소스', 'SEASON_08', '조미료대 8번', 'g');

-- 6. recipes 추가
INSERT INTO recipes (store_id, menu_name, menu_name_en, category, difficulty_level, estimated_cooking_time)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '김치볶음밥', 'Kimchi Fried Rice', '볶음밥', 'BEGINNER', 300),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '새우볶음밥', 'Shrimp Fried Rice', '볶음밥', 'INTERMEDIATE', 360),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '계란볶음밥', 'Egg Fried Rice', '볶음밥', 'BEGINNER', 240);

-- 7. recipe_steps & recipe_ingredients 추가

-- 김치볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step1_id UUID;
  v_step2_id UUID;
  v_step3_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '김치볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 다진김치 50g 투입')
  RETURNING id INTO v_step1_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step1_id, 'SEASONING:기름:1EA', 1, 'ea', true),
    (v_step1_id, 'MARKET001_DRAWER_LT_KIMCHI_50G', 50, 'g', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 2, 1, 'INGREDIENT', NULL, 30, '밥 300g 투입')
  RETURNING id INTO v_step2_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES (v_step2_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 3, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 4, 2, 'INGREDIENT', NULL, 30, '고추가루 15g, 설탕 15g, 다시다 15g 투입')
  RETURNING id INTO v_step3_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step3_id, 'SEASONING:고추가루:15G', 15, 'g', true),
    (v_step3_id, 'SEASONING:설탕:15G', 15, 'g', true),
    (v_step3_id, 'SEASONING:다시다:15G', 15, 'g', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 5, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
END $$;

-- 새우볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step1_id UUID;
  v_step2_id UUID;
  v_step3_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '새우볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 계란 2개 투입')
  RETURNING id INTO v_step1_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step1_id, 'SEASONING:기름:1EA', 1, 'ea', true),
    (v_step1_id, 'MARKET001_FRIDGE_LT_F2_EGG_2EA', 2, 'ea', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g, 굴소스 10g, 소금 5g, 간장 5ml 투입')
  RETURNING id INTO v_step2_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step2_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
    (v_step2_id, 'SEASONING:굴소스:10G', 10, 'g', true),
    (v_step2_id, 'SEASONING:소금:5G', 5, 'g', true),
    (v_step2_id, 'SEASONING:간장:5ML', 5, 'ml', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 5, 3, 'INGREDIENT', NULL, 30, '새우 10개 투입')
  RETURNING id INTO v_step3_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES (v_step3_id, 'MARKET001_DRAWER_LB_SHRIMP_10EA', 10, 'ea', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 6, 3, 'ACTION', 'STIR_FRY', 60, '볶기');
END $$;

-- 계란볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step1_id UUID;
  v_step2_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '계란볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 당근 30g, 애호박 30g 투입')
  RETURNING id INTO v_step1_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step1_id, 'SEASONING:기름:1EA', 1, 'ea', true),
    (v_step1_id, 'MARKET001_DRAWER_RT_CARROT_30G', 30, 'g', true),
    (v_step1_id, 'MARKET001_DRAWER_RT_ZUCCHINI_30G', 30, 'g', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g, 굴소스 10g, 소금 3g, 간장 7ml 투입')
  RETURNING id INTO v_step2_id;
  
  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step2_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
    (v_step2_id, 'SEASONING:굴소스:10G', 10, 'g', true),
    (v_step2_id, 'SEASONING:소금:3G', 3, 'g', true),
    (v_step2_id, 'SEASONING:간장:7ML', 7, 'ml', true);
  
  INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
  VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
END $$;

-- 완료
DO $$
BEGIN
    RAISE NOTICE '✅ 테스트 데이터 생성 완료!';
    RAISE NOTICE '레시피 3개, 식자재 7종, 조미료 7종';
END $$;
