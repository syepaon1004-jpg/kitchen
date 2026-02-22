-- =============================================
-- FREEZER 4칸 + 층 구조 마이그레이션
-- + FRIDGE_4BOX FRIDGE_FLOOR 그리드 3×2 → 4×4
-- =============================================
--
-- 시나리오 A: 기존 단일 FREEZER_1 (has_floors=false) → 4칸+층으로
-- 시나리오 B: 기존 4칸 FREEZER_1_LT (has_floors=false) → 층 추가
-- 시나리오 C: FRIDGE_FLOOR 3×2 → 4×4 동기화
--
-- 실행 전 확인:
--   SELECT location_code, location_type, grid_rows, grid_cols, has_floors FROM storage_locations WHERE location_type IN ('FREEZER', 'FRIDGE_FLOOR');
-- =============================================

-- ===== Part 1: 기존 단일 FREEZER → 4칸+층 구조 =====
-- (FREEZER_1 등 _LT/_RT/_LB/_RB 접미사 없는 것)

DO $$
DECLARE
  rec RECORD;
  num TEXT;
  pos TEXT;
  pos_name TEXT;
  pos_idx INT;
  new_parent_code TEXT;
  new_parent_id UUID;
  new_floor_code TEXT;
  inv_count INT;
  positions TEXT[] := ARRAY['LT', 'RT', 'LB', 'RB'];
  pos_names TEXT[] := ARRAY['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래'];
BEGIN
  FOR rec IN
    SELECT id, store_id, location_code, location_name
    FROM storage_locations
    WHERE location_type = 'FREEZER'
      AND location_code !~ '_(LT|RT|LB|RB)$'
  LOOP
    num := regexp_replace(rec.location_code, '^FREEZER_', '');
    RAISE NOTICE '[Part1] Migrating single FREEZER: % (store: %)', rec.location_code, rec.store_id;

    -- 재고 확인
    SELECT COUNT(*) INTO inv_count FROM ingredients_inventory WHERE storage_location_id = rec.id;

    -- 4칸 부모 + 각 2층 생성
    FOR pos_idx IN 1..4 LOOP
      pos := positions[pos_idx];
      pos_name := pos_names[pos_idx];
      new_parent_code := 'FREEZER_' || num || '_' || pos;

      IF NOT EXISTS (SELECT 1 FROM storage_locations WHERE store_id = rec.store_id AND location_code = new_parent_code) THEN
        INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, floor_count, position_order)
        VALUES (rec.store_id, 'FREEZER', new_parent_code, '냉동고 ' || num || ' ' || pos_name, 4, 4, true, 2, pos_idx)
        RETURNING id INTO new_parent_id;
        RAISE NOTICE '  Created parent: %', new_parent_code;

        -- F1, F2 층 생성
        FOR f IN 1..2 LOOP
          new_floor_code := new_parent_code || '_F' || f;
          INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, floor_count, parent_location_id, position_order)
          VALUES (rec.store_id, 'FRIDGE_FLOOR', new_floor_code, '냉동고 ' || num || ' ' || pos_name || ' ' || f || '층', 4, 4, false, 1, new_parent_id, f);
          RAISE NOTICE '  Created floor: %', new_floor_code;
        END LOOP;
      END IF;
    END LOOP;

    -- 기존 재고 → LT_F1으로 이동
    IF inv_count > 0 THEN
      SELECT id INTO new_parent_id
      FROM storage_locations
      WHERE store_id = rec.store_id AND location_code = 'FREEZER_' || num || '_LT_F1';

      IF new_parent_id IS NOT NULL THEN
        UPDATE ingredients_inventory SET storage_location_id = new_parent_id WHERE storage_location_id = rec.id;
        RAISE NOTICE '  Moved % items to LT_F1', inv_count;
      END IF;
    END IF;

    -- 장비 storage_location_ids 업데이트
    UPDATE kitchen_equipment
    SET storage_location_ids = ARRAY[
      'FREEZER_' || num || '_LT',
      'FREEZER_' || num || '_RT',
      'FREEZER_' || num || '_LB',
      'FREEZER_' || num || '_RB'
    ]
    WHERE rec.location_code = ANY(storage_location_ids);

    -- 기존 단일 location 삭제
    DELETE FROM storage_locations WHERE id = rec.id;
    RAISE NOTICE '  Deleted old: %', rec.location_code;
  END LOOP;
END $$;

-- ===== Part 2: 기존 4칸 FREEZER_1_LT (has_floors=false) → 층 추가 =====

DO $$
DECLARE
  rec RECORD;
  new_floor_code TEXT;
  inv_count INT;
  first_floor_id UUID;
BEGIN
  FOR rec IN
    SELECT id, store_id, location_code, location_name
    FROM storage_locations
    WHERE location_type = 'FREEZER'
      AND location_code ~ '_(LT|RT|LB|RB)$'
      AND has_floors = false
  LOOP
    RAISE NOTICE '[Part2] Upgrading flat FREEZER to floors: % (store: %)', rec.location_code, rec.store_id;

    -- 부모를 has_floors=true로 변경
    UPDATE storage_locations
    SET has_floors = true, floor_count = 2, grid_rows = 4, grid_cols = 4
    WHERE id = rec.id;

    -- 재고 확인
    SELECT COUNT(*) INTO inv_count FROM ingredients_inventory WHERE storage_location_id = rec.id;

    -- F1, F2 층 생성
    first_floor_id := NULL;
    FOR f IN 1..2 LOOP
      new_floor_code := rec.location_code || '_F' || f;
      IF NOT EXISTS (SELECT 1 FROM storage_locations WHERE store_id = rec.store_id AND location_code = new_floor_code) THEN
        INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, floor_count, parent_location_id, position_order)
        VALUES (rec.store_id, 'FRIDGE_FLOOR', new_floor_code, rec.location_name || ' ' || f || '층', 4, 4, false, 1, rec.id, f);
        RAISE NOTICE '  Created floor: %', new_floor_code;

        IF f = 1 THEN
          SELECT id INTO first_floor_id FROM storage_locations WHERE store_id = rec.store_id AND location_code = new_floor_code;
        END IF;
      ELSE
        IF f = 1 THEN
          SELECT id INTO first_floor_id FROM storage_locations WHERE store_id = rec.store_id AND location_code = new_floor_code;
        END IF;
      END IF;
    END LOOP;

    -- 기존 재고 → F1으로 이동
    IF inv_count > 0 AND first_floor_id IS NOT NULL THEN
      UPDATE ingredients_inventory SET storage_location_id = first_floor_id WHERE storage_location_id = rec.id;
      RAISE NOTICE '  Moved % items to F1', inv_count;
    END IF;
  END LOOP;
END $$;

-- ===== Part 3: FRIDGE_FLOOR 그리드 3×2 → 4×4 동기화 =====

UPDATE storage_locations
SET grid_rows = 4, grid_cols = 4
WHERE location_type = 'FRIDGE_FLOOR'
  AND (grid_rows != 4 OR grid_cols != 4);

-- ===== 확인 쿼리 =====

-- FREEZER 구조 확인
SELECT location_code, location_type, grid_rows, grid_cols, has_floors, floor_count, parent_location_id
FROM storage_locations
WHERE location_type IN ('FREEZER') OR (location_type = 'FRIDGE_FLOOR' AND location_code LIKE 'FREEZER%')
ORDER BY location_code;

-- FRIDGE_FLOOR 그리드 확인
SELECT location_code, grid_rows, grid_cols
FROM storage_locations
WHERE location_type = 'FRIDGE_FLOOR'
ORDER BY location_code;
