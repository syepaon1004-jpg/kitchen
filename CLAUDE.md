# Kitchen Simulator - 주방 시뮬레이션 훈련 플랫폼

## 1. 프로젝트 개요

외식업 주방 직원이 레시피와 재료 위치를 학습하는 웹 기반 훈련 시뮬레이터.
플레이어는 주문을 받아 재료를 찾고, 조리하고, 플레이팅하여 서빙하는 전체 주방 워크플로우를 연습한다.

- **게임 루프**: 주문 접수 → 장비 배정 → 재료 투입 → 조리 액션 → 플레이팅 → 서빙
- **난이도**: BEGINNER(신입) / INTERMEDIATE(알바) / ADVANCED(관리자)
- **메뉴 타입**: HOT_ONLY(볶음밥), COLD_ONLY(샐러드), MIXED(육회물회=HOT+COLD), SINGLE

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | React + TypeScript | React 19, TS 5.9 |
| 빌드 | Vite | 7.2 |
| 상태관리 | Zustand | 5.0 |
| 스타일링 | Tailwind CSS | 3.4 |
| 백엔드/DB | Supabase (PostgreSQL) | 2.47 |
| 라우팅 | React Router DOM | 7.0 |
| 데이터 페칭 | TanStack React Query | 5.59 |
| 애니메이션 | Framer Motion | 11.11 |
| 차트 | Recharts | 2.13 |
| 그리드 레이아웃 | React Grid Layout | 2.2 |
| 배포 | Netlify | - |
| 분석 | Microsoft Clarity | - |

## 3. 폴더/파일 구조

