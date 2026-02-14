# Kitchen Simulator - 백엔드(Store) 구현 가이드

## 1. 상태 관리 구조

Zustand 기반 중앙 상태 관리. `src/stores/gameStore.ts`가 핵심.

## 2. 핵심 인터페이스

### 2.1 Wok (화구)
```typescript
interface Wok {
  burnerNumber: number
  state: 'CLEAN' | 'WET' | 'DIRTY' | 'OVERHEATING'
  currentMenu: string | null
  currentOrderId: string | null
  currentBundleId: string | null  // ⭐ MIXED 메뉴 필터링용
  currentStep: number             // 현재 진행 중인 스텝 인덱스
  totalSteps: number              // 필터링된 총 스텝 수
  addedIngredients: string[]      // 현재 스텝에 투입된 재료 SKU들
  temperature: number
  isOn: boolean
  // ...
}
```

### 2.2 DecoPlate (플레이트)
```typescript
interface DecoPlate {
  id: string
  orderId: string
  menuName: string
  recipeId: string              // ⭐ 데코 규칙 검색에 필수
  bundleId: string | null
  plateType: PlateType
  gridCells: DecoGridCell[]
  appliedDecos: AppliedDeco[]
}
```

### 2.3 DecoRule (데코 규칙)
```typescript
interface DecoRule {
  id: string
  recipe_id: string             // ⭐ 반드시 이 레시피에서만 유효
  deco_default_item_id?: string // 상시배치 재료 ID
  ingredient_master_id?: string // 세팅 재료 ID
  grid_position?: number        // 단일 위치 (1~9)
  grid_positions?: number[]     // 복수 위치 배열
  required_amount: number
  min_amount?: number
  max_amount?: number
}
```

## 3. 핵심 액션 함수

### 3.1 assignMenuToWok (메뉴 배정)
```typescript
assignMenuToWok: (orderId, burnerNumber, bundleId?) => {
  // 1. 주문 찾기
  const order = menuQueue.find(o => o.id === orderId)

  // 2. 레시피 찾기
  const recipe = getRecipeByMenuName(order.menuName)

  // 3. bundleId로 스텝 필터링 (MIXED 메뉴 핵심!)
  const filteredSteps = bundleId
    ? recipe.steps.filter(s => s.bundle_id === bundleId)
    : recipe.steps

  // 4. 웍 상태 업데이트
  set({
    woks: woks.map(w => w.burnerNumber === burnerNumber ? {
      ...w,
      currentMenu: order.menuName,
      currentOrderId: orderId,
      currentBundleId: bundleId ?? null,  // ⭐ 필수!
      currentStep: 0,
      totalSteps: filteredSteps.length,
      addedIngredients: [],
    } : w)
  })
}
```

### 3.2 getCurrentStepIngredients (현재 스텝 재료 조회)
```typescript
getCurrentStepIngredients: (menuName, stepIndex, bundleId?) => {
  const recipe = getRecipeByMenuName(menuName)

  // bundleId 필터링
  const filteredSteps = bundleId
    ? recipe.steps.filter(s => s.bundle_id === bundleId)
    : recipe.steps

  // step_number로 정렬 후 인덱스 접근
  const sortedSteps = [...filteredSteps].sort((a, b) => a.step_number - b.step_number)
  const step = sortedSteps[stepIndex]

  return step.ingredients.map(i => ({
    required_sku: i.required_sku,
    required_amount: i.required_amount,
    required_unit: i.required_unit,
  }))
}
```

