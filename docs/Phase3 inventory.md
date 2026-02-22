# Phase 3: 식자재 배치 — Claude Code 작업 지시

## 목표

기존 /admin/kitchen (주방 레이아웃 에디터)에서 저장 가능한 장비를 클릭하면 내부가 열리고, [+] 버튼으로 식자재를 배치하는 기능 추가. 별도 페이지 없음.

---

## 작업 전 분석 (plan mode)

아래 파일들을 먼저 읽고 현재 구조를 파악해라:

1. `src/pages/admin/KitchenLayoutEditor.tsx` — 현재 주방 에디터 (여기에 기능 추가)
2. `src/api/kitchenEditorApi.ts` — 기존 API 함수 (재사용 가능한 것 확인)
3. `01_SCHEMA_CREATE.sql` — storage_locations, ingredients_inventory, ingredients_master 스키마
4. `02_SAMPLE_DATA.sql` — 기존 저장 위치 + 재고 데이터 구조 참고
5. `src/stores/gameStore.ts` — preloadStorageData() (시뮬레이터 호환성 확인)
6. `src/types/database.types.ts` — 현재 타입 정의

파악 후 구현 계획 보고. 코드 수정은 승인 후.

---

## 핵심 개념: 장비 → 저장 공간 → 재고

```
kitchen_equipment (Phase 2에서 배치 완료)
  │ storage_location_ids = ['DRAWER_LT', 'DRAWER_RT', ...]
  │
  └── storage_locations (Phase 3에서 자동/수동 생성)
        │ location_code = 'DRAWER_LT'
        │ grid_rows = 4, grid_cols = 2
        │
        └── ingredients_inventory (Phase 3에서 [+]로 추가)
              ingredient_master_id → ingredients_master
              grid_positions = '1,2,3,4'
              grid_size = '2x2'
```

---

## 저장 가능한 장비와 storage_location 매핑

| equipment_type | location_type | 자동 생성할 location 구조 |
|---------------|---------------|------------------------|
| DRAWER_FRIDGE | DRAWER | 4칸: DRAWER_LT, DRAWER_RT, DRAWER_LB, DRAWER_RB (각 grid 4×2) |
| FRIDGE_4BOX | FRIDGE + FRIDGE_FLOOR | 4구역(LT,RT,LB,RB) × 2층. 부모 FRIDGE + 자식 FRIDGE_FLOOR 8개 |
| SEASONING_COUNTER | SEASONING | 1개: SEASONING_COUNTER (grid 4×2) |
| FREEZER | FREEZER | 1개: FREEZER_MAIN (grid 4×2) |
| PREP_TABLE | DECO_ZONE | 1개: DECO_ZONE_MAIN (grid 2×4) |

⚠️ FRIDGE_FLOOR의 location_code는 반드시 `{부모코드}_F{층번호}` 형식.
예: FRIDGE_LT → FRIDGE_LT_F1, FRIDGE_LT_F2

---

## 구현 요구사항

### 1. 장비 클릭 → 내부 열기 (모달 또는 확장 패널)

KitchenLayoutEditor.tsx에서 그리드에 배치된 장비를 클릭할 때:
- 현재: 하단 설정 패널 (이름, 좌표, 삭제)
- 변경: 저장 가능한 장비면 **"내부 열기" 버튼 추가**. 클릭 시 내부 뷰 모달.
- 저장 불가능 장비 (BURNER, SINK, MICROWAVE, FRYER): 기존 설정 패널만.

### 2. 내부 뷰 모달

장비를 열면:

**첫 오픈 시 (storage_location 없을 때):**
- 장비 타입에 따라 storage_locations 자동 생성
- 장비의 storage_location_ids도 자동 업데이트
- "저장 공간을 초기화합니다" 안내 후 진행

**이미 있을 때:**
- 해당 장비의 storage_location_ids로 storage_locations 조회
- 각 location의 ingredients_inventory 조회
- 그리드에 재고 표시

**UI 구조 (장비 타입별):**

