-- =============================================
-- 10개 메뉴 확장 데이터 (기존 3개 + 신규 7개)
-- =============================================

-- 1. 추가 식재료 마스터 데이터
INSERT INTO ingredients_master (ingredient_name, ingredient_name_en, category, base_unit)
VALUES 
  ('치즈', 'Cheese', '유제품', 'g'),
  ('베이컨', 'Bacon', '육류', 'g'),
  ('양배추', 'Cabbage', '채소', 'g'),
  ('파프리카', 'Paprika', '채소', 'g'),
  ('참치캔', 'Canned Tuna', '해산물', 'g'),
  ('카레가루', 'Curry Powder', '향신료', 'g'),
  ('소고기', 'Beef', '육류', 'g'),
  ('오징어', 'Squid', '해산물', 'g'),
  ('대파', 'Green Onion', '채소', 'g'),
  ('청양고추', 'Chili Pepper', '채소', 'g')
ON CONFLICT (ingredient_name) DO NOTHING;

-- 2. 추가 조미료
INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '후추', 'SEASON_09', '조미료대 9번', 'g'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '참기름', 'SEASON_10', '조미료대 10번', 'ml'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '마요네즈', 'SEASON_11', '조미료대 11번', 'g'),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '케첩', 'SEASON_12', '조미료대 12번', 'ml')
ON CONFLICT (store_id, seasoning_name) DO NOTHING;

-- 3. 추가 재고 배치 (DRAWER_RB - 오른쪽 아래)
INSERT INTO ingredients_inventory (store_id, ingredient_master_id, storage_location_id, sku_full, grid_positions, grid_size)
VALUES
  -- 치즈
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '치즈'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RB' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RB_CHEESE_50G',
   '1,2',
   '1x2'),

  -- 베이컨
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '베이컨'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RB' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RB_BACON_100G',
   '3,4',
   '1x2'),

  -- 양배추
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '양배추'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RB' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RB_CABBAGE_100G',
   '5,6',
   '1x2'),

  -- 파프리카
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '파프리카'),
   (SELECT id FROM storage_locations WHERE location_code = 'DRAWER_RB' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_DRAWER_RB_PAPRIKA_50G',
   '7,8',
   '1x2')
ON CONFLICT (sku_full) DO NOTHING;

-- 4. 추가 재고 배치 (FRIDGE_LT_F1 - 냉장고 왼쪽 위 1층)
INSERT INTO ingredients_inventory (store_id, ingredient_master_id, storage_location_id, sku_full, grid_positions, grid_size, floor_number)
VALUES
  -- 참치캔
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '참치캔'),
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT_F1' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_FRIDGE_LT_F1_TUNA_150G',
   '1,2',
   '1x2',
   1),

  -- 소고기
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '소고기'),
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT_F1' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_FRIDGE_LT_F1_BEEF_150G',
   '3,4',
   '1x2',
   1),

  -- 오징어
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'),
   (SELECT id FROM ingredients_master WHERE ingredient_name = '오징어'),
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT_F1' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')),
   'MARKET001_FRIDGE_LT_F1_SQUID_100G',
   '5,6',
   '1x2',
   1)
ON CONFLICT (sku_full) DO NOTHING;

-- 5. 신규 레시피 7개 추가
INSERT INTO recipes (store_id, menu_name, menu_name_en, category, difficulty_level, estimated_cooking_time)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '치즈계란볶음밥', 'Cheese Egg Fried Rice', '볶음밥', 'BEGINNER', 300),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '베이컨볶음밥', 'Bacon Fried Rice', '볶음밥', 'INTERMEDIATE', 360),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '야채볶음밥', 'Vegetable Fried Rice', '볶음밥', 'BEGINNER', 300),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '참치김치볶음밥', 'Tuna Kimchi Fried Rice', '볶음밥', 'INTERMEDIATE', 360),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '카레볶음밥', 'Curry Fried Rice', '볶음밥', 'INTERMEDIATE', 420),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '소고기볶음밥', 'Beef Fried Rice', '볶음밥', 'ADVANCED', 480),
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '해물볶음밥', 'Seafood Fried Rice', '볶음밥', 'ADVANCED', 540)
ON CONFLICT DO NOTHING;