```
kitchen-simulator/
├── .claude/                          # 개발 문서
│   ├── HANDOFF_FRONTEND_260207.md    # 프론트엔드 가이드
│   └── HANDOFF_BACKEND_260207.md     # 백엔드/스토어 가이드
├── public/images/                    # 정적 이미지
├── supabase/                         # SQL 시드/마이그레이션
│   ├── full_test_data.sql            # 마스터 테스트 데이터
│   ├── add_10_menus.sql              # 레시피 예시
│   └── kimchi_fried_rice_recipe.sql  # 상세 레시피 예시
├── src/
│   ├── api/
│   │   └── kitchenEditorApi.ts       # 주방 에디터 API
│   ├── components/
│   │   ├── AppHeader.tsx             # 상단 헤더 (매장/유저/레벨)
│   │   ├── DebugPanel.tsx            # 개발용 디버그 패널
│   │   ├── GridPopup.tsx             # 범용 그리드 선택 팝업
│   │   ├── Game/
│   │   │   ├── ActionLogPanel.tsx    # 액션 히스토리
│   │   │   ├── GameHeader.tsx        # 게임 타이머/진행률
│   │   │   └── RecipeGuide.tsx       # 레시피 정답지 (웍별)
│   │   ├── Kitchen/
│   │   │   ├── KitchenViewport.tsx   # 주방 스크롤 뷰포트
│   │   │   ├── KitchenRenderer.tsx   # CSS Grid 장비 배치
│   │   │   ├── equipmentRegistry.ts  # 장비 타입 → 컴포넌트 매핑
│   │   │   ├── BurnerEquipment.tsx   # 버너/웍 (핵심 조리 장비)
│   │   │   ├── StorageEquipment.tsx  # 냉장고/서랍/냉동고
│   │   │   ├── SeasoningEquipment.tsx # 양념 카운터
│   │   │   ├── SinkEquipment.tsx     # 싱크대
│   │   │   ├── PrepTableEquipment.tsx # 조리대
│   │   │   ├── PlaceholderEquipment.tsx # 미구현 장비 플레이스홀더
│   │   │   ├── equipment/
│   │   │   │   ├── FryerEquipment.tsx    # 튀김기 (v3.3 isSubmerged)
│   │   │   │   ├── MicrowaveEquipment.tsx # 전자레인지
│   │   │   │   └── FreezerEquipment.tsx   # 냉동고
│   │   │   ├── DecoZone.tsx          # 플레이팅/데코 시스템 (핵심)
│   │   │   ├── DecoAmountPopup.tsx   # 데코 수량 입력
│   │   │   ├── AmountInputPopup.tsx  # 단일 재료 수량 입력
│   │   │   ├── BatchAmountInputPopup.tsx # 일괄 재료 입력
│   │   │   ├── SettingAmountPopup.tsx # 세팅존 수량 입력
│   │   │   ├── PlateSelectPopup.tsx  # 접시 선택
│   │   │   ├── FryerSetupPopup.tsx   # 튀김기 설정
│   │   │   ├── MicrowaveSetupPopup.tsx # 전자레인지 설정
│   │   │   ├── IngredientModeSelector.tsx # 투입/세팅 모드 전환
│   │   │   ├── FridgeZoomView.tsx    # 냉장고 확대 뷰
│   │   │   ├── FridgeBox.tsx         # 4칸 냉장고
│   │   │   ├── DrawerFridge.tsx      # 서랍 냉장고
│   │   │   ├── SeasoningCounter.tsx  # 양념 UI
│   │   │   ├── WokDryingManager.tsx  # 웍 건조 타이머
│   │   │   ├── LegacyKitchenLayout.tsx # 레거시 폴백
│   │   │   ├── Burner.tsx            # (레거시, BurnerEquipment로 대체됨)
│   │   │   └── SinkArea.tsx          # (레거시, SinkEquipment로 대체됨)
│   │   └── Menu/
│   │       └── MenuQueue.tsx         # 주문 대기열
│   ├── hooks/
│   │   └── useSound.ts              # 사운드 효과
│   ├── lib/
│   │   └── supabase.ts              # Supabase 클라이언트
│   ├── pages/
│   │   ├── GamePlay.tsx              # 메인 게임 페이지 (핵심 오케스트레이터)
│   │   ├── GameResult.tsx            # 결과/점수 화면
│   │   ├── KitchenEditor.tsx         # 주방 배치 에디터 (관리자)
│   │   ├── LevelSelect.tsx           # 난이도 선택
│   │   ├── StoreSelect.tsx           # 매장 선택
│   │   ├── TestKitchen.tsx           # 주방 테스트
│   │   └── UserLogin.tsx             # 로그인
│   ├── stores/
│   │   └── gameStore.ts              # 중앙 상태관리 (Zustand, ~2800줄)
│   ├── types/
│   │   └── database.types.ts         # 전체 타입 정의 (~820줄)
│   └── utils/
│       └── grid.ts                   # 그리드 유틸리티
├── CLAUDE.md                         # 이 파일
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 4. 핵심 도메인 개념

### 4-1. 묶음(Bundle)과 장비(Equipment) 분리 원칙

> **묶음 = "뭘 만들고 있나"**, **장비 = "장비 자체의 물리 상태"**

| 개념 | 예시 | 상태관리 |
|------|------|----------|
| 묶음 (BundleInstance) | 볶음밥 만드는 중 | `bundleInstances[]` - location, cooking progress, ingredients |
| 장비 (Wok/Fryer/Microwave) | 웍 온도 250°C, 기름 180°C | `woks[]`, `fryerState`, `microwaveState` |

**핵심 규칙:**
- **장비가 주체**: "웍이 소면을 끓이려면 웍에 물이 있어야 해" (O) / "소면을 넣으려면 웍에 물이 있어야 해" (X)
- **위치 이동 = location 필드만 변경**: 묶음 데이터는 불변, 컨테이너 간 데이터 변환 없음
- **묶음은 장비를 이동할 수 있다**: `WOK → PLATE_SELECT → DECO_MAIN → SERVED`

### 4-2. BundleLocation (위치 유니온 타입)

```typescript
| { type: 'NOT_ASSIGNED' }              // 미배정
| { type: 'WOK'; burnerNumber }         // 버너에서 조리 중
| { type: 'MICROWAVE' }                 // 전자레인지
| { type: 'FRYER'; basketNumber }       // 튀김기 바스켓
| { type: 'PLATE_SELECT' }             // 접시 선택 중
| { type: 'DECO_MAIN'; plateId }       // 메인 플레이팅 존
| { type: 'DECO_SETTING' }             // 세팅 존 (사이드)
| { type: 'MERGED'; targetInstanceId }  // 메인에 합쳐짐
| { type: 'SERVED' }                    // 서빙 완료
```

### 4-3. 메뉴 타입별 플로우

```
HOT_ONLY (볶음밥):
  주문 → 웍 배정 → 재료투입 → 볶기 → 서빙