서랍냉장고:
```
┌─────────────────────────────────┐
│ 서랍냉장고 - 식자재 배치         │
├────────────┬────────────────────┤
│ DRAWER_LT  │ DRAWER_RT          │
│ ┌──┬──┐    │ ┌──┬──┐           │
│ │양파│양파│ │ │밥│밥│            │
│ │양파│양파│ │ │밥│밥│            │
│ ├──┼──┤    │ ├──┼──┤           │
│ │  │  │    │ │  │  │           │
│ │ [+] │    │ │ [+] │           │
│ └──┴──┘    │ └──┴──┘           │
├────────────┼────────────────────┤
│ DRAWER_LB  │ DRAWER_RB          │
│ (동일 구조) │ (동일 구조)         │
└────────────┴────────────────────┘
```

4호박스:
```
┌─────────────────────────────────┐
│ 4호박스 - 구역 선택              │
│                                  │
│  [LT] [RT]    ← 4구역 탭        │
│  [LB] [RB]                      │
│                                  │
│ 선택: LT                         │
│  [1층] [2층]  ← 층 탭           │
│                                  │
│  1층 그리드 (3×2):              │
│  ┌──┬──┐                        │
│  │육회│육회│                     │
│  ├──┼──┤                        │
│  │소스│소스│                     │
│  ├──┼──┤                        │
│  │ [+] │                        │
│  └──┴──┘                        │
└─────────────────────────────────┘
```

조미료대 / 냉동고 / 데코존: 단일 그리드 + [+] 버튼

### 3. [+] 버튼 → 식자재 추가 모달

클릭 시:
1. **재료 선택**: ingredients_master에서 검색 (한글 이름으로 필터링)
   - 목록에 없으면 "새 재료 등록" 버튼 → 서브모달 (이름, 영문명, 카테고리, 단위)
2. **크기 선택**: grid_size (1x1, 1x2, 2x1, 2x2 등)
4. **위치 선택**: 현재 그리드에서 빈 셀 클릭 → grid_positions 자동 계산
   - 이미 재료가 있는 셀은 비활성
   - 선택한 크기가 들어갈 수 없으면 경고
5. **sku_code**: 자동 생성 (예: ONION_50G) 또는 수동 입력

### 4. 기존 재고 클릭 → 수정/삭제

그리드에서 배치된 재료 클릭 시:
- 수량, 크기, 위치 수정 가능
- 삭제 버튼

### 5. API 레이어 (src/api/inventoryApi.ts — 새 파일)

```typescript
// 저장 공간
fetchStorageLocations(storeId: string): Promise<StorageLocation[]>
createStorageLocation(data): Promise<StorageLocation>
createFridgeWithFloors(storeId, fridgeCode, fridgeName): Promise<StorageLocation[]>
  // → FRIDGE 부모 + FRIDGE_FLOOR 자식들 한번에 생성
deleteStorageLocation(id): Promise<void>
  // → CASCADE: 하위 FRIDGE_FLOOR + 재고도 삭제

// 재료 마스터
fetchAllIngredientsMaster(): Promise<IngredientMaster[]>
createIngredientMaster(data): Promise<IngredientMaster>

// 재고
fetchInventoryByLocation(locationId: string): Promise<IngredientInventory[]>
createInventoryItem(data): Promise<IngredientInventory>
updateInventoryItem(id, updates): Promise<IngredientInventory>
deleteInventoryItem(id): Promise<void>

// 장비 연결
updateEquipmentStorageLinks(equipmentId, locationCodes: string[]): Promise<void>
```

### 6. 저장 로직

**일괄 저장 방식.** 내부 뷰 모달에 "저장" 버튼.

- [+]로 재료 추가/수정/삭제 → 로컬 state에만 반영 (화면에 즉시 표시)
- "저장" 버튼 클릭 → DB에 일괄 반영 (UPSERT)
  - dbId가 있고 로컬에도 있음 → UPDATE
  - dbId가 없고 로컬에만 있음 → INSERT
  - dbId가 있고 로컬에 없음 → DELETE
- "취소" 버튼 → 변경사항 버리고 모달 닫기
- 저장 안 하고 모달 닫으려 하면 "저장하지 않은 변경사항이 있습니다" 경고

storage_locations는 장비 내부 열 때 자동 생성 (이건 즉시, location이 없으면 장비를 열 수 없으니까).

