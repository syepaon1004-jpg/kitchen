# Phase 4: 레시피 등록 — Claude Code 작업 지시

## 목표

어드민이 매장의 레시피(메뉴)를 등록하는 페이지. 5개 테이블 연쇄 INSERT. Phase 1~3에서 만든 데이터(매장, 장비, 식자재, 상시배치 재료)를 참조.

---

## 작업 전 분석 (plan mode)

아래 파일들을 먼저 읽고 현재 구조를 파악해라:

1. `01_SCHEMA_CREATE.sql` — recipes, recipe_bundles, recipe_steps, recipe_ingredients, deco_steps, plate_types, deco_ingredients, ingredient_special_actions 스키마
2. `02_SAMPLE_DATA.sql` — 계란볶음밥(HOT), 버터계란밥(MIXED) 레시피 데이터 구조
3. `03_SCHEMA_EXPANSION_V31.sql` — 육회물회(MIXED 4묶음), 닭껍질튀김(FRYING) 레시피 데이터 구조
4. `src/stores/gameStore.ts` — loadStoreData()에서 레시피를 어떻게 로드하는지
5. `src/types/database.types.ts` — 현재 Recipe, RecipeBundle 등 타입

파악 후 구현 계획 보고. 코드 수정은 승인 후.

---

## DB 스키마 — 테이블 계층

```
recipes (레시피 = 메뉴)
  ├── recipe_bundles (묶음 = 조리 단위)
  │     └── recipe_steps (스텝 = 조리 순서)
  │           └── recipe_ingredients (조리 재료)
  └── deco_steps (데코 스텝)
        ├── source: DECO_ITEM → deco_ingredients FK
        ├── source: SETTING_ITEM → ingredients_inventory FK
        └── source: BUNDLE → recipe_bundles FK

plate_types (접시 타입, 매장별)
```

### recipes

```sql
recipes (
  id UUID PK,
  store_id UUID FK → stores,
  menu_name TEXT NOT NULL,           -- '계란볶음밥'
  menu_name_en TEXT,                 -- 'Egg Fried Rice'
  category TEXT,                     -- '볶음밥', '덮밥', '물회', '튀김'
  difficulty_level TEXT CHECK ('BEGINNER','INTERMEDIATE','ADVANCED'),
  estimated_cooking_time INTEGER,    -- 초 단위 (300 = 5분)
  menu_type TEXT CHECK ('HOT','COLD','MIXED','FRYING'),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE (store_id, menu_name)
)
```

### recipe_bundles

```sql
recipe_bundles (
  id UUID PK,
  recipe_id UUID FK → recipes,
  bundle_name TEXT NOT NULL,         -- '메인', '버터계란볶음', '냉면육수'
  bundle_name_en TEXT,
  bundle_order INTEGER NOT NULL,     -- 묶음 순서 (1, 2, 3...)
  cooking_type TEXT CHECK ('HOT','COLD','MICROWAVE','FRYING'),
  is_main_dish BOOLEAN DEFAULT false, -- true = 접시에 담기는 메인
  plate_type_id UUID FK → plate_types, -- is_main_dish=true일 때
  merge_order INTEGER,               -- 합치기 순서 (NULL=합치기 불필요)
  description TEXT,
  UNIQUE (recipe_id, bundle_order)
)
```

### recipe_steps

```sql
recipe_steps (
  id UUID PK,
  bundle_id UUID FK → recipe_bundles,
  step_number INTEGER NOT NULL,      -- 스텝 순서 (1, 2, 3...)
  step_group INTEGER DEFAULT 1,      -- 같은 그룹 재료는 한 번에 투입
  step_type TEXT CHECK ('INGREDIENT','ACTION'),
  action_type TEXT CHECK (            -- step_type='ACTION'일 때
    'STIR_FRY','FLIP','ADD_WATER','BOIL','SIMMER',
    'DEEP_FRY','BLANCH','DRAIN',
    'TORCH','SLICE','MIX',
    'MICROWAVE','LIFT_BASKET', NULL
  ),
  action_params JSONB DEFAULT '{}',  -- 예: {"required_duration": 60, "power": "HIGH"}
  time_limit_seconds INTEGER,
  instruction TEXT,
  UNIQUE (bundle_id, step_number)
)
```