COLD_ONLY (샐러드):
  주문 → 접시선택 → 플레이팅(데코존) → 서빙

MIXED (육회물회):
  주문 → [HOT묶음: 웍 조리] + [COLD묶음: 접시→데코존] + [MICROWAVE묶음: 가열]
       → 각각 완성 후 메인에 합치기(mergeBundle) → 서빙

FRYING (돈까스):
  주문 → 튀김기 배정 → 바스켓 담기 → 기름 투입(isSubmerged) → 서빙
```

### 4-4. 합치기 원칙 (mergeBundle)

`mergeBundle(targetInstanceId, sourceInstanceId)`

**처리 순서:**
1. 두 BundleInstance 찾기
2. `recipeId` 일치 검증 (orderId 아님 - **크로스 오더 허용**)
3. `target.isMainDish === true` 검증
4. `deco_steps`에서 `source_type === 'BUNDLE' && source_bundle_id === source.bundleId` 검색
5. 순서 검증 (`deco_order` 기준, level별 분기)
6. `target.plating`에 레이어 추가
7. `moveBundle(sourceInstanceId, { type: 'MERGED', targetInstanceId })`

| 규칙 | 설명 |
|------|------|
| 매칭 기준 | `source_bundle_id` (recipe_bundles.id) - 묶음 템플릿 레벨 |
| 크로스 오더 | recipeId만 일치하면 orderId 달라도 합치기 허용 |
| 방향 | 비메인(DECO_SETTING) → 메인(DECO_MAIN)으로만 합침 |
| 순서 | `deco_steps.deco_order` 기준. BEGINNER면 순서 틀리면 거절, 그 외 감점 |

**예시 - 육회물회 합치기 순서:**
```
메인(COLD, DECO_MAIN) <- 냉면육수(MICROWAVE, DECO_SETTING)  deco_order 1
                      <- 소면(HOT, DECO_SETTING)            deco_order 2
                      <- 쫄면야채(데코 아이템)                deco_order 3
                      <- 육회(MICROWAVE, DECO_SETTING)       deco_order 4
                      <- 부추+깨+참기름(데코 아이템)           deco_order 5
```

## 5. DB 테이블 의존 관계

### 5-1. 레시피 계층 구조

```
Recipe (store_id, menu_name, menu_type, category, difficulty_level)
  └─ RecipeBundle[] (recipe_id FK)
      ├─ cooking_type: 'HOT' | 'COLD' | 'MICROWAVE' | 'FRYING'
      ├─ is_main_dish: boolean
      ├─ plate_type_id FK → PlateType
      ├─ merge_target_bundle_id FK → RecipeBundle (자기참조)
      └─ RecipeStep[] (bundle_id FK)
          ├─ step_type: 'INGREDIENT' | 'ACTION'
          ├─ action_type: 'STIR_FRY' | 'FLIP' | 'BOIL' | 'ADD_WATER' | 'DEEP_FRY' ...
          ├─ action_params: { required_duration, power, ... }
          └─ RecipeIngredient[] (recipe_step_id FK)
              ├─ ingredient_master_id FK → IngredientMaster
              ├─ inventory_id FK → IngredientInventory
              ├─ required_amount, required_unit
              └─ is_exact_match_required
```

### 5-2. 재료/저장소 계층

```
IngredientMaster (ingredient_name, category, base_unit)
  ↑
IngredientInventory (store_id)
  ├─ ingredient_master_id FK → IngredientMaster
  ├─ storage_location_id FK → StorageLocation
  ├─ sku_code, standard_amount, standard_unit
  └─ grid_positions, grid_size, floor_number

StorageLocation (store_id)
  ├─ location_type: 'FRIDGE' | 'DRAWER' | 'SEASONING'
  ├─ parent_location_id FK → StorageLocation (자기참조, 층 구분)
  └─ section_code, position_order
