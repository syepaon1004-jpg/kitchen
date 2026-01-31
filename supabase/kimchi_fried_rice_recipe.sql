-- 김치볶음밥 레시피 수정
-- Supabase SQL Editor에서 순서대로 실행하세요

-- 1단계: 기존 김치볶음밥 레시피의 단계 및 재료 삭제
DELETE FROM recipe_ingredients 
WHERE recipe_step_id IN (
  SELECT id FROM recipe_steps 
  WHERE recipe_id = (
    SELECT id FROM recipes 
    WHERE menu_name = '김치볶음밥' 
    AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
  )
);

DELETE FROM recipe_steps 
WHERE recipe_id = (
  SELECT id FROM recipes 
  WHERE menu_name = '김치볶음밥' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1)
);

-- 2단계: 새로운 레시피 단계 추가
DO $$
DECLARE
  v_recipe_id UUID;
  v_step1_id UUID;
  v_step2_id UUID;
  v_step3_id UUID;
  v_step4_id UUID;
  v_step5_id UUID;
BEGIN
  -- 김치볶음밥 레시피 ID
  SELECT id INTO v_recipe_id 
  FROM recipes 
  WHERE menu_name = '김치볶음밥' 
  AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001' LIMIT 1);

  -- Step 1: 식용유 투입
  INSERT INTO recipe_steps (
    recipe_id, step_number, step_group, step_type, action_type, 
    time_limit_seconds, is_order_critical, instruction
  ) VALUES (
    v_recipe_id, 1, 1, 'INGREDIENT', NULL, 
    NULL, FALSE, '식용유 투입'
  ) RETURNING id INTO v_step1_id;

  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES (v_step1_id, 'SEASONING:식용유:1국자', 1, '국자', TRUE);

  -- Step 2: 김치 투입
  INSERT INTO recipe_steps (
    recipe_id, step_number, step_group, step_type, action_type, 
    time_limit_seconds, is_order_critical, instruction
  ) VALUES (
    v_recipe_id, 2, 1, 'INGREDIENT', NULL, 
    NULL, FALSE, '김치 투입'
  ) RETURNING id INTO v_step2_id;

  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES (v_step2_id, 'MARKET001_DRAWER_LT_OUTER_KIMCHI_50G', 50, 'g', TRUE);

  -- Step 3: 볶기
  INSERT INTO recipe_steps (
    recipe_id, step_number, step_group, step_type, action_type, 
    time_limit_seconds, is_order_critical, instruction
  ) VALUES (
    v_recipe_id, 3, 1, 'ACTION', 'STIR_FRY', 
    30, FALSE, '김치 볶기'
  ) RETURNING id INTO v_step3_id;

  -- Step 4: 조미료 투입
  INSERT INTO recipe_steps (
    recipe_id, step_number, step_group, step_type, action_type, 
    time_limit_seconds, is_order_critical, instruction
  ) VALUES (
    v_recipe_id, 4, 1, 'INGREDIENT', NULL, 
    NULL, FALSE, '조미료 투입'
  ) RETURNING id INTO v_step4_id;

  INSERT INTO recipe_ingredients (recipe_step_id, required_sku, required_amount, required_unit, is_exact_match_required)
  VALUES 
    (v_step4_id, 'SEASONING:고추가루:15G', 15, 'g', TRUE),
    (v_step4_id, 'SEASONING:설탕:15G', 15, 'g', TRUE),
    (v_step4_id, 'SEASONING:간장:7G', 7, 'g', TRUE);

  -- Step 5: 볶기 (마무리)
  INSERT INTO recipe_steps (
    recipe_id, step_number, step_group, step_type, action_type, 
    time_limit_seconds, is_order_critical, instruction
  ) VALUES (
    v_recipe_id, 5, 1, 'ACTION', 'STIR_FRY', 
    30, FALSE, '조미료와 함께 볶기'
  ) RETURNING id INTO v_step5_id;

  RAISE NOTICE '✅ 김치볶음밥 레시피 업데이트 완료';
END $$;
