# Kitchen Flow - 주방 시뮬레이션 훈련 플랫폼

## 프로젝트 개요

음식점 주방 직원 온보딩용 게임형 시뮬레이션. 실제 매장 주방을 그리드로 재현, 레시피에 따라 조리 → 데코 → 서빙을 훈련한다. 모든 데이터는 store_id 기준 분리 → 매장마다 다른 주방/식자재/레시피.

## 기술 스택

- React 18 + TypeScript + Vite
- Zustand (src/stores/gameStore.ts)
- Supabase (PostgreSQL + RLS, signInAnonymously)
- Tailwind CSS + framer-motion
- react-router-dom v6 (BrowserRouter)
- @tanstack/react-query, recharts

## 라우팅 (src/App.tsx)

```
/               → StoreSelect    매장 선택 (목록에서 클릭)
/user-login     → UserLogin      아바타 선택 + 비밀번호 (4자 이상, 개발모드)
/level-select   → LevelSelect    난이도 (BEGINNER/INTERMEDIATE/ADVANCED)
/game           → GamePlay       시뮬레이션 플레이
/result         → GameResult     결과 확인 (점수 + 그래프)
/admin/*        → (구현 예정)    어드민 페이지
```

## 핵심 파일 맵

```
src/
├── App.tsx                          라우팅 정의
├── main.tsx                         BrowserRouter + QueryClient 설정
├── lib/supabase.ts                  Supabase 클라이언트
├── types/database.types.ts          모든 타입 정의 (Store, User, Recipe, Wok 등)
├── stores/gameStore.ts              Zustand 전역 상태 (800줄+, 핵심 파일)
├── pages/
│   ├── StoreSelect.tsx              매장 목록 조회 + 선택
│   ├── UserLogin.tsx                사용자 목록 조회 + 비밀번호 로그인
│   ├── LevelSelect.tsx              난이도 선택 + startGame()
│   ├── GamePlay.tsx                 메인 게임 화면
│   └── GameResult.tsx               결과 표시 + 과거 기록 그래프
├── components/
│   ├── AppHeader.tsx                상단 헤더 (매장/사용자/레벨 표시, 로그아웃)
│   ├── DebugPanel.tsx               디버그 패널 (좌측 하단)
│   ├── GridPopup.tsx                그리드 팝업 (식자재 선택)
│   ├── Game/                        게임 UI 컴포넌트
│   ├── Kitchen/                     주방 장비 컴포넌트 (Burner, Sink, DrawerFridge 등)
│   └── Menu/                        메뉴 큐 컴포넌트
└── docs/
    └── TECHNICAL_DOCUMENTATION.md   기술 문서
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

## 현재 페이지 동작 상세

### StoreSelect.tsx
- `supabase.from('stores').select('*').order('store_name')` 으로 목록 조회
- localStorage에 마지막 선택 매장 ID 저장/표시
- 선택 시 `setStore(store)` + `navigate('/user-login', { state: { store } })`

### UserLogin.tsx
- `location.state.store` 또는 `currentStore`에서 매장 정보 획득
- `supabase.from('users').select('*').eq('store_id', storeId)` 로 사용자 목록 조회
- 비밀번호 모달 → 4자 이상이면 통과 (개발모드)
- `supabase.auth.signInAnonymously()` 호출 후 `setCurrentUser(user)`
- `navigate('/level-select')`

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

kitchen_grids (id, store_id FK, grid_name, grid_rows, grid_cols, grid_type, created_at)

kitchen_equipment (id, grid_id FK, equipment_type, equipment_name, grid_x, grid_y, grid_w, grid_h, equipment_config JSONB, storage_location_ids TEXT[], is_active, created_at)

storage_locations (id, store_id FK, location_type CHECK('DRAWER','FRIDGE','FRIDGE_FLOOR','SEASONING','DECO_ZONE','PREP_TABLE','OTHER'), location_code UNIQUE per store, location_name, grid_rows, grid_cols, has_floors, floor_count, parent_location_id FK self, position_order)

ingredients_master (id, ingredient_name UNIQUE, ingredient_name_en, category CHECK('채소','육류','해산물','계란','곡물','유제품','소스','조미료','가니쉬','토핑','기타'), base_unit)

ingredients_inventory (id, store_id FK, ingredient_master_id FK, storage_location_id FK, sku_full TEXT, standard_amount NUMERIC, standard_unit, grid_positions TEXT, grid_size TEXT, floor_number INT, description)

recipes (id, store_id FK, menu_name, menu_name_en, menu_type CHECK('HOT','COLD','MIXED','FRYING'), category, difficulty_level, estimated_cooking_time, plate_type_id FK, is_active)

recipe_bundles (id, recipe_id FK, bundle_name, bundle_order, cooking_type CHECK('WOK','BOIL','DEEP_FRY','MICROWAVE','COLD_PREP','NO_COOK'), equipment_type, is_main_dish, merge_order)

recipe_steps (id, bundle_id FK, step_number, step_type CHECK('INGREDIENT','ACTION'), action_type, action_params JSONB, time_limit_seconds, is_order_critical, instruction)

recipe_ingredients (id, step_id FK, ingredient_master_id FK, inventory_id FK, required_amount NUMERIC, required_unit, is_exact_match_required)

deco_steps (id, recipe_id FK, deco_order INT, source_type CHECK('DECO_ITEM','SETTING_ITEM','BUNDLE'), source_deco_ingredient_id FK, source_bundle_id FK, grid_position, quantity, instruction, is_optional)
```