```

### 5-3. 데코 시스템

```
DecoStep (레시피별 데코 순서)
  ├─ recipe_id FK → Recipe
  ├─ deco_order: number (순서)
  ├─ source_type: 'DECO_ITEM' | 'SETTING_ITEM' | 'BUNDLE'
  ├─ deco_ingredient_id FK → DecoIngredient  (source_type='DECO_ITEM')
  ├─ inventory_id FK → IngredientInventory   (source_type='SETTING_ITEM')
  ├─ source_bundle_id FK → RecipeBundle      (source_type='BUNDLE')
  └─ grid_position, layer_image_url, layer_order

DecoIngredient (매장별 데코 재료 마스터)
  ├─ ingredient_master_id FK → IngredientMaster
  ├─ deco_category: 'GARNISH' | 'SAUCE' | 'TOPPING'
  └─ has_exact_amount

PlateType (접시 마스터)
  ├─ plate_type: 'BOWL' | 'FLAT' | 'DEEP' | 'TRAY'
  └─ grid_size, deco_slots
```

### 5-4. 주방 장비

```
KitchenGrid (store_id, grid_cols, grid_rows, is_active)
  └─ KitchenEquipment[] (kitchen_grid_id FK)
      ├─ equipment_type: 'BURNER' | 'SINK' | 'DRAWER_FRIDGE' | 'FRIDGE_4BOX' |
      │    'SEASONING_COUNTER' | 'FRYER' | 'PREP_TABLE' | 'MICROWAVE' | 'FREEZER' |
      │    'PLATING_STATION' | 'CUTTING_BOARD' | 'TORCH' | 'COLD_TABLE' | ...
      ├─ equipment_key: string ('burner_1', 'sink_main')
      ├─ grid_x, grid_y, grid_w, grid_h (CSS Grid 위치)
      ├─ equipment_config: EquipmentConfig (장비별 설정, 태그드 유니온)
      └─ storage_location_ids: string[] (연결된 저장소)
