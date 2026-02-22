# Kitchen Flow - 주방 시뮬레이션 훈련 플랫폼

## 프로젝트 개요

음식점 주방 직원 온보딩용 게임형 시뮬레이션. 실제 매장 주방을 그리드로 재현, 레시피에 따라 조리 → 데코 → 서빙을 훈련한다. 모든 데이터는 store_id 기준 분리 → 매장마다 다른 주방/식자재/레시피.

## 기술 스택

- React 18 + TypeScript + Vite
- Zustand (src/stores/gameStore.ts)
- Supabase (PostgreSQL + RLS, signInAnonymously)
- Tailwind CSS + framer-motion
- react-router-dom v6 (BrowserRouter)
- @dnd-kit/core + @dnd-kit/utilities (어드민 드래그앤드롭)
- @tanstack/react-query, recharts

## 라우팅 (src/App.tsx)

```
/               → StoreSelect            매장 선택 + 매장 생성 + 어드민 진입
/user-login     → UserLogin              아바타 선택/생성 + 비밀번호 (4자 이상, 개발모드)
/level-select   → LevelSelect            난이도 (BEGINNER/INTERMEDIATE/ADVANCED)
/game           → GamePlay               시뮬레이션 플레이
/result         → GameResult             결과 확인 (점수 + 그래프)
/admin/kitchen  → KitchenLayoutEditor    주방 레이아웃 에디터 (장비 배치 + 식자재 관리)
```

## 핵심 파일 맵

```
src/
├── App.tsx                          라우팅 정의
├── main.tsx                         BrowserRouter + QueryClient 설정
├── lib/supabase.ts                  Supabase 클라이언트
├── types/database.types.ts          모든 타입 정의
├── stores/gameStore.ts              Zustand 전역 상태 (시뮬레이터 전용)
├── api/
│   ├── kitchenEditorApi.ts          주방 레이아웃 CRUD API
│   └── inventoryApi.ts              저장 공간 + 식자재 CRUD API (Phase 3)
├── pages/
│   ├── StoreSelect.tsx              매장 목록 + 생성 + "주방 레이아웃 설정" 버튼
│   ├── UserLogin.tsx                사용자 목록 + 생성 + 비밀번호 로그인
│   ├── LevelSelect.tsx              난이도 선택 + startGame()
│   ├── GamePlay.tsx                 메인 게임 화면
│   ├── GameResult.tsx               결과 + 과거 기록 그래프
│   └── admin/
│       └── KitchenLayoutEditor.tsx   주방 레이아웃 에디터 (@dnd-kit)
├── components/
│   ├── AppHeader.tsx                상단 헤더
│   ├── DebugPanel.tsx               디버그 패널
│   ├── GridPopup.tsx                그리드 팝업 (식자재 선택)
│   ├── Game/                        게임 UI 컴포넌트
│   ├── Kitchen/                     주방 장비 컴포넌트 (Burner, Sink, DrawerFridge 등)
│   └── Menu/                        메뉴 큐 컴포넌트
```

## 상태관리 흐름 (gameStore.ts)

```
매장 선택:  setStore(store)           → currentStore 설정
데이터 로드: loadStoreData(storeId)    → kitchenLayout, ingredients, recipes, seasonings 로드
사용자 선택: setCurrentUser(user)      → currentUser 설정
난이도 선택: setLevel(level)           → level 설정
게임 시작:  preloadStorageData()       → storageCache 채움
           startGame()               → game_sessions INSERT, isPlaying = true
게임 종료:  endGame()                  → 점수 계산, game_sessions UPDATE
```

## DB 테이블 의존 관계 (FK 순서)

```
stores (최상위)
  ├── users (store_id FK)
  ├── storage_locations (store_id FK)
  │     └── ingredients_inventory (storage_location_id FK + ingredient_master_id FK)
  ├── kitchen_grids (store_id FK)
  │     └── kitchen_equipment (grid_id FK)
  ├── plate_types (store_id FK)
  ├── recipes (store_id FK)
  │     ├── recipe_bundles (recipe_id FK)
  │     │     └── recipe_steps (bundle_id FK)
  │     │           └── recipe_ingredients (step_id FK + ingredient_master_id FK)
  │     ├── deco_steps (recipe_id FK + deco_ingredients FK + recipe_bundles FK)
  │     └── ingredient_special_actions (recipe_id FK)
  └── game_sessions (store_id FK + user_id FK)

ingredients_master (독립, FK 없음)
```

## DB 스키마 핵심 테이블