## RLS 현재 상태

- 전 테이블: SELECT 허용 (anon + authenticated)
- game_sessions만: INSERT + UPDATE 허용
- 나머지 테이블: INSERT/UPDATE/DELETE 정책 없음
- ⚠️ 어드민 기능 구현 시 stores, users 등에 INSERT/UPDATE 정책 추가 필요

## 현재 타입 정의 vs 실제 DB 불일치 주의

database.types.ts의 타입이 실제 DB 스키마와 완전히 일치하지 않음:
- KitchenLayout 타입: burner_count, has_sink 등 → 실제 DB는 kitchen_grids + kitchen_equipment 분리 구조
- User 타입: role 필드 없음 → 실제 DB에는 role CHECK('ADMIN','MANAGER','STAFF') 존재
- Recipe 타입: steps가 RecipeStep[] → 실제 DB는 recipe_bundles → recipe_steps 계층

새 기능 구현 시 실제 DB 스키마 (01_SCHEMA_CREATE.sql) 기준으로 타입 추가/수정할 것.

## 핵심 도메인 개념

### 묶음(Bundle) vs 장비(Equipment)

- 묶음: 레시피에 따라 만들어지는 음식 단위. 주문 ID, 스텝, 재료, 위치를 안다. 장비 물리 상태는 모른다.
- 장비: 독립된 물리 상태 (온도, 가열). 레시피/스텝/주문 정보를 모른다.
- 상호작용: 묶음이 요구하고 장비가 판정. "웍에 물이 있고 끓는 상태이므로 소면 투입 조건 충족" (장비가 주체).

### 단일 플로우 원칙

장비별 별도 함수 금지. 하나의 통합 함수가 cooking_type/action_type으로 분기. DB 컬럼 값으로만 판별, 하드코딩 비교 금지.

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

## 현재 진행 중

어드민 페이지 개발. docs/ADMIN_ROADMAP.md 참조.

Phase 1: 매장 생성 + 사용자/아바타 생성
Phase 2: 주방 레이아웃 (드래그앤드롭 장비 배치)
Phase 3: 저장 공간 + 식자재 배치
Phase 4: 레시피 등록
Phase 5: 시뮬레이터 연동 검증

각 Phase 완료 후 시뮬레이터에서 테스트 아바타로 접속하여 정상 작동 확인.