```

### 5-5. FK 관계 요약표

| 테이블 | 필드 | 참조 | 용도 |
|--------|------|------|------|
| IngredientInventory | ingredient_master_id | IngredientMaster | 어떤 재료 |
| IngredientInventory | storage_location_id | StorageLocation | 어디에 저장 |
| RecipeBundle | recipe_id | Recipe | 부모 레시피 |
| RecipeBundle | plate_type_id | PlateType | COLD 메뉴 접시 |
| RecipeBundle | merge_target_bundle_id | RecipeBundle | MIXED 합치기 대상 |
| RecipeStep | bundle_id | RecipeBundle | 어떤 묶음의 스텝 |
| RecipeIngredient | ingredient_master_id | IngredientMaster | 재료 종류 |
| RecipeIngredient | inventory_id | IngredientInventory | 재고 위치 |
| DecoStep | recipe_id | Recipe | 어떤 레시피의 데코 |
| DecoStep | deco_ingredient_id | DecoIngredient | 데코 아이템 |
| DecoStep | source_bundle_id | RecipeBundle | 묶음 소스 |
| KitchenEquipment | kitchen_grid_id | KitchenGrid | 어떤 그리드 |

## 6. 상태관리 구조 (gameStore.ts)

### 6-1. 전체 구조

단일 Zustand 스토어 (`gameStore.ts`, ~2800줄)가 모든 게임 상태를 관리한다.

```
gameStore
├── 세션/유저 ─── currentStore, currentUser, currentSession, level
├── 레시피 데이터 ─── recipes[], recipeBundles[], decoSteps[], plateTypes[]
├── 재료 데이터 ─── ingredients[], seasonings[], storageCache, decoIngredients[]
├── 주방 장비 ─── kitchenGrid, kitchenEquipment[]
├── 주문 관리 ─── menuQueue[], usedMenuNames
├── 묶음 관리 ─── bundleInstances[] (★ v3.1 중앙 레지스트리)
├── 웍 물리 ─── woks[] (온도, 상태, 물 끓임)
├── 튀김기 ─── fryerState { baskets[], oilTemperature }
├── 전자레인지 ─── microwaveState { status, currentItem, waitingItems }
├── 데코존 ─── decoPlates[], decoSettingItems[], selectedDecoIngredient
├── UI 상태 ─── fridgeViewState, currentZone, ingredientMode, mergeMode
├── 게임 진행 ─── isPlaying, elapsedSeconds, completedMenus, targetMenus
└── 로그/에러 ─── actionLogs[], burnerUsageHistory[], lastServeError
```

### 6-2. 핵심 액션 함수

#### 묶음 라이프사이클

| 함수 | 역할 |
|------|------|
| `assignBundle(orderId, bundleId, location, config)` | 주문을 장비에 배정, BundleInstance 생성 |
| `addIngredientToBundle(instanceId, ingredientId, amount)` | 현재 스텝에 재료 투입 |
| `executeAction(instanceId, actionType)` | 조리 액션 실행 (볶기, 뒤집기, 끓이기...) |
| `completeBundle(instanceId)` | 조리 완료 → PLATE_SELECT 이동 |
| `routeAfterPlate(instanceId, plateType)` | 접시 선택 후 DECO_MAIN 또는 DECO_SETTING으로 라우팅 |
| `mergeBundle(targetId, sourceId)` | 사이드 묶음을 메인에 합치기 |
| `serveBundle(instanceId)` | 서빙 완료 |
| `discardBundle(instanceId)` | 폐기 (타버림/실패) |

#### 튀김기 물리 (v3.3)

| 함수 | 역할 |
|------|------|
| `lowerBundle(instanceId)` | 바스켓을 기름에 담금 (`isSubmerged = true`) |
| `liftBundle(instanceId)` | 바스켓을 기름에서 꺼냄 (`isSubmerged = false`) |
| `tickBundleTimers()` | isSubmerged일 때만 시간 경과, 자동 스텝 진행 |

#### 웍/온도 물리

| 함수 | 역할 |
|------|------|
| `toggleBurner(burnerNumber)` | 버너 점화/소화 |
| `setHeatLevel(burnerNumber, level)` | 화력 조절 (1/2/3) |
| `updateWokTemperatures()` | 온도 물리 시뮬레이션 (매 틱) |
| `startStirFry/stopStirFry` | 볶기 시작/종료 |
| `washWok/emptyWok` | 웍 세척/비우기 |

#### 셀렉터 함수

```typescript
getWokBundle(burnerNumber)       // 해당 버너의 묶음
getMicrowaveBundles()            // 전자레인지 묶음들
getFryerBundle(basketNumber)     // 해당 바스켓의 묶음
getDecoMainPlates()              // 메인 플레이팅 묶음들
getSettingBundles()              // 세팅존 묶음들
getOrderBundles(orderId)         // 해당 주문의 모든 묶음
```

### 6-3. 데이터 흐름

```
Supabase DB
    ↓ loadStoreData()
gameStore (recipes, recipeBundles, decoSteps, ingredients, ...)
    ↓ useGameStore() 호출
Components (UI 렌더링)
    ↓ 유저 액션 (클릭/입력)
gameStore actions (assignBundle, addIngredient, ...)
    ↓ set() 호출
bundleInstances[] / woks[] / fryerState 업데이트
    ↓ React 리렌더
Components 갱신
```

### 6-4. 온도 물리 상수

```typescript
WOK_TEMP = {
  AMBIENT: 25,         // 상온
  SMOKING_POINT: 300,  // 발연점
  BURNED: 400,         // 타버림
  MAX_SAFE: 420,       // 최대 안전 온도
  BASE_HEAT_RATE: 25.2,// 기본 가열 속도 (°C/s)
  COOL_RATE: 5,        // 냉각 속도 (°C/s)
  WATER_BOIL: 100,     // 물 끓는 온도
  WATER_HEAT_RATE: 2.5,// 물 가열 속도
  HEAT_MULTIPLIER: { 1: 0.78, 2: 1.56, 3: 1.82 }  // 화력별 배율
}

