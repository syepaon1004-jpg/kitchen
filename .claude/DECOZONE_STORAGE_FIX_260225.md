# 데코존 상시배치재료 storage_location 문제점 및 수정 사항

> 작성일: 2025-02-25

---

## 1. 문제 현상

어드민 주방 레이아웃 에디터에서 PREP_TABLE(작업대)의 상시배치 재료를 3×8 그리드에 배치했으나, 게임플레이에서 데코존을 열면 **원형 버튼 나열**로만 표시되어 배치가 전혀 반영되지 않음.

```
[어드민 에디터]                          [게임 데코존]
┌──┬──┬──┬──┬──┬──┬──┬──┐              ○깻잎 ○고추 ○참기름
│깻│잎│  │빨│간│고│추│  │     ≠        ○무순 ○와사비
├──┼──┤  ├──┼──┼──┼──┤  │              (flat 버튼 나열)
│참│기│름│무│순│  │  │  │
└──┴──┴──┴──┴──┴──┴──┴──┘
```

---

## 2. 근본 원인 분석 (DB → gameStore → Component 흐름 추적)

### 원인 A: DECO_ZONE 메타데이터 캐싱 누락

- `preloadStorageData()`는 `kitchen_equipment.storage_location_ids`에 연결된 `storage_locations`를 캐싱함
- DECO_ZONE 타입의 storage_location은 `ingredients_inventory` 테이블에 재고가 없음 (deco_ingredients는 별도 테이블)
- 기존 로직: `ingredients가 0개면 data: null 반환` → **DECO_ZONE의 grid 메타(rows/cols)가 캐시에서 누락**
- 결과: DecoZone 컴포넌트가 그리드 크기 정보를 알 수 없음

### 원인 B: DecoZone UI에서 grid_positions/grid_size 미사용

- `deco_ingredients` 테이블에는 `grid_positions`("1,2,3"), `grid_size`("2x2") 필드가 존재
- 어드민 에디터(`EquipmentStorageModal.tsx`)는 `calculateGridArea()`로 CSS Grid 위치 계산하여 배치
- 게임 DecoZone(`DecoZone.tsx`)은 이 필드를 **완전히 무시**하고 `flex flex-wrap gap-2`로 원형 버튼만 렌더링

### 원인 C: deco_ingredients.storage_location_id NULL

- `deco_ingredients.storage_location_id`는 nullable FK
- 시드 데이터(SQL INSERT)나 레거시 데이터에서 이 값이 NULL인 경우 존재
- 어드민 에디터에서도 orphaned 처리 로직이 있는 것 자체가 이 문제를 증명 (`EquipmentStorageModal.tsx:292-300`)
- NULL이면 게임에서 어떤 DECO_ZONE에 소속되는지 알 수 없음

---

## 3. 수정 사항

### 3-1. storageCache 타입 확장 — `gameStore.ts:122-129`

DECO_ZONE을 판별하고 매칭할 수 있도록 storageCache에 메타 필드 추가.

```typescript
// 변경 전
storageCache: Record<string, {
  title: string
  gridRows: number
  gridCols: number
  ingredients: IngredientInventory[]
}>

// 변경 후
storageCache: Record<string, {
  title: string
  gridRows: number
  gridCols: number
  locationId?: string       // storage_location UUID (DECO_ZONE 매칭용)
  locationType?: string     // location_type (DECO_ZONE 판별용)
  ingredients: IngredientInventory[]
}>
```

### 3-2. preloadStorageData DECO_ZONE 캐싱 — `gameStore.ts:1382-1410`

DECO_ZONE은 `ingredients_inventory`가 없어도 grid 메타데이터를 캐싱하도록 수정.

- 변경 전: `ingredients가 0개 → data: null` (DECO_ZONE 누락)
- 변경 후: `location_type === 'DECO_ZONE'이면 gridRows/gridCols/locationId를 캐싱` (ingredients는 빈 배열)
- 모든 캐시 엔트리에 `locationId`, `locationType` 추가

### 3-3. deco_ingredients storage_location_id DB 자동 수정 — `gameStore.ts:1428-1457`

`preloadStorageData` 시점에서 DECO_ZONE 위치를 확보한 후, `storage_location_id`가 NULL이거나 유효하지 않은 `deco_ingredients`를 **DB UPDATE**로 수정.

```
[흐름]
1. storageCache에서 DECO_ZONE 엔트리 필터 (locationType === 'DECO_ZONE')
2. 첫 번째 DECO_ZONE의 locationId를 기준으로 설정
3. decoIngredients 중 storage_location_id가 NULL이거나 매칭 안 되는 항목 검출
4. supabase.from('deco_ingredients').update({ storage_location_id }).in('id', fixIds) 실행
5. DB 성공 시 스토어 동기화
```