### recipe_ingredients

```sql
recipe_ingredients (
  id UUID PK,
  recipe_step_id UUID FK → recipe_steps,
  ingredient_master_id UUID FK → ingredients_master,
  inventory_id UUID FK → ingredients_inventory, -- 어느 위치의 재료인지
  required_amount NUMERIC NOT NULL,
  required_unit TEXT DEFAULT 'g',
  is_exact_match_required BOOLEAN DEFAULT true,
  display_name TEXT
)
```

### deco_steps

```sql
deco_steps (
  id UUID PK,
  recipe_id UUID FK → recipes,
  deco_order INTEGER NOT NULL,       -- 데코 순서 (같은 번호 = 동시, 순서 무관)
  source_type TEXT CHECK ('DECO_ITEM','SETTING_ITEM','BUNDLE'),
  
  -- source_type에 따라 하나만 사용:
  deco_ingredient_id UUID FK → deco_ingredients,  -- DECO_ITEM
  inventory_id UUID FK → ingredients_inventory,    -- SETTING_ITEM
  source_bundle_id UUID FK → recipe_bundles,       -- BUNDLE
  
  display_name TEXT NOT NULL,
  required_amount NUMERIC,           -- NULL = 양 검증 안 함
  required_unit TEXT,
  grid_position INTEGER CHECK (1~9), -- 접시 3×3 그리드 위치
  layer_image_url TEXT,
  layer_image_color TEXT DEFAULT '#FF6B6B',
  layer_order INTEGER DEFAULT 1      -- 접시 위 z-index
)
```

### plate_types

```sql
plate_types (
  id UUID PK,
  store_id UUID FK → stores,
  plate_name TEXT,                   -- '볶음밥 접시', '밥그릇', '항아리'
  plate_name_en TEXT,
  plate_category TEXT CHECK ('BOWL','PLATE','SMALL_BOWL','DEEP_PLATE','STONE_POT','CUP','JAR'),
  plate_color TEXT DEFAULT '#FFFFFF',
  display_order INTEGER
)
```

---

## 구현 요구사항

### 1. 페이지 구조

`/admin/recipe` 경로. 좌우 2패널:

```
┌──────────────────────────────────────────────────────────────┐
│ [← 돌아가기]  {매장명} - 레시피 관리                          │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│  레시피 목록   │          레시피 편집 영역                      │
│  (좌측)      │                                               │
│              │  [기본 정보]                                   │
│  계란볶음밥 ✓ │  메뉴명: ________  영문: ________              │
│  버터계란밥 ✓ │  타입: HOT ▼  카테고리: ________               │
│  육회물회   ✓ │  난이도: BEGINNER ▼  시간: ____ 초             │
│  닭껍질튀김 ✓ │                                               │
│              │  [묶음 목록]                                   │
│  [+ 새 레시피] │  묶음1: 메인 (HOT, 메인접시)                  │
│              │    Step 1: 기름1ea+계란2ea (INGREDIENT)        │
│              │    Step 2: 볶기 (ACTION: STIR_FRY)            │
│              │    Step 3: 밥300g+소금3g (INGREDIENT)          │
│              │    Step 4: 볶기 (ACTION: STIR_FRY)            │
│              │    [+ 스텝 추가]                               │
│              │  [+ 묶음 추가]                                 │
│              │                                               │
│              │  [데코 스텝]                                   │
│              │  1. 참기름 (DECO_ITEM, pos:5)                  │
│              │  2. 깨 (DECO_ITEM, pos:5)                     │
│              │  [+ 데코 추가]                                 │
│              │                                               │
│              │          [저장]  [삭제]                         │
└──────────────┴───────────────────────────────────────────────┘
```

### 2. 좌측: 레시피 목록

- store_id 기준 레시피 목록 조회
- 클릭 시 우측에 해당 레시피 편집 폼 로드
- "새 레시피" 버튼 → 빈 폼

### 3. 우측: 레시피 편집 폼

#### 3-1. 기본 정보
- menu_name, menu_name_en, category (자유 텍스트)
- menu_type 드롭다운 (HOT / COLD / MIXED / FRYING)
- difficulty_level 드롭다운 (BEGINNER / INTERMEDIATE / ADVANCED)
- estimated_cooking_time (초 단위)