FRYER_TEMP = {
  OPTIMAL: 180,        // 최적 튀김 온도
  MIN_FRYING: 160,     // 최소 튀김 온도
  MAX_SAFE: 200        // 최대 안전 온도
}
```

## 7. 파일 간 의존성 (수정 시 확인 필요)

### 7-1. 핵심 허브 파일

| 허브 파일 | 역할 | 의존하는 파일 수 |
|-----------|------|------------------|
| `gameStore.ts` | 중앙 상태관리 | **37개 파일** (거의 모든 컴포넌트) |
| `database.types.ts` | 타입 정의 | gameStore + 타입 사용하는 모든 파일 |
| `equipmentRegistry.ts` | 장비→컴포넌트 매핑 | KitchenRenderer + 모든 장비 컴포넌트 |
| `GamePlay.tsx` | 메인 오케스트레이터 | 14+ 자식 컴포넌트 |

### 7-2. 수정 영향 범위 맵

| 이 파일을 수정하면 | 같이 확인해야 할 파일 |
|---|---|
| **gameStore.ts** | GamePlay.tsx, DecoZone.tsx, MenuQueue.tsx, RecipeGuide.tsx, 모든 Equipment 컴포넌트 |
| **database.types.ts** | gameStore.ts, 타입을 직접 import하는 컴포넌트들 |
| **GamePlay.tsx** | RecipeGuide, GameHeader, MenuQueue, 모든 팝업 컴포넌트, DecoZone |
| **BurnerEquipment.tsx** | equipmentRegistry.ts, KitchenRenderer.tsx, GamePlay.tsx |
| **StorageEquipment.tsx** | equipmentRegistry.ts, GridPopup.tsx, GamePlay.tsx (콜백) |
| **DecoZone.tsx** | GamePlay.tsx, DecoAmountPopup.tsx, gameStore (plating 상태) |
| **MenuQueue.tsx** | GamePlay.tsx, gameStore (menuQueue, recipeBundles) |
| **KitchenRenderer.tsx** | KitchenViewport.tsx, equipmentRegistry.ts, 모든 장비 컴포넌트 |
| **equipmentRegistry.ts** | KitchenRenderer.tsx, 등록된 모든 장비 컴포넌트 |
| **PlateSelectPopup.tsx** | GamePlay.tsx, BurnerEquipment.tsx, gameStore |
| **RecipeGuide.tsx** | GamePlay.tsx, gameStore (woks, recipes) |

### 7-3. 렌더 체인

```
GamePlay.tsx
  ├── GameHeader.tsx + RecipeGuide.tsx + ActionLogPanel.tsx
  ├── MenuQueue.tsx
  ├── KitchenViewport.tsx → KitchenRenderer.tsx → equipmentRegistry.ts → [장비 컴포넌트들]
  ├── DecoZone.tsx → DecoAmountPopup.tsx
  └── 조건부 팝업들 (AmountInput, PlateSelect, FryerSetup, MicrowaveSetup, ...)