```sql
stores (id, store_name, store_code UNIQUE, store_address, store_phone, is_active, created_at, updated_at)

users (id, store_id FK, username, avatar_name DEFAULT 'default', role CHECK('ADMIN','MANAGER','STAFF'), is_active, created_at)

kitchen_grids (id, store_id FK, grid_name, grid_rows, grid_cols, is_active, created_at, updated_at)

kitchen_equipment (id, kitchen_grid_id FK, equipment_type, equipment_key, grid_x, grid_y, grid_w, grid_h, equipment_config JSONB, storage_location_ids TEXT[], display_name, display_order, is_active, created_at, updated_at)

storage_locations (id, store_id FK, location_type CHECK('DRAWER','FRIDGE','FRIDGE_FLOOR','SEASONING','DECO_ZONE','FREEZER','PREP_TABLE','OTHER'), location_code TEXT (store 내 UNIQUE), location_name, grid_rows, grid_cols, has_floors, floor_count, parent_location_id FK self, position_order)

ingredients_master (id, ingredient_name UNIQUE, ingredient_name_en, category CHECK('채소','육류','해산물','계란','곡물','유제품','소스','조미료','가니쉬','토핑','기타'), base_unit)

ingredients_inventory (id, store_id FK, ingredient_master_id FK, storage_location_id FK, sku_code TEXT, grid_positions TEXT, grid_size TEXT, floor_number INT, display_order, UNIQUE(store_id, ingredient_master_id, storage_location_id))

recipes (id, store_id FK, menu_name, menu_name_en, menu_type CHECK('HOT','COLD','MIXED','FRYING'), category, difficulty_level, estimated_cooking_time, plate_type_id FK, is_active)

recipe_bundles (id, recipe_id FK, bundle_name, bundle_order, cooking_type CHECK('HOT','COLD','MICROWAVE','FRYING'), equipment_type, is_main_dish, merge_order)

recipe_steps (id, bundle_id FK, step_number, step_type CHECK('INGREDIENT','ACTION'), action_type, action_params JSONB, time_limit_seconds, is_order_critical, instruction)

recipe_ingredients (id, step_id FK, ingredient_master_id FK, inventory_id FK, required_amount NUMERIC, required_unit, is_exact_match_required)

deco_steps (id, recipe_id FK, deco_order INT, source_type CHECK('DECO_ITEM','SETTING_ITEM','BUNDLE'), source_deco_ingredient_id FK, source_bundle_id FK, grid_position, quantity, instruction, is_optional)
```

## 장비 타입 (어드민 팔레트에 표시되는 9종)

| type | 설명 | 저장 공간 연결 |
|------|------|---------------|
| BURNER | 화구+웍 | 없음 |
| SINK | 싱크대 | 없음 |
| DRAWER_FRIDGE | 서랍냉장고 | DRAWER 타입 location |
| FRIDGE_4BOX | 4호박스 냉장고 | FRIDGE + FRIDGE_FLOOR 타입 location |
| SEASONING_COUNTER | 조미료대 | SEASONING 타입 location |
| MICROWAVE | 전자레인지 | 없음 |
| FRYER | 튀김기 | 없음 |
| FREEZER | 냉동고 | FREEZER 타입 location |
| PREP_TABLE | 작업대(데코존) | DECO_ZONE 타입 location |

겹침 허용. 면적(grid_w × grid_h)이 작은 장비가 z-index 위로.

## RLS 현재 상태

적용 완료:
- 전 테이블: SELECT 허용
- stores: INSERT + UPDATE
- users: INSERT + UPDATE
- kitchen_grids: INSERT + UPDATE + DELETE
- kitchen_equipment: INSERT + UPDATE + DELETE
- game_sessions: INSERT + UPDATE

Phase 3에서 추가 필요:
- storage_locations: INSERT + UPDATE + DELETE
- ingredients_master: INSERT + UPDATE
- ingredients_inventory: INSERT + UPDATE + DELETE

## 핵심 도메인 개념

### 묶음(Bundle) vs 장비(Equipment)
- 묶음: 레시피에 따라 만들어지는 음식 단위. 주문 ID, 스텝, 재료, 위치를 안다.
- 장비: 독립된 물리 상태 (온도, 가열). 레시피/스텝/주문 정보를 모른다.
- 상호작용: 묶음이 요구하고 장비가 판정.

### 단일 플로우 원칙
장비별 별도 함수 금지. 하나의 통합 함수가 cooking_type/action_type으로 분기. DB 컬럼 값으로만 판별, 하드코딩 비교 금지.

### 장비-저장공간-재고 연결
```
kitchen_equipment.storage_location_ids → storage_locations.location_code → ingredients_inventory
```
장비의 storage_location_ids에는 UUID가 아니라 location_code(문자열)가 들어감.

## 스타일 규칙

- 배경: bg-[#F7F7F7]
- 텍스트: text-[#333] (주), text-[#757575] (보조)
- 프라이머리: bg-primary, hover:bg-primary-dark
- 카드: bg-white border border-[#E0E0E0] rounded-xl shadow-md
- 애니메이션: framer-motion (initial/animate/transition)
- UI 언어: 한국어

## 자주 발생하는 실수

1. **RLS INSERT 누락**: Supabase INSERT 시 403 에러. 정책 확인 필수.
2. **FK 순서 무시**: 부모 테이블 먼저 INSERT. stores → users → 나머지.
3. **store_id 빠뜨림**: 모든 쿼리에 .eq('store_id', storeId) 필수.
4. **gameStore 의존성**: 기존 컴포넌트가 gameStore 상태에 의존 → 어드민에서 그대로 import 시 에러 가능.
5. **grid_positions/grid_size**: TEXT 타입 ("1,2,3" / "2x2"). 숫자가 아님.
6. **store_code**: UNIQUE 제약. 중복 시 에러 핸들링 필요.
7. **FRIDGE_FLOOR 코드 규칙**: 반드시 {부모코드}_F{층번호} 형식 (예: FRIDGE_LT_F1). preloadStorageData()가 이 패턴에 의존.
8. **저장 로직은 UPSERT**: 전체 삭제 → INSERT 금지. 기존 UUID 유지해야 다른 테이블의 FK 참조가 안 깨짐.

## 현재 진행 상태

어드민 페이지 개발. docs/ADMIN_ROADMAP.md 참조.

- [x] Phase 1: 매장 생성 + 사용자/아바타 생성
- [x] Phase 2: 주방 레이아웃 (드래그앤드롭 장비 배치)
- [ ] Phase 3: 식자재 배치 (주방 에디터에서 장비 내부 열기) ← 현재
- [ ] Phase 4: 레시피 등록
- [ ] Phase 5: 시뮬레이터 연동 검증