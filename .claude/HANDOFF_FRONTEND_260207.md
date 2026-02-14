# Kitchen Simulator - 프론트엔드 구현 가이드

## 1. 프로젝트 개요

React + TypeScript + Zustand 기반의 주방 시뮬레이터 게임.
사용자가 주문을 받아 재료를 조리하고, 플레이팅하여 서빙하는 플로우.

## 2. 핵심 컴포넌트 구조

```
src/
├── pages/
│   └── GamePlay.tsx          # 메인 게임 페이지 (전체 조율)
├── components/
│   ├── Game/
│   │   └── RecipeGuide.tsx   # 레시피 정답지 (디버깅용)
│   ├── Kitchen/
│   │   ├── Burner.tsx        # 개별 화구 컴포넌트
│   │   ├── BurnerEquipment.tsx # 화구 장비 래퍼
│   │   ├── DecoZone.tsx      # 플레이팅 영역
│   │   └── PlateSelectPopup.tsx # 접시 선택 팝업
│   └── Menu/
│       └── MenuQueue.tsx     # 주문 대기열
└── stores/
    └── gameStore.ts          # Zustand 중앙 상태 (백엔드 역할)
```

## 3. 메뉴 타입 분류

### 3.1 메뉴 번들 타입
```typescript
type MenuBundleType = 'HOT_ONLY' | 'COLD_ONLY' | 'MIXED' | 'SINGLE'
```

- **HOT_ONLY**: 화구에서만 조리 (예: 볶음밥)
- **COLD_ONLY**: 바로 플레이팅 (예: 샐러드)
- **MIXED**: HOT + COLD 조합 (예: 버터계란밥 = 버터계란볶음 + 밥)
- **SINGLE**: 단일 레시피 (번들 없음)

### 3.2 MIXED 메뉴 처리 핵심
```typescript
// MIXED 메뉴의 HOT 묶음을 화구에 배정할 때 bundleId 전달 필수
onAssignToWok(order.id, burnerNumber, bundle.id)

// 웍에서 bundleId로 스텝 필터링
const filteredSteps = wok.currentBundleId
  ? recipe.steps.filter(s => s.bundle_id === wok.currentBundleId)
  : recipe.steps
```

## 4. 주요 UI 플로우

### 4.1 조리 플로우 (HOT)
```
1. MenuQueue에서 메뉴 선택 → 화구 번호 클릭 (bundleId 전달)
2. assignMenuToWok(orderId, burnerNumber, bundleId)
3. Burner에서 재료 투입 → validateAndAdvanceIngredient()
4. 모든 스텝 완료 → "접시 옮기기" 버튼 클릭
5. PlateSelectPopup → 접시 선택 → DecoZone으로 이동
```

### 4.2 플레이팅 플로우 (COLD/DECO)
```
1. DecoZone에서 상시배치 재료(DEFAULT_ITEM) 또는 세팅 재료(SETTING_ITEM) 선택
2. 접시 그리드 셀 클릭
3. handleGridCellClick() → 규칙 검증 → 수량 팝업 → applyDecoItem()
4. 모든 데코 완료 → 서빙
```

## 5. SKU 형식

### 5.1 일반 재료
```
구형식: FRIDGE_버터_F2_20G
신형식: FRIDGE_RB_F2:버터:20G
```

### 5.2 조미료
```
SEASONING:참치액젓:10ML
```

### 5.3 SKU 파싱 로직 (RecipeGuide.tsx)
```typescript
const getIngredientName = (sku: string): string => {
  // 조미료: 콜론 분리 후 [1]
  if (isSeasoningSKU(sku)) {
    return sku.split(':')[1] ?? sku
  }
  // 인벤토리에서 찾기
  const found = ingredients.find(ing => ing.sku_full === sku)
  if (found?.ingredient_master?.ingredient_name) {
    return found.ingredient_master.ingredient_name
  }
  // 신형식: 콜론 분리
  if (sku.includes(':')) {
    const colonParts = sku.split(':')
    if (colonParts.length >= 2) return colonParts[1]
  }
  // 구형식: 언더스코어 분리
  const parts = sku.split('_')
  return parts[parts.length - 2] ?? sku
}
```

## 6. 컴포넌트별 핵심 로직

### 6.1 MenuQueue.tsx
```typescript
// MIXED 메뉴 번들 버튼
{bundle.cooking_type === 'HOT' && (
  <button onClick={() => onAssignToWok(order.id, n, bundle.id)}>
    화구 {n}
  </button>
)}
```

### 6.2 RecipeGuide.tsx
```typescript
// bundleId 필터링 필수!
const filteredSteps = wok.currentBundleId
  ? (recipe?.steps ?? []).filter(s => s.bundle_id === wok.currentBundleId)
  : recipe?.steps ?? []
const sortedSteps = [...filteredSteps].sort((a, b) => a.step_number - b.step_number)
```

### 6.3 DecoZone.tsx
```typescript
// 데코 규칙 조회 (recipe_id 필수 체크)
const rule = getDecoRuleForIngredient(selectedIngredient.id, plate.recipeId)
if (!rule) {
  playSound('error')
  addDecoMistake()
  return
}

// 위치 검증 (grid_position 또는 grid_positions)
const allowedPositions =
  (rule.grid_positions?.length > 0)
    ? rule.grid_positions
    : (rule.grid_position != null)
      ? [rule.grid_position]
      : null
```

### 6.4 PlateSelectPopup.tsx
```typescript
// HOT 메뉴 완료 시 웍 상태 초기화
if (cookingType === 'HOT' && burnerNumber !== undefined) {
  updateWok(burnerNumber, {
    state: 'DIRTY',
    currentMenu: null,
    currentBundleId: null,  // 이거 중요!
    // ... 나머지 초기화
  })
}
```

## 7. 자주 발생하는 버그 패턴

### 7.1 bundleId 미전달
**증상**: MIXED 메뉴에서 잘못된 스텝 표시
**원인**: bundleId가 UI에서 스토어로 전달되지 않음
**해결**: 모든 경로에서 bundleId 파라미터 확인

### 7.2 recipe_id 없는 규칙 매칭
**증상**: 다른 레시피의 재료가 허용됨
**원인**: fallback 검색에서 recipe_id 체크 누락
**해결**: 반드시 `&& r.recipe_id === plate.recipeId` 조건 추가

### 7.3 grid_position vs grid_positions
**증상**: 위치 검증 실패
**원인**: 단일 값(grid_position)과 배열(grid_positions) 혼용
**해결**: 둘 다 체크하는 로직 사용

## 8. 디버깅 팁

### 8.1 콘솔 로그 패턴
```typescript
console.log('🔥 메뉴 배정:', orderId, '화구:', burnerNumber, bundleId)
console.log('🔍 validateAndAdvanceIngredient 디버그:')
console.log('❌ 데코 규칙 없음:', ingredientId, recipeId)
console.log('🎉 스텝 완료 → 다음 스텝으로 진행')
```

### 8.2 상태 확인
```typescript
// 웍 상태 확인
console.log('wok:', {
  currentStep: wok.currentStep,
  bundleId: wok.currentBundleId,
  addedIngredients: wok.addedIngredients
})
```

## 9. 스타일링 규칙

- Tailwind CSS 사용
- 모바일: `text-xs`, `p-2`
- 데스크탑: `lg:text-sm`, `lg:p-4`
- 색상: HOT=orange/red, COLD=cyan/blue, 성공=green, 오류=red