### 7. 타입 추가/수정 (database.types.ts)

StorageLocation 타입에 누락 필드 보강:
```typescript
export interface StorageLocation {
  id: string
  store_id: string
  location_type: 'DRAWER' | 'FRIDGE' | 'FRIDGE_FLOOR' | 'SEASONING' | 'DECO_ZONE' | 'FREEZER' | 'PREP_TABLE' | 'OTHER'
  location_code: string
  location_name: string
  grid_rows: number
  grid_cols: number
  has_floors: boolean
  floor_count: number
  parent_location_id?: string
  position_order: number
  created_at?: string
}
```

---

## 시뮬레이터 호환성 확인 사항

`preloadStorageData()`가 다음 패턴으로 데이터를 로드:
```
locationCodes = ['FRIDGE_LT_F1', 'FRIDGE_LT_F2', ..., 'DRAWER_LT', 'DRAWER_RT', ...]
각 코드로 → storage_locations 조회 → ingredients_inventory 조회 → storageCache에 저장
```

따라서:
1. location_code 네이밍이 기존 패턴과 일치해야 함
2. FRIDGE_FLOOR 코드는 반드시 `{부모코드}_F{층번호}` 형식
3. grid_positions는 TEXT ("1,2,3,4"), grid_size는 TEXT ("2x2")
4. ingredients_inventory JOIN 시 `ingredient_master:ingredients_master(*)` 패턴 사용

---

## RLS 정책 (사용자가 Supabase SQL Editor에서 실행)

```sql
CREATE POLICY "storage_locations_insert" ON storage_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "storage_locations_update" ON storage_locations FOR UPDATE USING (true);
CREATE POLICY "storage_locations_delete" ON storage_locations FOR DELETE USING (true);
CREATE POLICY "ingredients_master_insert" ON ingredients_master FOR INSERT WITH CHECK (true);
CREATE POLICY "ingredients_master_update" ON ingredients_master FOR UPDATE USING (true);
CREATE POLICY "ingredients_inventory_insert" ON ingredients_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "ingredients_inventory_update" ON ingredients_inventory FOR UPDATE USING (true);
CREATE POLICY "ingredients_inventory_delete" ON ingredients_inventory FOR DELETE USING (true);
```

---

## 주의사항

- **기존 시뮬레이터 코드 수정 금지** (gameStore.ts, preloadStorageData 등)
- **KitchenLayoutEditor.tsx의 기존 기능 유지** (장비 배치, 드래그앤드롭, 저장)
- 내부 열기는 모달로 구현 (기존 에디터 레이아웃 안 깨뜨림)
- grid_positions는 TEXT ("1,2,3,4"), grid_size는 TEXT ("2x2")
- UNIQUE 제약: (store_id, ingredient_master_id, storage_location_id) — 같은 재료를 같은 위치에 두 번 넣을 수 없음
- 한국어 UI, Tailwind + framer-motion 스타일 유지

---

## 검증 체크리스트

- [ ] /admin/kitchen에서 장비 배치 기능이 기존대로 동작 (Phase 2 기능 유지)
- [ ] 저장 가능 장비 클릭 시 "내부 열기" 버튼 표시
- [ ] "내부 열기" → 첫 오픈 시 storage_locations 자동 생성
- [ ] Supabase에서 storage_locations 데이터 확인 (location_code 패턴 정확성)
- [ ] 장비의 storage_location_ids가 자동 업데이트됨
- [ ] 내부 그리드에서 기존 재고가 올바른 위치/크기로 표시
- [ ] [+] 버튼 → 재료 선택 → 수량/크기/위치 → 즉시 DB 저장
- [ ] 새 재료 마스터 등록 가능
- [ ] 기존 재고 클릭 → 수정/삭제 가능
- [ ] 4호박스: 구역 선택 → 층 선택 → 그리드 표시 정상
- [ ] FRIDGE_FLOOR location_code가 {부모}_F{층} 형식인지 Supabase에서 확인
- [ ] 페이지 새로고침 → 저장된 데이터 정상 로드
- [ ] 시뮬레이터 검증: 게임 시작 → 콘솔에서 preloadStorageData() 로그 → 새 데이터가 storageCache에 로드되는지