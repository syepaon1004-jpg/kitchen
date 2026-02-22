# 어드민 페이지 개발 로드맵

## 목적

어드민 = 시뮬레이터가 읽는 DB에 데이터를 넣는 UI. 시뮬레이터는 이미 store_id 기준으로 데이터를 로드 → 렌더링하는 구조이므로, 어드민에서 올바른 데이터만 넣으면 어떤 매장이든 시뮬레이터가 자동 작동.

## 전체 Phase 순서

```
Phase 1: 매장 생성 + 사용자/아바타 생성           ✅ 완료
Phase 2: 주방 레이아웃 (드래그앤드롭 장비 배치)     ✅ 완료
Phase 3: 식자재 배치 (장비 내부 열기 → 재료 추가)   ← 현재
Phase 4: 레시피 등록
Phase 5: 시뮬레이터 연동 종합 검증
```

---

## Phase 1: 매장 생성 + 사용자/아바타 생성 ✅

- StoreSelect.tsx에 "새 매장 만들기" 인라인 폼 추가
- UserLogin.tsx에 "사용자 추가" 모달 추가
- database.types.ts에 Store(address, phone, is_active), User(role, is_active) 필드 추가
- RLS: stores, users INSERT/UPDATE 정책 추가

---

## Phase 2: 주방 레이아웃 설정 ✅

- /admin/kitchen 경로에 KitchenLayoutEditor.tsx 생성 (@dnd-kit 기반)
- 팔레트에서 9종 장비 드래그앤드롭 배치 (BURNER, SINK, DRAWER_FRIDGE, FRIDGE_4BOX, SEASONING_COUNTER, MICROWAVE, FRYER, FREEZER, PREP_TABLE)
- 겹침 허용, 면적 작은 장비가 z-index 위로
- UPSERT 저장 (기존 UUID 유지)
- 드래그 시 장비 실제 크기만큼 하이라이트
- kitchenEditorApi.ts 재사용
- RLS: kitchen_grids, kitchen_equipment INSERT/UPDATE/DELETE 정책 추가

### 작업대 통합

PLATING_STATION, CUTTING_BOARD, COLD_TABLE, WORKTABLE → 팔레트에서 제외.
PREP_TABLE("작업대/데코존")만 사용. DB CHECK 제약은 유지.

### 컴포넌트 미구현 장비 제외

TORCH, COLD_TABLE, PLATING_STATION, CUTTING_BOARD, WORKTABLE → 팔레트에서 제거.
시뮬레이터 컴포넌트가 있는 9종만 표시.

---

## Phase 3: 식자재 배치 ← 현재

### 변경된 접근

~~별도 /admin/inventory 페이지~~ → 기존 /admin/kitchen (주방 에디터)에서 장비를 클릭하면 내부가 열리는 방식.

실제 주방에서 하는 것과 동일: "냉장고 열고 → 재료 넣기"

### 흐름

```
/admin/kitchen (Phase 2 에디터)
  │
  ├── 장비 배치 모드 (기존 기능 그대로)
  │
  └── 저장 가능한 장비 클릭 → "내부 열기"
        │
        ├── 서랍냉장고 → 4칸 서랍 그리드 → 각 칸에 [+] → 재료 추가
        ├── 4호박스 → 4구역 선택 → 층 선택 → 그리드 → [+] → 재료 추가
        ├── 조미료대 → 그리드 → [+] → 조미료 추가
        ├── 냉동고 → 그리드 → [+] → 재료 추가
        └── 작업대(데코존) → 그리드 → [+] → 데코 재료 추가
```

### 상세 작업 → docs/PHASE3_INVENTORY.md 참조

---

## Phase 4: 레시피 등록

### 작업 내용 (Phase 3 완료 후 상세화)

- 가장 복잡한 Phase. 5개 테이블 연쇄 INSERT
- 레시피 기본 정보 (menu_name, menu_type, category)
- 묶음 추가 (cooking_type, is_main_dish, merge_order)
- 묶음별 스텝 추가 (step_type, action_type, action_params)
- 스텝별 재료 연결 (ingredient_master → inventory 매칭)
- 데코 스텝 추가 (source_type, deco_order, grid_position)
- FK 의존 순서: recipes → recipe_bundles → recipe_steps → recipe_ingredients → deco_steps
- 트랜잭션으로 처리 (부분 실패 방지)

---

## Phase 5: 시뮬레이터 연동 종합 검증

- 새 매장 데이터만으로 전체 게임 플레이 가능 확인
- loadStoreData()가 새 스키마 구조를 정상 로드하는지 확인
- 기존 타입 (KitchenLayout 등)과 실제 DB 구조 불일치 해소
- 필요 시 기존 코드 수정 (Agent Teams 검토 시점)