근본 원인(DB)을 수정하므로 한 번 실행되면 이후 세션에서는 정합성 체크에 걸리지 않음.

### 3-4. DecoZone CSS Grid 렌더링 — `DecoZone.tsx:96-135, 422-510`

상시배치 재료 영역을 어드민과 동일한 CSS Grid로 교체.

**추가된 로직:**
- `useMemo`로 storageCache에서 DECO_ZONE 메타 추출 및 decoIngredients 그룹핑
- `storage_location_id` 기준 그룹핑, orphaned 항목은 첫 번째 DECO_ZONE에 할당 (어드민 동일 로직)
- `calculateGridArea(grid_positions, gridCols)` — 기존 `utils/grid.ts` 유틸 활용

**렌더링 분기 (3단계):**

| 조건 | 렌더링 방식 |
|------|------------|
| DECO_ZONE 메타 존재 + grid_positions 있음 | CSS Grid 배치 (어드민과 동일) |
| DECO_ZONE 메타 존재 + grid_positions 없음 | 그리드 하단에 원형 버튼 폴백 |
| DECO_ZONE 메타 없음 | 기존 원형 버튼 폴백 (하위 호환) |

---

## 4. 추가 DB 구조 수정 필요 사항

### 4-1. deco_ingredients.storage_location_id NOT NULL 제약 추가

현재 이 컬럼은 nullable이어서 데이터 정합성이 보장되지 않음.
모든 기존 NULL 데이터가 자동 수정 로직(3-3)으로 채워진 후, NOT NULL 제약을 추가해야 함.

```
deco_ingredients.storage_location_id 컬럼을
NULL 허용 → NOT NULL로 변경.
단, FK 참조 대상인 storage_locations 행이 먼저 존재해야 하므로,
PREP_TABLE 장비가 생성되어 DECO_ZONE storage_location이 있는 매장에서만 유효.
매장에 PREP_TABLE이 없는 경우를 대비하여 CHECK 제약 또는 앱 레벨 검증도 고려할 것.
```

### 4-2. deco_ingredients.grid_positions / grid_size NOT NULL 기본값

현재 이 필드도 nullable인데, 그리드 배치에 필수적인 정보임.
기본값을 설정하거나 NOT NULL 제약을 추가해야 함.

```
grid_positions: 기본값 '1' (첫 번째 셀)
grid_size: 기본값 '1x1' (1칸 차지)

NULL인 기존 데이터는 어드민 에디터에서 재배치하거나,
마이그레이션으로 기본값('1', '1x1')을 일괄 할당.
```

### 4-3. 시드 데이터 SQL 템플릿 수정

`supabase/full_test_data.sql` 등 시드 파일에서 `deco_ingredients` INSERT 시
`storage_location_id`, `grid_positions`, `grid_size` 컬럼을 반드시 포함하도록 수정.

```
현재: INSERT INTO deco_ingredients (store_id, ingredient_master_id, deco_category, ...)
      → storage_location_id, grid_positions, grid_size 누락 가능

수정: INSERT 시 반드시 해당 매장의 DECO_ZONE storage_location UUID와
      그리드 배치 정보를 함께 입력하도록 템플릿 변경.
```

### 4-4. RLS 정책 확인

현재 `deco_ingredients` 테이블에 UPDATE RLS 정책이 없을 수 있음.
자동 수정 로직(3-3)이 `supabase.update()`를 호출하므로,
해당 테이블에 authenticated 사용자의 UPDATE 권한이 필요.

```
deco_ingredients 테이블에 대해:
- SELECT: 이미 허용됨
- INSERT: 어드민 에디터에서 사용 중 (확인 필요)
- UPDATE: 자동 수정 로직 + 어드민 에디터에서 필요 → 정책 확인/추가
- DELETE: 어드민 에디터에서 사용 중 (확인 필요)
```

---

## 5. 수정 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `src/stores/gameStore.ts` | storageCache 타입 확장, DECO_ZONE 캐싱, DB 정합성 자동 수정 |
| `src/components/Kitchen/DecoZone.tsx` | CSS Grid 렌더링, storage_location_id 기반 그룹핑 |

## 6. 수정 원칙 준수

| 원칙 | 적용 |
|------|------|
| 단일 플로우 | 장비별 분기 없이 `locationType` DB 값으로 DECO_ZONE 판별 |
| DB 구조 기반 | `location_type`, `grid_positions`, `grid_size`, `storage_location_id` — DB 컬럼 값만 활용 |
| 데이터 흐름 추적 | DB NULL → DB UPDATE로 근본 수정, 런타임 패치가 아닌 영구 수정 |
