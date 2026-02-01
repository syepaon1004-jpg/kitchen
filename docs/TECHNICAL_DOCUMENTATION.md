# 🍳 Kitchen Simulator - Technical Documentation
## AI/개발자용 상세 기술 문서

> **목적**: 이 문서는 다른 AI 또는 개발자가 프로젝트의 전체 구조와 로직을 완벽하게 이해하고 동일한 수준의 개발/디버깅을 할 수 있도록 작성되었습니다.

---

## 📋 목차

1. [시스템 개요](#1-시스템-개요)
2. [데이터 아키텍처](#2-데이터-아키텍처)
3. [상태 관리 (Zustand Store)](#3-상태-관리-zustand-store)
4. [핵심 게임 로직](#4-핵심-게임-로직)
5. [컴포넌트 구조](#5-컴포넌트-구조)
6. [데이터 흐름](#6-데이터-흐름)
7. [Supabase 데이터베이스](#7-supabase-데이터베이스)
8. [중요 알고리즘](#8-중요-알고리즘)

---

## 1. 시스템 개요

### 1.1 프로젝트 개요
**Kitchen Simulator**는 중식당 주방 시뮬레이션 게임입니다. 플레이어는 실시간으로 들어오는 주문을 받아 레시피에 맞게 조리하고 서빙하는 게임입니다.

### 1.2 기술 스택
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand
- **UI Framework**: Tailwind CSS
- **Animation**: Framer Motion
- **Database**: Supabase (PostgreSQL)
- **Build**: Vite + TypeScript
- **Deployment**: Netlify

### 1.3 핵심 시뮬레이션 시스템
1. **실시간 물리 시뮬레이션**: 웍 온도, 불 세기, 재료 투입 시 온도 변화
2. **레시피 검증 시스템**: 단계별 재료/액션 검증
3. **난이도별 게임 로직**: BEGINNER/INTERMEDIATE/ADVANCED
4. **메뉴 타이머 시스템**: 7분 목표, 15분 초과 시 자동 취소
5. **배치 입력 시스템**: 여러 재료를 한 번에 선택/투입

---

## 2. 데이터 아키텍처

### 2.1 핵심 타입 정의

#### 2.1.1 Wok (웍) 상태
```typescript
export interface Wok {
  // 기본 정보
  burnerNumber: number          // 화구 번호 (1, 2, 3)
  isOn: boolean                 // 불 켜짐 여부
  state: WokState               // 'CLEAN' | 'WET' | 'DIRTY' | 'BURNED' | 'OVERHEATING'
  position: WokPosition         // 'AT_BURNER' | 'AT_SINK' | 'MOVING_TO_SINK' | 'MOVING_TO_BURNER'
  
  // 조리 정보
  currentMenu: string | null     // 현재 조리 중인 메뉴 이름
  currentOrderId: string | null  // 현재 주문 ID
  currentStep: number            // 현재 레시피 스텝 (0부터 시작)
  stepStartTime: number | null   // 현재 스텝 시작 시간 (타임아웃 검증용)
  burnerOnSince: number | null   // 불을 켠 시간
  addedIngredients: string[]     // 현재 스텝에서 투입한 재료 SKU 목록
  
  // 온도 시스템
  temperature: number            // 현재 온도 (°C)
  heatLevel: number             // 불 세기 (1:약불, 2:중불, 3:강불)
  
  // 볶기 시스템
  isStirFrying: boolean         // 볶기 중 여부
  stirFryStartTime: number | null // 볶기 시작 시간
  stirFryCount: number          // 현재 스텝에서 볶기 횟수
  
  // 물 시스템
  hasWater: boolean             // 물 있음 여부
  waterTemperature: number      // 물 온도
  waterBoilStartTime: number | null // 100도 도달 시간
  isBoiling: boolean            // 끓고 있는지 여부
  
  // 레시피 정확도 (신입 아닐 때만)
  recipeErrors: number          // 누적 오류 횟수
  totalSteps: number            // 현재 메뉴의 총 스텝 수
}
```

#### 2.1.2 MenuOrder (주문)
```typescript
export interface MenuOrder {
  id: string                     // 주문 고유 ID (order-{timestamp}-{random})
  menuName: string               // 메뉴 이름
  enteredAt: number              // 주문 들어온 시간 (elapsedSeconds)
  status: MenuOrderStatus        // 'WAITING' | 'COOKING' | 'COMPLETED'
  assignedBurner: number | null  // 배정된 화구 번호
  servedAt?: Date                // 서빙 시간
}
```

#### 2.1.3 Recipe (레시피)
```typescript
export interface Recipe {
  id: string
  store_id: string
  menu_name: string
  category?: string
  difficulty_level?: string
  steps?: RecipeStep[]          // 조리 단계
}

export interface RecipeStep {
  id: string
  recipe_id: string
  step_number: number           // 단계 순서 (1부터 시작)
  step_group?: number           // 단계 그룹 (병렬 처리용, 현재 미사용)
  step_type: 'INGREDIENT' | 'ACTION'  // 단계 타입
  action_type?: string          // 'STIR_FRY' | 'FLIP' | 'ADD_WATER' 등
  time_limit_seconds?: number   // 제한 시간 (초)
  is_order_critical?: boolean   // 순서 중요 여부
  instruction?: string          // 지시사항
  ingredients?: RecipeIngredient[]  // 필요한 재료들
}

export interface RecipeIngredient {
  id: string
  recipe_step_id: string
  required_sku: string          // 필요한 SKU (e.g., "SEASONING:식용유:10ML")
  required_amount: number       // 필요량
  required_unit: string         // 단위
  is_exact_match_required: boolean  // 정확한 양 요구 여부
}
```

### 2.2 온도 시스템 상수

```typescript
export const WOK_TEMP = {
  // 기본 온도
  AMBIENT: 25,                  // 실온
  MIN_STIR_FRY: 180,           // 볶기 최소 온도
  SMOKING_POINT: 300,          // 스모킹 포인트
  OVERHEATING: 360,            // 과열 온도
  BURNED: 400,                 // 타버림 온도
  MAX_SAFE: 420,               // 절대 최대 온도
  
  // 온도 변화율
  BASE_HEAT_RATE: 25.2,        // 기본 온도 상승률 (°C/s)
  COOL_RATE: 5,                // 온도 하강률 (°C/s, 불 끄면)
  
  // 물 관련
  WATER_BOIL: 100,             // 끓는점
  WATER_HEAT_RATE: 2.5,        // 물 가열 속도 (100도까지 30초)
  WATER_BOIL_DURATION: 5000,   // 끓기 위한 유지 시간 (5초)
  
  // 불 세기별 가열 배율
  HEAT_MULTIPLIER: {
    1: 0.78,                    // 약불 (0.6 * 1.3)
    2: 1.56,                    // 중불 (1.2 * 1.3)
    3: 1.82,                    // 강불 (1.4 * 1.3)
  },
  
  // 재료 투입 시 온도 하락
  COOLING: {
    VEGETABLE: 40,              // 채소류
    SEAFOOD: 45,                // 해산물
    EGG: 20,                    // 계란
    RICE: 15,                   // 밥
    SEASONING: 5,               // 조미료
    WATER: 60,                  // 물
    BROTH: 50,                  // 육수
  },
  
  // 액션별 온도 변화
  ACTION_TEMP: {
    STIR_FRY: 10,               // 볶기 (-10°C)
    FLIP: 8,                    // 뒤집기 (-8°C)
    ADD_WATER: 60,              // 물 넣기 (-60°C)
  },
}
```

### 2.3 메뉴 타이머 시스템

```typescript
export const MENU_TIMER = {
  TARGET_TIME: 7 * 60 * 1000,      // 7분 (목표 - 최고 점수)
  WARNING_TIME: 10 * 60 * 1000,    // 10분 (감점 시작)
  CRITICAL_TIME: 15 * 60 * 1000,   // 15분 (큰 감점)
  CANCEL_TIME: 15 * 60 * 1000,     // 15분 초과 시 자동 취소
}

// 시간대별 점수
export function calculateTimeScore(elapsedMs: number): {
  score: number    // 0~100 또는 -50 (취소)
  tier: 'perfect' | 'good' | 'warning' | 'critical' | 'cancelled'
  message: string
}
```

### 2.4 난이도별 설정

```typescript
export type GameLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

// 메뉴 생성 주기
export const MENU_INTERVAL_MS: Record<GameLevel, number> = {
  BEGINNER: 30000,      // 30초마다
  INTERMEDIATE: 20000,  // 20초마다
  ADVANCED: 15000,      // 15초마다
}

// 한 번에 생성되는 메뉴 개수
export const MENUS_PER_INTERVAL: Record<GameLevel, number> = {
  BEGINNER: 1,          // 1개
  INTERMEDIATE: 2,      // 2개
  ADVANCED: 3,          // 3개
}
```

---

## 3. 상태 관리 (Zustand Store)

### 3.1 GameStore 구조

```typescript
interface GameStore {
  // 세션 정보
  currentStore: Store | null
  currentUser: User | null
  currentSession: GameSession | null
  level: GameLevel
  
  // 게임 상태
  isPlaying: boolean
  elapsedSeconds: number
  completedMenus: number
  targetMenus: number
  
  // 게임 객체
  woks: Wok[]                    // 3개의 웍
  menuQueue: MenuOrder[]         // 주문 대기열
  actionLogs: ActionLog[]        // 행동 로그
  burnerUsageHistory: BurnerUsageLog[]  // 화구 사용 히스토리
  usedMenuNames: Set<string>     // 이미 나온 메뉴 (중복 방지)
  
  // 데이터
  recipes: Recipe[]              // 레시피 목록
  ingredients: IngredientInventory[]  // 식자재 재고
  seasonings: Seasoning[]        // 조미료 목록
  
  // 캐시 (성능 최적화)
  storageCache: Record<string, {  // location_code별 캐시
    title: string
    gridRows: number
    gridCols: number
    ingredients: IngredientInventory[]
  }>
  
  // UI 상태
  fridgeViewState: 'CLOSED' | 'ZOOMED' | 'DOOR_OPEN' | 'FLOOR_SELECT' | 'GRID_VIEW'
  selectedFridgePosition: string | null
  selectedFloor: number | null
  lastServeError: { ... } | null  // 서빙 오류 알림 (신입 아닐 때)
  
  // 메서드 (뒤에서 상세 설명)
  // ...
}
```

### 3.2 핵심 메서드

#### 3.2.1 메뉴 관리
```typescript
addMenuToQueue(menuName: string): void
// 새 주문 추가
// - 고유 ID 생성 (order-{timestamp}-{random})
// - enteredAt에 현재 elapsedSeconds 저장
// - status: 'WAITING'로 시작

assignMenuToWok(menuId: string, burnerNumber: number): void
// 주문을 특정 웍에 배정
// - 웍이 CLEAN 상태이고 빈 상태여야 함
// - currentMenu, currentOrderId 설정
// - currentStep = 0으로 초기화
// - totalSteps 저장 (레시피 정확도 계산용)
// - 불 자동 점화 (isOn: true)
```

#### 3.2.2 재료/액션 검증
```typescript
validateAndAdvanceIngredient(
  burnerNumber: number, 
  sku: string, 
  amount: number, 
  isSeasoning: boolean
): boolean
// 재료 투입 검증 및 스텝 진행
// 
// 로직:
// 1. 현재 스텝의 required ingredients 확인
// 2. 이미 투입한 재료인지 체크 (addedIngredients)
// 3. SKU와 양이 레시피와 일치하는지 검증
// 4. 신입 레벨: 틀리면 즉시 return false
//    신입 아님: 틀려도 recipeErrors++ 하고 계속 진행
// 5. 재료 특성에 따라 온도 하락 적용
//    - 채소: -40°C, 해산물: -45°C, 계란: -20°C, 밥: -15°C, 조미료: -5°C
// 6. addedIngredients에 추가
// 7. 현재 스텝의 모든 재료가 투입되었으면 currentStep++

validateAndAdvanceAction(
  burnerNumber: number, 
  actionType: string
): { ok: boolean; burned?: boolean }
// 액션 검증 및 스텝 진행
//
// 로직:
// 1. 현재 스텝이 ACTION 타입인지 확인
// 2. action_type이 일치하는지 확인
// 3. time_limit_seconds 내에 실행했는지 확인
// 4. 신입 레벨:
//    - 틀리거나 타이밍 오버 → return { ok: false, burned: true }
//    - 웍 상태 BURNED로 변경, 메뉴 WAITING으로 되돌림
// 5. 신입 아님:
//    - 틀려도 recipeErrors++ 하고 물리적 효과만 적용
// 6. 액션별 온도 변화 적용
//    - STIR_FRY: -10°C (1초 후 적용)
//    - FLIP: -8°C
//    - ADD_WATER: 온도 25°C로 리셋, hasWater=true
// 7. 정확하면 currentStep++
```

#### 3.2.3 온도 시스템
```typescript
updateWokTemperatures(): void
// 모든 웍의 온도 계산 (1초마다 호출)
//
// 물이 있을 때:
//   - waterTemperature 계산 (WATER_HEAT_RATE = 2.5°C/s)
//   - 100°C 도달 시 waterBoilStartTime 기록
//   - 100°C에서 5초 유지 → isBoiling = true
//
// 물이 없을 때:
//   - 불이 켜져 있으면: 
//     - heatMultiplier 적용 (약/중/강불)
//     - 지수 곡선으로 온도 상승 (초반 빠름, 후반 느림)
//     - heatRate = BASE_HEAT_RATE * heatMultiplier * (tempRatio ^ 2)
//   - 불이 꺼져 있으면:
//     - COOL_RATE = 5°C/s로 하강
//
// 온도 기반 상태 전환:
//   - temperature >= 180°C && state === 'WET' → 'CLEAN'
//   - temperature >= 400°C → 'BURNED' (메뉴 실패)
//   - temperature >= 360°C → 'OVERHEATING'
//   - temperature < 360°C && state === 'OVERHEATING' → 'CLEAN'

setHeatLevel(burnerNumber: number, level: number): void
// 불 세기 조절 (1: 약불, 2: 중불, 3: 강불)
```

#### 3.2.4 서빙 시스템
```typescript
serve(burnerNumber: number): boolean
// 메뉴 서빙 (완료 처리)
//
// 검증:
// 1. currentStep >= totalSteps 확인 (모든 스텝 완료)
// 2. 완료되지 않았으면 return false
//
// 점수 계산:
// 1. 시간 점수: calculateTimeScore(cookingTime)
//    - ~7분: 100점, ~10분: 85점, ~15분: 70점, 15분~: 30점
// 2. 레시피 점수: recipeErrors > 0 ? 30 : 100
// 3. 최종 점수: (시간 점수 + 레시피 점수) / 2
//
// 처리:
// - menuQueue에서 status: 'COMPLETED', servedAt: Date 설정
// - 웍 state: 'DIRTY'로 변경, currentMenu: null
// - completedMenus++
// - 신입 아니고 오류 있으면 lastServeError 3초간 표시
// - 3초 후 menuQueue에서 제거
//
// return: completedMenus >= targetMenus (게임 종료 여부)
```

#### 3.2.5 메뉴 타이머
```typescript
checkMenuTimers(): void
// 메뉴 타이머 체크 (1초마다 호출)
//
// 로직:
// 1. menuQueue 순회
// 2. elapsedTime = (현재 시간 - enteredAt) 계산
// 3. elapsedTime > 15분이면:
//    - 조리 중이던 웍 찾아서 state: 'DIRTY', currentMenu: null
//    - menuQueue에서 제거
//    - actionLog에 'MENU_CANCELLED' 기록
```

---

## 4. 핵심 게임 로직

### 4.1 게임 진행 흐름

```
[게임 시작]
  ↓
[레벨 선택] → BEGINNER/INTERMEDIATE/ADVANCED
  ↓
[게임 세션 생성] → Supabase game_sessions INSERT
  ↓
[타이머 시작] → elapsedSeconds++ (1초마다)
  ↓
[주문 생성] → 난이도별 주기로 MenuOrder 추가
  ↓
[주문 배정] → 웍에 메뉴 할당
  ↓
[조리 과정]
  │
  ├─ [재료 투입] → validateAndAdvanceIngredient
  ├─ [액션 실행] → validateAndAdvanceAction
  ├─ [온도 관리] → updateWokTemperatures (1초마다)
  └─ [메뉴 타이머] → checkMenuTimers (1초마다)
  ↓
[서빙] → serve()
  ↓
[점수 계산] → 시간 점수 + 레시피 점수
  ↓
[게임 종료 조건]
  ├─ completedMenus >= targetMenus (성공)
  └─ 사용자가 직접 종료
  ↓
[결과 화면] → 점수 기록, Supabase game_scores INSERT
```

### 4.2 레시피 검증 로직

#### 4.2.1 신입 (BEGINNER) 모드
```
재료/액션 틀리면 → 즉시 차단
타이밍 오버 → 웍 타버림 (BURNED)
```

#### 4.2.2 신입 아님 (INTERMEDIATE/ADVANCED) 모드
```
재료/액션 틀려도 → 물리적 효과 적용 + recipeErrors++
서빙 시 → 정확도 표시, 점수 감점
```

### 4.3 온도 물리 시뮬레이션

#### 4.3.1 온도 상승 곡선 (지수 함수)
```typescript
// 초반은 빠르게, 후반은 느리게
tempDiff = MAX_SAFE - currentTemp
tempRatio = tempDiff / (MAX_SAFE - AMBIENT)
heatRate = BASE_HEAT_RATE * heatMultiplier * (tempRatio ^ 2)
```

**예시 (강불 기준, heatMultiplier=1.82):**
- 25°C → 100°C: 약 10초
- 100°C → 200°C: 약 15초
- 200°C → 300°C: 약 25초
- 300°C → 400°C: 약 40초

#### 4.3.2 온도 하락
```typescript
// 불 끄면
temperature -= COOL_RATE (5°C/s)

// 재료 투입
temperature -= COOLING[카테고리]
// 채소: -40°C, 해산물: -45°C, 계란: -20°C, 밥: -15°C

// 액션 실행
temperature -= ACTION_TEMP[actionType]
// 볶기: -10°C (1초 후), 뒤집기: -8°C

// 물 넣기
temperature = 25°C (리셋)
hasWater = true
```

### 4.4 물 시스템

```
[물 넣기] → hasWater=true, waterTemperature=25°C
  ↓
[가열] → waterTemperature += 2.5°C/s
  ↓
[100°C 도달] → waterBoilStartTime 기록
  ↓
[100°C에서 5초 유지] → isBoiling=true
  ↓
[끓는 애니메이션 표시] → 💦 (보글보글)
```

### 4.5 웍 상태 전환

```
CLEAN (깨끗함)
  ├─ 조리 → (조리 중)
  ├─ 설거지 후 말림 → WET
  └─ 180°C 도달 (WET 상태) → CLEAN
  
WET (젖음)
  └─ 180°C 도달 → CLEAN (자동)
  
DIRTY (더러움)
  └─ 설거지 → WET → (말림) → CLEAN
  
OVERHEATING (과열)
  ├─ 360°C 도달 → OVERHEATING
  └─ 360°C 미만으로 하강 → CLEAN
  
BURNED (타버림)
  ├─ 400°C 도달 → BURNED
  └─ 설거지 → WET → CLEAN
```

---

## 5. 컴포넌트 구조

### 5.1 페이지 컴포넌트

```
src/pages/
├── GamePlay.tsx          # 메인 게임 화면
├── LevelSelect.tsx       # 난이도 선택
└── Result.tsx            # 게임 종료 후 결과 화면
```

### 5.2 게임 컴포넌트 계층

```
GamePlay.tsx
├── GameHeader              # 헤더 (타이머, 진행도)
├── MenuQueue               # 주문 대기열
│   └── MenuCard            # 개별 주문 카드 (타이머 표시)
├── SinkArea                # 싱크대 (웍 씻기)
├── Burner (x3)             # 화구 (웍 + 버너)
│   ├── RadialMenu          # 래디얼 메뉴 (볶기, 뒤집기, 물넣기, 불 세기)
│   ├── TemperatureGauge    # 온도 게이지
│   ├── FireAnimation       # 불 애니메이션 (🔥)
│   ├── SmokeAnimation      # 연기 애니메이션 (💨)
│   └── WaterBoilAnimation  # 물 끓는 애니메이션 (💦)
├── DrawerFridge            # 서랍 냉장고 (2x2)
│   └── GridPopup           # 그리드 팝업 (재료 선택)
├── FridgeZoomView          # 4호박스 확대 뷰
│   ├── 2x2 칸 선택
│   ├── 층 선택 (1층/2층)
│   └── GridPopup           # 재료 선택
├── SeasoningCounter        # 조미료대 (4x2)
├── AmountInputPopup        # 양 입력 팝업 (단일 재료)
├── BatchAmountInputPopup   # 배치 양 입력 팝업 (다중 재료)
├── RecipeGuide             # 레시피 가이드 (현재 스텝 표시)
└── ActionLogPanel          # 액션 로그 패널
```

### 5.3 주요 컴포넌트 설명

#### 5.3.1 Burner.tsx
**역할**: 개별 화구와 웍을 표시하고 조리 액션을 처리

**주요 기능**:
- 웍 클릭 시 Radial Menu 표시/숨김
- 온도 게이지 실시간 업데이트
- 불 세기 조절 (약/중/강)
- 조리 액션 (볶기, 뒤집기, 물넣기)
- 웍 상태별 시각적 피드백 (OVERHEATING, BURNED 등)
- 말리기 버튼 (WET 상태일 때)

**Radial Menu 구조**:
```
        [볶기 🍳]
           ↑
[물넣기 💧] ← 웍 → [뒤집기 🔄]
           ↓
  [약불 중불 강불 🔥]
```

**주요 상태**:
```typescript
const [showRadialMenu, setShowRadialMenu] = useState(false)
const containerRef = useRef<HTMLDivElement>(null)
```

**주요 로직**:
- ESC 키로 메뉴 닫기
- 외부 클릭 시 메뉴 닫기
- 액션 실행 후 자동 닫기
- z-index 동적 조절 (열린 웍만 최상위)

#### 5.3.2 GridPopup.tsx
**역할**: 그리드 형태의 재료 선택 UI (냉장고/서랍)

**주요 기능**:
- 3x2 또는 2x2 그리드 레이아웃
- 단일 선택 모드 / 다중 선택 모드
- ESC 키로 닫기
- 선택된 재료 하이라이트

**Props**:
```typescript
interface GridPopupProps {
  title: string
  gridRows: number
  gridCols: number
  ingredients: Array<{
    id: string
    name: string
    amount: number
    unit: string
    gridPositions: string  // "1" 또는 "1,2" (여러 칸 차지)
    gridSize: string       // "1x1" 또는 "2x1" (크기)
    sku: string
    raw: any
  }>
  onSelect?: (ingredient: any) => void        // 단일 선택
  onSelectMultiple?: (ingredients: any[]) => void  // 다중 선택
  onClose: () => void
  multiSelect?: boolean   // 다중 선택 모드 여부
}
```

#### 5.3.3 AmountInputPopup.tsx
**역할**: 단일 재료의 양을 각 웍별로 입력

**주요 기능**:
- 웍별로 개별 양 입력
- 현재 레시피 요구량 표시
- Enter 키로 확인
- ESC 키로 취소
- Tab 키로 input 간 이동
- 첫 input 자동 focus

**UI 구조**:
```
[재료 이름] (요구량: 100g)
  
  화구1: [___] g  ✅ (레시피 일치)
  화구2: [___] g
  화구3: [___] g  ⚠️ (레시피 불일치)
  
  [확인] [취소]
```

#### 5.3.4 BatchAmountInputPopup.tsx
**역할**: 여러 재료를 한 번에 각 웍에 배정

**주요 기능**:
- 재료별 x 웍별 매트릭스 UI
- 각 셀마다 양 입력
- 레시피 일치 여부 실시간 표시
- 한 번에 여러 재료 투입

**UI 구조**:
```
         화구1   화구2   화구3
양파     [___]g  [___]g  [___]g
당근     [___]g  [___]g  [___]g
애호박   [___]g  [___]g  [___]g

[확인] [취소]
```

#### 5.3.5 MenuQueue.tsx
**역할**: 주문 대기열 표시 및 웍 배정

**주요 기능**:
- 주문 카드 표시 (메뉴명, 타이머)
- 타이머 색상 변화 (7분/10분/15분 기준)
- 웍 배정 버튼
- 실시간 경과 시간 표시

**타이머 색상**:
```typescript
~7분:  text-green-600 (완벽)
~10분: text-yellow-600 (양호)
~15분: text-orange-600 (경고)
15분~: text-red-600 animate-pulse (치명적)
```

---

## 6. 데이터 흐름

### 6.1 게임 시작 흐름

```
사용자 → [레벨 선택] → LevelSelect.tsx
         ↓
         setLevel(level)
         ↓
         preloadStorageData(storeId)  // 식자재 데이터 미리 로드
         ↓
         startGame()
         ↓
         Supabase INSERT → game_sessions
         ↓
         isPlaying = true
         ↓
         GamePlay.tsx 렌더링
         ↓
         useEffect 트리거:
           ├─ 타이머 시작 (tickTimer 1초마다)
           ├─ 주문 생성 (난이도별 주기)
           ├─ 화구 사용 기록 (1초마다)
           └─ 온도 업데이트 (1초마다)
```

### 6.2 주문 → 서빙 흐름

```
[주문 생성]
  selectRandomMenu() → addMenuToQueue(menuName)
  ↓
  MenuOrder 생성 { id, menuName, enteredAt, status: 'WAITING' }
  ↓
[사용자가 웍 선택] → MenuQueue에서 웍 번호 클릭
  ↓
  assignMenuToWok(orderId, burnerNumber)
  ↓
  Wok 업데이트 {
    currentMenu: menuName,
    currentOrderId: orderId,
    currentStep: 0,
    isOn: true,
    totalSteps: recipe.steps.length
  }
  ↓
[재료 투입]
  사용자 → [냉장고/서랍/조미료대] 클릭
  ↓
  GridPopup / SeasoningCounter
  ↓
  재료 선택 → AmountInputPopup / BatchAmountInputPopup
  ↓
  양 입력 → 확인
  ↓
  validateAndAdvanceIngredient(burnerNumber, sku, amount)
  ↓
  레시피 검증 ← getCurrentStepIngredients()
  ↓
  정확하면: addedIngredients에 추가
  ↓
  모든 재료 투입 완료: currentStep++, addedIngredients 초기화
  ↓
[액션 실행]
  사용자 → Burner의 Radial Menu 클릭
  ↓
  볶기/뒤집기/물넣기 선택
  ↓
  validateAndAdvanceAction(burnerNumber, actionType)
  ↓
  레시피 검증 ← recipe.steps[currentStep]
  ↓
  정확하면: currentStep++
  ↓
[서빙]
  currentStep >= totalSteps
  ↓
  사용자 → [서빙] 버튼 클릭
  ↓
  serve(burnerNumber)
  ↓
  점수 계산:
    ├─ 시간 점수: calculateTimeScore(cookingTime)
    └─ 레시피 점수: recipeErrors > 0 ? 30 : 100
  ↓
  MenuOrder 업데이트 { status: 'COMPLETED', servedAt: Date }
  ↓
  completedMenus++
  ↓
  completedMenus >= targetMenus → endGame()
```

### 6.3 온도 시스템 흐름

```
[1초마다]
  updateWokTemperatures()
  ↓
  woks.forEach(wok => {
    if (wok.hasWater) {
      // 물 온도 계산
      waterTemperature += WATER_HEAT_RATE
      if (waterTemperature >= 100 && !waterBoilStartTime) {
        waterBoilStartTime = now
      }
      if (waterBoilStartTime && now - waterBoilStartTime > 5000) {
        isBoiling = true
      }
    } else {
      // 일반 온도 계산
      if (wok.isOn) {
        heatRate = BASE_HEAT_RATE * HEAT_MULTIPLIER[heatLevel] * (tempRatio ^ 2)
        temperature += heatRate
      } else {
        temperature -= COOL_RATE
      }
    }
    
    // 상태 전환
    if (temperature >= 180 && state === 'WET') {
      state = 'CLEAN'
    }
    if (temperature >= 400) {
      state = 'BURNED'
      // 메뉴 실패 처리
    }
    if (temperature >= 360 && temperature < 400) {
      state = 'OVERHEATING'
    }
  })
```

---

## 7. Supabase 데이터베이스

### 7.1 테이블 구조

#### stores
```sql
- id: uuid (PK)
- store_name: text
- store_code: text
```

#### users
```sql
- id: uuid (PK)
- store_id: uuid (FK)
- username: text
- avatar_name: text
```

#### kitchen_layouts
```sql
- id: uuid (PK)
- store_id: uuid (FK)
- burner_count: integer
- has_sink: boolean
- has_seasoning_counter: boolean
```

#### ingredients_master
```sql
- id: uuid (PK)
- ingredient_name: text
- ingredient_name_en: text
- category: text
- base_unit: text
```

#### ingredients_inventory
```sql
- id: uuid (PK)
- store_id: uuid (FK)
- ingredient_master_id: uuid (FK)
- storage_location_id: uuid (FK)
- sku_full: text
- standard_amount: numeric
- standard_unit: text
- grid_positions: text       // "1" 또는 "1,2"
- grid_size: text            // "1x1" 또는 "2x1"
```

#### storage_locations
```sql
- id: uuid (PK)
- store_id: uuid (FK)
- location_code: text        // "FRIDGE_LT_F1", "DRAWER_RT" 등
- location_name: text
- location_type: text        // "FRIDGE", "DRAWER"
- grid_rows: integer
- grid_cols: integer
```

#### seasonings
```sql
- id: uuid (PK)
- store_id: uuid (FK)
- seasoning_name: text
- position_code: text
- base_unit: text
```

#### recipes
```sql
- id: uuid (PK)
- store_id: uuid (FK)
- menu_name: text
- category: text
- difficulty_level: text
- estimated_cooking_time: integer
```

#### recipe_steps
```sql
- id: uuid (PK)
- recipe_id: uuid (FK)
- step_number: integer
- step_type: text            // "INGREDIENT" | "ACTION"
- action_type: text          // "STIR_FRY", "FLIP", "ADD_WATER"
- time_limit_seconds: integer
```

#### recipe_ingredients
```sql
- id: uuid (PK)
- recipe_step_id: uuid (FK)
- required_sku: text
- required_amount: numeric
- required_unit: text
- is_exact_match_required: boolean
```

#### game_sessions
```sql
- id: uuid (PK)
- user_id: uuid (FK)
- store_id: uuid (FK)
- level: text                // "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
- start_time: timestamp
- end_time: timestamp
- total_menus_target: integer
- completed_menus: integer
- status: text               // "IN_PROGRESS" | "COMPLETED"
```

#### game_scores
```sql
- id: uuid (PK)
- session_id: uuid (FK)
- recipe_accuracy_score: integer
- speed_score: integer
- burner_usage_score: integer
- total_score: integer
- total_elapsed_time_seconds: integer
```

#### game_action_logs
```sql
- id: uuid (PK)
- session_id: uuid (FK)
- timestamp: timestamp
- elapsed_time_seconds: integer
- action_type: text
- menu_name: text
- burner_number: integer
- ingredient_sku: text
- amount_input: numeric
- expected_sku: text
- expected_amount: numeric
- is_correct: boolean
- action_detail: text
```

### 7.2 데이터 로딩 전략

#### 7.2.1 게임 시작 시 (preloadStorageData)
```typescript
// 모든 냉장고/서랍 위치의 식자재 데이터를 병렬로 미리 로드
const locationCodes = [
  'FRIDGE_LT_F1', 'FRIDGE_LT_F2',
  'FRIDGE_RT_F1', 'FRIDGE_RT_F2',
  'FRIDGE_LB_F1', 'FRIDGE_LB_F2',
  'FRIDGE_RB_F1', 'FRIDGE_RB_F2',
  'DRAWER_LT', 'DRAWER_RT', 'DRAWER_LB', 'DRAWER_RB',
]

// 각 위치별로:
// 1. storage_locations 조회 (.maybeSingle() 사용)
// 2. ingredients_inventory 조회 (grid_positions not null)
// 3. storageCache에 저장
```

이 방식으로 팝업 열 때 즉시 데이터 표시 가능 (성능 최적화)

---

## 8. 중요 알고리즘

### 8.1 온도 상승 곡선 (Exponential Heating)

```typescript
// 목표: 초반은 빠르게, 후반은 점점 느리게
// 공식: heatRate = BASE * multiplier * (ratio ^ exponent)

const tempDiff = WOK_TEMP.MAX_SAFE - wok.temperature  // 남은 온도 차
const tempRatio = tempDiff / (WOK_TEMP.MAX_SAFE - WOK_TEMP.AMBIENT)  // 0~1
const heatMultiplier = WOK_TEMP.HEAT_MULTIPLIER[wok.heatLevel]
const heatRate = WOK_TEMP.BASE_HEAT_RATE * heatMultiplier * Math.pow(tempRatio, 2)

// 예시 (강불, heatMultiplier = 1.82):
// 25°C일 때: tempRatio ≈ 1.0 → heatRate = 25.2 * 1.82 * 1.0 = 45.86°C/s
// 200°C일 때: tempRatio ≈ 0.56 → heatRate = 25.2 * 1.82 * 0.31 = 14.2°C/s
// 350°C일 때: tempRatio ≈ 0.18 → heatRate = 25.2 * 1.82 * 0.03 = 1.4°C/s
```

### 8.2 배치 재료 검증

```typescript
// 여러 재료를 각 웍에 동시에 투입
// 예: 양파 50g (화구1), 당근 30g (화구2), 애호박 40g (화구1)

assignments.forEach(({ sku, burnerNumber, amount }) => {
  const wok = woks.find(w => w.burnerNumber === burnerNumber)
  if (!wok?.currentMenu) return
  
  // 각 웍별로 개별 검증
  const ok = validateAndAdvanceIngredient(burnerNumber, sku, amount, false)
  results.push({ burner: burnerNumber, sku, ok })
})

// 결과 집계
const successCount = results.filter(r => r.ok).length
const failCount = results.filter(r => !r.ok).length
```

### 8.3 메뉴 랜덤 선택 (중복 방지)

```typescript
export function selectRandomMenu(
  recipes: Recipe[],
  usedMenus: Set<string>
): Recipe | null {
  // 1. 아직 나오지 않은 메뉴 필터링
  const unused = recipes.filter(r => !usedMenus.has(r.menu_name))
  
  // 2. 미사용 메뉴가 있으면 그 중에서, 없으면 전체에서 선택
  const pool = unused.length > 0 ? unused : recipes
  
  // 3. 랜덤 선택
  return pool[Math.floor(Math.random() * pool.length)]
}
```

---

## 9. 성능 최적화

### 9.1 데이터 프리로딩
- 게임 시작 시 모든 식자재 데이터를 `storageCache`에 저장
- 팝업 열 때 API 호출 없이 즉시 표시

### 9.2 Zustand 선택적 구독
```typescript
// 나쁜 예 (전체 구독)
const store = useGameStore()

// 좋은 예 (필요한 것만 구독)
const woks = useGameStore(s => s.woks)
const isPlaying = useGameStore(s => s.isPlaying)
```

### 9.3 React.memo 사용
```typescript
// 자주 변경되지 않는 컴포넌트는 memo로 감싸기
export default React.memo(Burner)
```

---

## 10. 주요 버그 및 해결

### 10.1 TypeScript 리터럴 타입 오류
**문제**: `as const`로 인해 `COOLING.VEGETABLE = 40`이 타입 `5`로 추론
**해결**: `as Record<string, number>`로 명시적 타입 지정

### 10.2 z-index 스택 문제
**문제**: `fixed` 오버레이가 `absolute` 버튼을 가림
**해결**: 부모 컨테이너의 z-index를 동적으로 조절 (`showRadialMenu ? 'z-[102]' : 'z-10'`)

### 10.3 스텝 진행 버그
**문제**: 재료 1개만 넣어도 다음 스텝으로 진행
**해결**: `addedIngredients` 배열 도입, 모든 재료 확인 후 진행

### 10.4 볶기 횟수 카운트 오류
**문제**: 첫 번째 볶기가 전체 게임에서만 인식됨
**해결**: `recipe_step.action_type === 'STIR_FRY'` 체크로 스텝별 볶기 인식

---

## 11. 추가 개발 시 고려사항

### 11.1 새로운 조리 액션 추가
1. `database.types.ts`에 액션 타입 정의
2. `WOK_TEMP.ACTION_TEMP`에 온도 변화 추가
3. `Burner.tsx`의 Radial Menu에 버튼 추가
4. `validateAndAdvanceAction`에 로직 추가
5. DB `recipe_steps.action_type` enum 업데이트

### 11.2 새로운 재료 카테고리 추가
1. `WOK_TEMP.COOLING`에 온도 하락량 정의
2. `validateAndAdvanceIngredient`에 SKU 패턴 추가
3. DB `ingredients_inventory` 추가

### 11.3 새로운 웍 상태 추가
1. `WokState` 타입에 추가
2. `updateWokTemperatures`에 전환 로직 추가
3. `Burner.tsx`에 시각적 피드백 추가

---

**문서 버전**: 1.0  
**마지막 업데이트**: 2026-02-01  
**작성자**: AI Assistant