### 3.3 validateAndAdvanceIngredient (재료 검증 및 스텝 진행)
```typescript
validateAndAdvanceIngredient: (burnerNumber, sku, amount, isSeasoning) => {
  const wok = woks.find(w => w.burnerNumber === burnerNumber)

  // 1. 현재 스텝 요구사항 조회 (bundleId 전달!)
  const reqs = getCurrentStepIngredients(wok.currentMenu, wok.currentStep, wok.currentBundleId)

  // 2. 매칭 검사
  const match = reqs.find(r => {
    if (isSeasoning) {
      // 조미료: 부분 매칭 (이름 + 수량)
      return r.required_sku.startsWith('SEASONING:')
        && r.required_sku.includes(sku.split(':')[1])
        && r.required_amount === amount
    }
    // 일반 재료: 정확 매칭
    return r.required_sku === sku && r.required_amount === amount
  })

  // 3. 투입 재료 목록에 추가
  const newAddedIngredients = [...wok.addedIngredients, sku]

  // 4. 모든 재료 투입 완료 확인
  const allIngredientsAdded = reqs.every(req =>
    newAddedIngredients.some(added => {
      if (req.required_sku.startsWith('SEASONING:')) {
        return added.includes(req.required_sku.split(':')[1])
      }
      return added === req.required_sku
    })
  )

  // 5. 스텝 진행 또는 재료 추가
  if (allIngredientsAdded) {
    set({
      woks: woks.map(w => w.burnerNumber === burnerNumber ? {
        ...w,
        currentStep: wok.currentStep + 1,
        addedIngredients: [],  // 다음 스텝 시작 시 초기화
      } : w)
    })
  } else {
    set({
      woks: woks.map(w => w.burnerNumber === burnerNumber ? {
        ...w,
        addedIngredients: newAddedIngredients,
      } : w)
    })
  }
}
```

### 3.4 getDecoRuleForIngredient (데코 규칙 조회)
```typescript
getDecoRuleForIngredient: (ingredientId, recipeId) => {
  // ⚠️ 반드시 recipe_id 체크! fallback 없음!

  // 1. deco_default_item_id로 검색 (상시배치)
  const ruleByDefault = decoRules.find(
    r => r.deco_default_item_id === ingredientId && r.recipe_id === recipeId
  )
  if (ruleByDefault) return ruleByDefault

  // 2. ingredient_master_id로 검색 (세팅 재료)
  const ruleByIngredient = decoRules.find(
    r => r.ingredient_master_id === ingredientId && r.recipe_id === recipeId
  )
  if (ruleByIngredient) return ruleByIngredient

  // ❌ fallback 검색 금지! (다른 레시피 재료 허용 방지)
  return null
}
```

### 3.5 applyDecoItem (데코 적용)
```typescript
applyDecoItem: (plateId, gridPosition, ingredientId, amount) => {
  const plate = decoPlates.find(p => p.id === plateId)

  // 1. 데코 규칙 찾기 (recipe_id 필수!)
  let decoRule = decoRules.find(
    r => r.deco_default_item_id === ingredientId && r.recipe_id === plate.recipeId
  )
  if (!decoRule) {
    decoRule = decoRules.find(
      r => r.ingredient_master_id === ingredientId && r.recipe_id === plate.recipeId
    )
  }

  // ❌ 규칙 없으면 거부
  if (!decoRule) {
    return { success: false, message: '이 레시피에서 사용할 수 없는 재료입니다' }
  }

  // 2. 위치 검증 (grid_position 또는 grid_positions)
  const allowedPositions =
    (decoRule.grid_positions?.length > 0)
      ? decoRule.grid_positions
      : (decoRule.grid_position != null)
        ? [decoRule.grid_position]
        : null

  if (allowedPositions && !allowedPositions.includes(gridPosition)) {
    return { success: false, message: '잘못된 위치입니다', isPositionError: true }
  }

  // 3. 수량 검증
  const minAmount = decoRule.min_amount ?? decoRule.required_amount
  const maxAmount = decoRule.max_amount ?? decoRule.required_amount
  if (amount < minAmount || amount > maxAmount) {
    return { success: false, message: '수량 범위 초과' }
  }

  // 4. 적용
  // ... gridCells, appliedDecos 업데이트
}
```

## 4. 데이터베이스 스키마 (Supabase)

### 4.1 recipe_steps
```sql
- id: uuid
- recipe_id: uuid (FK)
- bundle_id: uuid (FK, nullable)  -- MIXED 메뉴용
- step_number: int
- step_type: 'INGREDIENT' | 'ACTION'
- action_type: 'STIR_FRY' | 'FLIP' | 'ADD_WATER' | ...
- ingredients: jsonb  -- [{required_sku, required_amount, required_unit}]
```

### 4.2 recipe_bundles
```sql
- id: uuid
- recipe_id: uuid (FK)
- bundle_name: string ('버터계란볶음', '밥', ...)
- cooking_type: 'HOT' | 'COLD'
- is_main_dish: boolean
```