```

### 7-4. 컴포넌트 통신 패턴

| 패턴 | 사용처 |
|------|--------|
| **Props** | GamePlay → MenuQueue, GamePlay → DecoZone |
| **Zustand 직접 접근** | 모든 컴포넌트가 `useGameStore()` 직접 호출 |
| **콜백 via Store** | GamePlay가 `setIngredientCallbacks()` 설정 → Storage/Seasoning 컴포넌트 사용 |
| **Custom Event** | `window.dispatchEvent('openPlateSelectPopup')` 등 |
| **Dynamic Registry** | KitchenRenderer → equipmentRegistry → 장비 컴포넌트 동적 로딩 |

## 8. 자주 발생하는 버그 패턴과 주의사항

### 8-1. bundleId 미전달 (MIXED 메뉴)

- **증상**: MIXED 메뉴에서 잘못된 스텝이 표시됨
- **원인**: UI → Store 경로에서 `bundleId` 누락
- **체크포인트**: MenuQueue → GamePlay → assignMenuToWok → getCurrentStepIngredients 전체 경로
- **해결**: 모든 함수 호출에 `bundleId`가 전달되는지 확인

### 8-2. recipe_id 필터링 누락 (데코존)

- **증상**: 다른 레시피의 재료가 데코존에서 허용됨
- **원인**: `decoSteps` 조회 시 `recipe_id` 조건 빠짐
- **해결**: **절대 fallback 없이** 반드시 `recipe_id` 조건 포함

### 8-3. SKU 파싱 오류

- **증상**: 재료 매칭 실패
- **원인**: 콜론(`:`) 포함 SKU를 올바르게 파싱하지 않음
- **해결**: `split(':')[1]` 사용. v3에서는 FK 기반이므로 SKU 파싱 최소화

### 8-4. grid_position vs grid_positions

- **증상**: 데코 아이템 위치 매칭 실패
- **원인**: DB에 `grid_position`(단수)과 `grid_positions`(복수, 배열) 두 필드 존재
- **해결**: 항상 **둘 다 체크**하는 코드 작성

### 8-5. 웍 상태 초기화 누락

- **증상**: 서빙 후 웍에 이전 메뉴 데이터 잔존
- **원인**: `serve`/`discard` 시 웍 필드 일부 초기화 누락
- **해결**: currentMenu, currentOrderId, currentBundleId, currentStep, totalSteps, addedIngredientIds 전부 초기화

### 8-6. 튀김기 isSubmerged 상태 불일치

- **증상**: 바스켓이 올라와 있는데 시간이 흐르거나, 내려가 있는데 안 흐름
- **원인**: `lowerBundle`/`liftBundle`에서 `isSubmerged` 플래그 불일치
- **해결**: `tickBundleTimers()`가 반드시 `isSubmerged === true`일 때만 시간 증가

### 8-7. 레거시/v3 혼용 주의

- **폐기된 타입**: `Seasoning`, `DecoDefaultItem`, `DecoRule`, `DecoItemImage`
- **현행 타입**: `IngredientInventory(location_type='SEASONING')`, `DecoIngredient`, `DecoStep`
- **주의**: 새 기능은 반드시 v3(FK 기반) 타입 사용

## 9. 코딩 규칙

### 9-1. 수정 원칙 (모든 작업에 필수 적용)

1. **단일 플로우 원칙** - 장비별 별도 함수 금지. 하나의 통합 함수가 `cooking_type`/`action_type`으로 분기
2. **DB 구조 기반 수정** - 하드코딩 비교 금지. DB 컬럼 값(`cooking_type`, `is_main_dish`, `action_type`, `action_params`)으로만 판별
3. **데이터 흐름 추적** - 증상이 아니라 DB → gameStore → 컴포넌트 흐름의 근본 원인 수정

### 9-2. 난이도별 검증 분기

| 항목 | BEGINNER | INTERMEDIATE/ADVANCED |
|------|----------|----------------------|
| 재료 수량 | 정확히 일치해야 함 (틀리면 에러, 진행 안됨) | 틀려도 에러 기록 후 진행 |
| 데코 순서 | 순서 틀리면 합치기 거절 | 순서 틀려도 허용 (감점) |
| 온도/타이밍 | 엄격 | 허용 (감점) |

### 9-3. 네이밍 & 컨벤션

- **컴포넌트**: PascalCase (`BurnerEquipment.tsx`)
- **함수/변수**: camelCase (`assignBundle`, `currentStep`)
- **타입**: PascalCase (`BundleInstance`, `RecipeStep`)
- **상수**: UPPER_SNAKE_CASE (`WOK_TEMP`, `FRYER_TEMP`)
- **장비 키**: snake_case (`burner_1`, `sink_main`, `fryer_basket_2`)

### 9-4. 스타일링

- Tailwind CSS 사용 (인라인 클래스)
- 커스텀 색상: `primary`, `secondary`, `wok-clean`, `wok-wet`, `wok-dirty`, `wok-burned`
- 반응형: 모바일/데스크톱 대응

### 9-5. 상태 변경 패턴

```typescript
// Zustand set() 패턴 - 불변 업데이트
set((state) => ({
  bundleInstances: state.bundleInstances.map(b =>
    b.id === instanceId ? { ...b, location: newLocation } : b
  )
}));
```

### 9-6. 장비 추가 시 체크리스트

1. `database.types.ts`에 Config 타입 추가
2. `equipment_type` 유니온에 추가
3. `equipmentRegistry.ts`에 컴포넌트 등록
4. 장비 컴포넌트 파일 생성 (`src/components/Kitchen/equipment/`)
5. gameStore에 해당 장비 상태 및 액션 추가
6. GamePlay.tsx에서 팝업/UI 연결

## 참고 문서

- `.claude/HANDOFF_FRONTEND_260207.md` - 프론트엔드 상세 가이드
- `.claude/HANDOFF_BACKEND_260207.md` - 백엔드/스토어 상세 가이드