-- 6. 레시피별 상세 단계 추가

-- [메뉴 4] 치즈계란볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '치즈계란볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    -- Step 1: 기름, 계란
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 계란 2개 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_FRIDGE_LT_F2_EGG_2EA', 2, 'ea', true);
    
    -- Step 2: 볶기
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    -- Step 3: 밥, 소금, 후추
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g, 소금 3g, 후추 2g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
      (v_step_id, 'SEASONING:소금:3G', 3, 'g', true),
      (v_step_id, 'SEASONING:후추:2G', 2, 'g', true);
    
    -- Step 4: 볶기
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    -- Step 5: 치즈
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 5, 3, 'INGREDIENT', NULL, 20, '치즈 50g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES (v_step_id, 'MARKET001_DRAWER_RB_CHEESE_50G', 50, 'g', true);
    
    -- Step 6: 섞기
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 6, 3, 'ACTION', 'STIR_FRY', 30, '가볍게 섞기');
  END IF;
END $$;

-- [메뉴 5] 베이컨볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '베이컨볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 베이컨 100g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_DRAWER_RB_BACON_100G', 100, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g, 간장 10ml, 후추 2g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
      (v_step_id, 'SEASONING:간장:10ML', 10, 'ml', true),
      (v_step_id, 'SEASONING:후추:2G', 2, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 5, 3, 'INGREDIENT', NULL, 20, '참기름 5ml 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES (v_step_id, 'SEASONING:참기름:5ML', 5, 'ml', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 6, 3, 'ACTION', 'STIR_FRY', 30, '마무리 볶기');
  END IF;
END $$;

-- [메뉴 6] 야채볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '야채볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 40, '기름 1국자, 양파 50g, 당근 30g, 애호박 30g, 양배추 100g, 파프리카 50g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_DRAWER_LT_ONION_50G', 50, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RT_CARROT_30G', 30, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RT_ZUCCHINI_30G', 30, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RB_CABBAGE_100G', 100, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RB_PAPRIKA_50G', 50, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 90, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g, 간장 10ml, 굴소스 10g, 소금 3g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
      (v_step_id, 'SEASONING:간장:10ML', 10, 'ml', true),
      (v_step_id, 'SEASONING:굴소스:10G', 10, 'g', true),
      (v_step_id, 'SEASONING:소금:3G', 3, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
  END IF;
END $$;

-- [메뉴 7] 참치김치볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '참치김치볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 다진김치 50g, 참치캔 150g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_DRAWER_LT_KIMCHI_50G', 50, 'g', true),
      (v_step_id, 'MARKET001_FRIDGE_LT_F1_TUNA_150G', 150, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g, 고추가루 10g, 설탕 10g, 참기름 5ml 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
      (v_step_id, 'SEASONING:고추가루:10G', 10, 'g', true),
      (v_step_id, 'SEASONING:설탕:10G', 10, 'g', true),
      (v_step_id, 'SEASONING:참기름:5ML', 5, 'ml', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
  END IF;
END $$;

-- [메뉴 8] 카레볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '카레볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 양파 50g, 당근 30g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_DRAWER_LT_ONION_50G', 50, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RT_CARROT_30G', 30, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '밥 300g투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    -- 카레가루는 seasonings에 추가
    INSERT INTO seasonings (store_id, seasoning_name, position_code, position_name, base_unit)
    VALUES ((SELECT id FROM stores WHERE store_code = 'MARKET001'), '카레가루', 'SEASON_13', '조미료대 13번', 'g')
    ON CONFLICT (store_id, seasoning_name) DO NOTHING;
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 5, 3, 'INGREDIENT', NULL, 20, '카레가루 20g, 소금 3g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:카레가루:20G', 20, 'g', true),
      (v_step_id, 'SEASONING:소금:3G', 3, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 6, 3, 'ACTION', 'STIR_FRY', 60, '골고루 섞기');
  END IF;
END $$;

-- [메뉴 9] 소고기볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '소고기볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 소고기 150g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_FRIDGE_LT_F1_BEEF_150G', 150, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 90, '고기 익히기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '양파 50g, 당근 30g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_LT_ONION_50G', 50, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RT_CARROT_30G', 30, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 5, 3, 'INGREDIENT', NULL, 30, '밥 300g, 간장 15ml, 굴소스 10g, 후추 3g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
      (v_step_id, 'SEASONING:간장:15ML', 15, 'ml', true),
      (v_step_id, 'SEASONING:굴소스:10G', 10, 'g', true),
      (v_step_id, 'SEASONING:후추:3G', 3, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 6, 3, 'ACTION', 'STIR_FRY', 60, '강불에 볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 7, 4, 'INGREDIENT', NULL, 20, '참기름 5ml 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES (v_step_id, 'SEASONING:참기름:5ML', 5, 'ml', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 8, 4, 'ACTION', 'STIR_FRY', 30, '마무리 볶기');
  END IF;
END $$;

-- [메뉴 10] 해물볶음밥
DO $$
DECLARE
  v_recipe_id UUID;
  v_step_id UUID;
BEGIN
  SELECT id INTO v_recipe_id FROM recipes WHERE menu_name = '해물볶음밥' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001');
  IF v_recipe_id IS NOT NULL THEN
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 1, 1, 'INGREDIENT', NULL, 30, '기름 1국자, 새우 10개, 오징어 100g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:기름:1EA', 1, 'ea', true),
      (v_step_id, 'MARKET001_DRAWER_LB_SHRIMP_10EA', 10, 'ea', true),
      (v_step_id, 'MARKET001_FRIDGE_LT_F1_SQUID_100G', 100, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 2, 1, 'ACTION', 'STIR_FRY', 90, '해물 익히기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 3, 2, 'INGREDIENT', NULL, 30, '양파 50g, 파프리카 50g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_LT_ONION_50G', 50, 'g', true),
      (v_step_id, 'MARKET001_DRAWER_RB_PAPRIKA_50G', 50, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 4, 2, 'ACTION', 'STIR_FRY', 60, '볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 5, 3, 'INGREDIENT', NULL, 30, '밥 300g, 간장 10ml, 굴소스 15g, 후추 3g 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'MARKET001_DRAWER_RT_RICE_300G', 300, 'g', true),
      (v_step_id, 'SEASONING:간장:10ML', 10, 'ml', true),
      (v_step_id, 'SEASONING:굴소스:15G', 15, 'g', true),
      (v_step_id, 'SEASONING:후추:3G', 3, 'g', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 6, 3, 'ACTION', 'STIR_FRY', 60, '강불에 볶기');
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 7, 4, 'INGREDIENT', NULL, 20, '참기름 5ml, 케첩 10ml 투입')
    RETURNING id INTO v_step_id;
    
    INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
    VALUES 
      (v_step_id, 'SEASONING:참기름:5ML', 5, 'ml', true),
      (v_step_id, 'SEASONING:케첩:10ML', 10, 'ml', true);
    
    INSERT INTO recipe_steps (recipe_id, step_number, step_group, step_type, action_type, time_limit_seconds, instruction)
    VALUES (v_recipe_id, 8, 4, 'ACTION', 'STIR_FRY', 30, '마무리 볶기');
  END IF;
END $$;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '🎉 10개 메뉴 데이터 생성 완료!';
    RAISE NOTICE '📋 메뉴 목록:';
    RAISE NOTICE '1. 김치볶음밥 (기존)';
    RAISE NOTICE '2. 새우볶음밥 (기존)';
    RAISE NOTICE '3. 계란볶음밥 (기존)';
    RAISE NOTICE '4. 치즈계란볶음밥 (신규)';
    RAISE NOTICE '5. 베이컨볶음밥 (신규)';
    RAISE NOTICE '6. 야채볶음밥 (신규)';
    RAISE NOTICE '7. 참치김치볶음밥 (신규)';
    RAISE NOTICE '8. 카레볶음밥 (신규)';
    RAISE NOTICE '9. 소고기볶음밥 (신규)';
    RAISE NOTICE '10. 해물볶음밥 (신규)';
    RAISE NOTICE '---';
    RAISE NOTICE '✅ 신규 식자재: 10종';
    RAISE NOTICE '✅ 신규 조미료: 5종';
    RAISE NOTICE '✅ 총 레시피 단계: 60+ steps';
END $$;