### 4.3 deco_rules
```sql
- id: uuid
- recipe_id: uuid (FK)  -- ⭐ 반드시 체크!
- deco_default_item_id: uuid (FK, nullable)
- ingredient_master_id: uuid (FK, nullable)
- source_type: 'DEFAULT_ITEM' | 'SETTING_ITEM' | 'BUNDLE'
- grid_position: int (nullable)
- grid_positions: int[] (nullable)
- required_amount: int
- min_amount: int (nullable)
- max_amount: int (nullable)
```

## 5. 핵심 판단 기준

### 5.1 bundleId 필터링 적용 위치
```
✅ assignMenuToWok - bundleId 파라미터 받아서 저장
✅ getCurrentStepIngredients - bundleId로 스텝 필터링
✅ validateAndAdvanceIngredient - wok.currentBundleId 사용
✅ validateAndAdvanceAction - 동일
✅ serve - 완료 체크 시 필터링
✅ RecipeGuide (UI) - 표시 시 필터링
✅ BurnerEquipment (UI) - 진행률 계산 시 필터링
```

### 5.2 recipe_id 체크 필수 위치
```
✅ getDecoRuleForIngredient - 규칙 조회 시
✅ applyDecoItem - 적용 시
✅ handleGridCellClick (UI) - 클릭 시 규칙 조회
```

### 5.3 웍 상태 초기화 위치
```
✅ assignMenuToWok - 메뉴 배정 시
✅ serve - 서빙 완료 시
✅ PlateSelectPopup - HOT 메뉴 접시 이동 시
✅ resetGameState - 게임 리셋 시
```

## 6. 자주 발생하는 버그와 해결

### 6.1 스텝이 진행되지 않음
**원인**: `allIngredientsAdded` 판정 실패
**디버깅**:
```typescript
console.log('reqs:', reqs)
console.log('newAddedIngredients:', newAddedIngredients)
console.log('allIngredientsAdded:', allIngredientsAdded)
```
**해결**: SKU 매칭 로직 확인, 조미료 부분 매칭 확인

### 6.2 다른 레시피 재료가 허용됨
**원인**: fallback 검색에서 recipe_id 누락
**해결**: `&& r.recipe_id === plate.recipeId` 조건 필수

### 6.3 MIXED 메뉴에서 잘못된 스텝 표시
**원인**: bundleId 미전달 또는 필터링 누락
**해결**: 전체 경로에서 bundleId 흐름 추적

## 7. 디버깅 로그 패턴

```typescript
// 상세 디버깅용
console.log('🔍 validateAndAdvanceIngredient 디버그:')
console.log('  - 화구:', burnerNumber, '현재 스텝:', wok.currentStep)
console.log('  - bundleId:', wok.currentBundleId)
console.log('  - 입력 SKU:', sku, '수량:', amount)
console.log('  - 현재 스텝 요구사항:', reqs)
console.log('  - 이미 투입된 재료:', wok.addedIngredients)
console.log('  - 매칭 결과:', isCorrect ? '✅' : '❌')
console.log('  - 모든 재료 투입 완료:', allIngredientsAdded)
```

## 8. 웍 초기화 체크리스트

웍 상태를 초기화할 때 반드시 포함:
```typescript
{
  state: 'DIRTY' | 'CLEAN',
  currentMenu: null,
  currentOrderId: null,
  currentBundleId: null,  // ⭐ 절대 빠뜨리지 말 것!
  currentStep: 0,
  totalSteps: 0,
  stepStartTime: null,
  addedIngredients: [],
  recipeErrors: 0,
  isOn: false,
  burnerOnSince: null,
}
```

## 9. 테스트 시나리오

### 9.1 MIXED 메뉴 테스트 (버터계란밥)
1. 버터계란밥 주문 들어옴
2. HOT 묶음(버터계란볶음) → 화구 1 배정 (bundleId 전달 확인)
3. 레시피 가이드에 버터계란볶음 스텝만 표시되는지 확인
4. 버터 20g 투입 → 스텝 진행 확인
5. 조리 완료 → 접시 선택 → 데코존 이동
6. COLD 묶음(밥) → 플레이트 선택 → 데코존에 추가
7. 데코 완료 → 서빙

### 9.2 데코 규칙 테스트
1. 버터계란밥 데코존에서
2. 참기름 선택 → 그리드 클릭 → 거부되어야 함 (규칙 없음)
3. 깨 선택 → 올바른 위치 클릭 → 적용되어야 함
4. 깨 선택 → 잘못된 위치 클릭 → 거부 + 빨간 플래시