#### 3-2. 묶음 목록
- 레시피에 포함된 묶음 목록 (bundle_order 순)
- 각 묶음:
  - bundle_name, cooking_type 드롭다운
  - is_main_dish 토글 (true면 plate_type_id 선택)
  - merge_order (합치기 순서, 선택)
- "묶음 추가" 버튼

#### 3-3. 묶음 내 스텝 목록
- 각 묶음 아래에 스텝 목록 (step_number 순)
- 스텝:
  - step_type 선택 (INGREDIENT / ACTION)
  - INGREDIENT일 때: 재료 추가 (아래 3-4 참조)
  - ACTION일 때: action_type 드롭다운, action_params JSON 입력, time_limit_seconds
  - step_group (같은 그룹 = 동시 투입)
  - instruction (설명 텍스트)
- "스텝 추가" 버튼
- 드래그 또는 화살표로 순서 변경

#### 3-4. 스텝 내 재료 (recipe_ingredients)
- step_type=INGREDIENT인 스텝에 재료 추가:
  - ingredients_master에서 재료 선택 (검색 드롭다운)
  - ingredients_inventory에서 위치 선택 (해당 매장의 재고 목록)
    - 재료를 선택하면 해당 재료가 배치된 위치 목록을 자동 필터링
  - required_amount, required_unit
- 한 스텝에 여러 재료 가능 (같은 step_group이면 동시 투입)

#### 3-5. 데코 스텝
- 레시피의 데코 순서 목록 (deco_order 순)
- 각 데코 스텝:
  - source_type 선택 (DECO_ITEM / SETTING_ITEM / BUNDLE)
  - DECO_ITEM: deco_ingredients에서 선택 (매장의 상시배치 재료)
  - SETTING_ITEM: ingredients_inventory에서 선택
  - BUNDLE: 현재 레시피의 묶음 중 is_main_dish=false인 것에서 선택
  - display_name (자동 채움 가능)
  - grid_position (1~9, 접시 3×3 그리드)
  - layer_image_color (색상 선택)
  - layer_order (z-index)
  - required_amount, required_unit (선택)
- 같은 deco_order = 동시 (순서 무관)
- "데코 추가" 버튼

#### 3-6. 접시 관리
- 묶음에서 is_main_dish=true일 때 plate_type_id 선택
- 매장의 plate_types 목록 드롭다운
- "새 접시 추가" → 인라인 또는 모달 (plate_name, plate_category, plate_color)

### 4. API 레이어 (src/api/recipeApi.ts — 새 파일)

```typescript
// 레시피 CRUD
fetchRecipes(storeId): Recipe[]
fetchRecipeDetail(recipeId): Recipe + bundles + steps + ingredients + decoSteps (전체 계층)
createRecipe(data): Recipe
updateRecipe(id, updates): Recipe
deleteRecipe(id): void  // CASCADE로 하위 전부 삭제

// 묶음 CRUD
createBundle(data): RecipeBundle
updateBundle(id, updates): RecipeBundle
deleteBundle(id): void

// 스텝 CRUD
createStep(data): RecipeStep
updateStep(id, updates): RecipeStep
deleteStep(id): void

// 재료 CRUD
createRecipeIngredient(data): RecipeIngredient
updateRecipeIngredient(id, updates): RecipeIngredient
deleteRecipeIngredient(id): void

// 데코 스텝 CRUD
createDecoStep(data): DecoStep
updateDecoStep(id, updates): DecoStep
deleteDecoStep(id): void

// 접시 타입
fetchPlateTypes(storeId): PlateType[]
createPlateType(data): PlateType

// 참조 데이터 (Phase 3에서 만든 API 재사용)
fetchAllIngredientsMaster(): IngredientMaster[]
fetchDecoIngredients(storeId): DecoIngredient[]
fetchInventoryByStore(storeId): IngredientInventory[]  // 재료별 위치 목록용
```

### 5. 저장 로직

**일괄 저장** ("저장" 버튼). FK 순서 준수:

```
1. recipes UPSERT (INSERT or UPDATE)
2. recipe_bundles UPSERT (DELETE 삭제된 것 → UPDATE 기존 → INSERT 신규)
3. recipe_steps UPSERT (위와 동일)
4. recipe_ingredients UPSERT
5. deco_steps UPSERT
```

- 로컬 state에서 편집 → "저장" 시 DB 반영
- localId + dbId 패턴 (Phase 2, 3과 동일)
- 묶음 삭제 시 하위 스텝/재료도 로컬에서 함께 제거 (DB는 CASCADE)
- 순서 변경 시 step_number/bundle_order/deco_order 재계산

### 6. 라우팅

- App.tsx에 `/admin/recipe` 라우트 추가
- StoreSelect.tsx에 "레시피 관리 →" 버튼 추가

---

## RLS 정책 (사용자가 Supabase SQL Editor에서 실행)

```sql
CREATE POLICY "recipes_insert" ON recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "recipes_update" ON recipes FOR UPDATE USING (true);
CREATE POLICY "recipes_delete" ON recipes FOR DELETE USING (true);
CREATE POLICY "recipe_bundles_insert" ON recipe_bundles FOR INSERT WITH CHECK (true);
CREATE POLICY "recipe_bundles_update" ON recipe_bundles FOR UPDATE USING (true);
CREATE POLICY "recipe_bundles_delete" ON recipe_bundles FOR DELETE USING (true);
CREATE POLICY "recipe_steps_insert" ON recipe_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "recipe_steps_update" ON recipe_steps FOR UPDATE USING (true);
CREATE POLICY "recipe_steps_delete" ON recipe_steps FOR DELETE USING (true);
CREATE POLICY "recipe_ingredients_insert" ON recipe_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "recipe_ingredients_update" ON recipe_ingredients FOR UPDATE USING (true);
CREATE POLICY "recipe_ingredients_delete" ON recipe_ingredients FOR DELETE USING (true);
CREATE POLICY "deco_steps_insert" ON deco_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "deco_steps_update" ON deco_steps FOR UPDATE USING (true);
CREATE POLICY "deco_steps_delete" ON deco_steps FOR DELETE USING (true);
CREATE POLICY "plate_types_insert" ON plate_types FOR INSERT WITH CHECK (true);
CREATE POLICY "plate_types_update" ON plate_types FOR UPDATE USING (true);
CREATE POLICY "plate_types_delete" ON plate_types FOR DELETE USING (true);
```

---

## 주의사항

- 기존 시뮬레이터 코드 수정 금지
- FK 순서 엄수: recipes → bundles → steps → ingredients, recipes → deco_steps
- deco_steps의 source_type에 따라 FK가 다름 (3가지 중 하나만 non-null)
- recipe_ingredients.inventory_id는 NOT NULL — 반드시 식자재 위치를 지정해야 함
- step_number, bundle_order, deco_order는 연속 정수 (1, 2, 3...)
- 같은 deco_order끼리는 동시 수행 (순서 무관)
- action_params는 JSONB — MICROWAVE: {required_duration, power}, DEEP_FRY: {required_duration}, BOIL: {required_duration}
- 한국어 UI, Tailwind 스타일 유지

---

## 검증 체크리스트

- [ ] /admin/recipe 페이지 접근 가능
- [ ] 기존 레시피 목록 로드 (계란볶음밥, 버터계란밥, 육회물회, 닭껍질튀김)
- [ ] 레시피 클릭 → 묶음/스텝/재료/데코 전체 로드
- [ ] 새 레시피 생성 (기본 정보 입력)
- [ ] 묶음 추가 (cooking_type, is_main_dish, plate_type 선택)
- [ ] 스텝 추가 (INGREDIENT: 재료 선택 + 위치 선택, ACTION: 타입 + 파라미터)
- [ ] 데코 스텝 추가 (DECO_ITEM / SETTING_ITEM / BUNDLE 각각 테스트)
- [ ] 저장 → Supabase에서 5개 테이블 데이터 확인
- [ ] 새로고침 → 저장된 데이터 정상 로드
- [ ] 레시피 삭제 → CASCADE로 하위 데이터 모두 삭제
- [ ] 접시 타입 추가 가능
- [ ] 시뮬레이터: 새 레시피로 게임 플레이 가능