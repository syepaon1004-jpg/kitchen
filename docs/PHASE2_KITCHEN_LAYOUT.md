# Phase 2: 주방 레이아웃 설정 — Claude Code 작업 지시

## 목표

어드민이 웹 UI에서 주방 그리드를 만들고, 장비를 드래그앤드롭으로 배치하고, DB에 저장하는 페이지.

---

## 작업 전 분석 (plan mode)

아래 파일들을 먼저 읽고 현재 구조를 파악해라:

1. `01_SCHEMA_CREATE.sql` — kitchen_grids, kitchen_equipment 테이블 스키마
2. `02_SAMPLE_DATA.sql` — 기존 샘플 데이터 (그리드 8×12, 장비 7개 배치)
3. `src/types/database.types.ts` — 현재 타입 정의 (KitchenLayout 구형 타입 확인)
4. `src/stores/gameStore.ts` — loadStoreData() 함수가 주방 데이터를 어떻게 로드하는지
5. `src/App.tsx` — 라우팅 구조
6. `src/pages/StoreSelect.tsx` — 매장 선택 후 navigate 흐름

파악 후 구현 계획 보고. 코드 수정은 승인 후.

---

## DB 스키마 (이미 존재)

```sql
kitchen_grids (
  id UUID PK,
  store_id UUID FK → stores,
  grid_rows INTEGER DEFAULT 8,
  grid_cols INTEGER DEFAULT 12,
  grid_name TEXT DEFAULT '기본 주방',
  is_active BOOLEAN DEFAULT true,
  created_at, updated_at
)

kitchen_equipment (
  id UUID PK,
  kitchen_grid_id UUID FK → kitchen_grids,
  equipment_type TEXT CHECK (
    'BURNER', 'SINK', 'DRAWER_FRIDGE', 'FRIDGE_4BOX',
    'SEASONING_COUNTER', 'PLATING_STATION', 'CUTTING_BOARD',
    'MICROWAVE', 'TORCH', 'COLD_TABLE', 'PREP_TABLE',
    'FRYER', 'WORKTABLE'
  ),
  equipment_key TEXT NOT NULL,        -- 'burner_1', 'sink_main' 등
  grid_x INTEGER NOT NULL,           -- 0-based 시작 열
  grid_y INTEGER NOT NULL,           -- 0-based 시작 행
  grid_w INTEGER DEFAULT 1,          -- 차지하는 열 수
  grid_h INTEGER DEFAULT 1,          -- 차지하는 행 수
  equipment_config JSONB DEFAULT '{}',
  storage_location_ids TEXT[] DEFAULT '{}',
  display_name TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at, updated_at
)
```

## equipment_type별 기본 크기 및 config

| type | 기본 크기 | config 예시 |
|------|----------|-------------|
| BURNER | 2×2 | `{"max_temp": 400}` |
| SINK | 2×3 | `{"can_wash_wok": true}` |
| DRAWER_FRIDGE | 4×2 | `{}` |
| FRIDGE_4BOX | 2×4 | `{}` |
| SEASONING_COUNTER | 2×4 | `{"rows": 4, "cols": 2}` |
| PLATING_STATION | 3×2 | `{"max_plates": 4}` |
| CUTTING_BOARD | 2×2 | `{"can_slice": true}` |
| MICROWAVE | 2×2 | `{"capacity": 1, "power_levels": ["LOW","MEDIUM","HIGH"]}` |
| TORCH | 1×1 | `{}` |
| COLD_TABLE | 3×2 | `{"temp_range": [0, 5]}` |
| PREP_TABLE | 3×2 | `{"slots": 3}` |
| FRYER | 3×2 | `{"baskets": 3}` |
| WORKTABLE | 3×2 | `{}` |

---

## 구현 요구사항

### 1. 라우팅

`/admin/kitchen` 경로 추가. App.tsx에 Route 추가.
매장이 선택되지 않은 상태면 `/`로 리다이렉트.
매장 선택 페이지에서 어드민 페이지로 진입할 수 있는 버튼 추가 (매장 선택 후).

### 2. 페이지 레이아웃

```
┌──────────────────────────────────────────────────┐
│ [← 돌아가기]  매장명 - 주방 레이아웃 설정        │
├──────────────┬───────────────────────────────────┤
│              │                                    │
│  장비 팔레트  │        그리드 영역                 │
│  (좌측 패널)  │   (N×M CSS Grid, 드래그 대상)     │
│              │                                    │
│  BURNER      │   ┌──┬──┬──┬──┬──┬──┐             │
│  SINK        │   │  │  │  │  │  │  │             │
│  DRAWER_...  │   ├──┼──┼──┼──┼──┼──┤             │
│  FRIDGE_...  │   │  │  │  │  │  │  │             │
│  ...         │   └──┴──┴──┴──┴──┴──┘             │
│              │                                    │
├──────────────┴───────────────────────────────────┤
│ 그리드 크기: [rows] × [cols]    [저장] [초기화]    │
└──────────────────────────────────────────────────┘
```

### 3. 장비 팔레트 (좌측)

- 13종 장비 목록 (equipment_type별)
- 각 장비에 아이콘 + 이름 표시
- 팔레트에서 그리드로 드래그 가능
- 같은 장비를 여러 개 배치 가능 (BURNER 3개 등)

### 4. 그리드 영역 (우측)

- 그리드 크기를 사용자가 설정 가능 (기본 8×12)
- CSS Grid로 렌더링, 각 셀에 배경색/테두리
- 장비를 드롭하면 해당 위치에 배치 (grid_x, grid_y 자동 계산)
- 배치된 장비는 grid_w × grid_h 크기로 셀을 차지
- 배치된 장비 클릭 시 설정 패널:
  - display_name 수정
  - equipment_config 수정 (JSON 에디터 또는 필드별 폼)
  - 삭제 버튼
- 배치된 장비를 그리드 내에서 재배치 (드래그) 가능
- 겹침 방지: 이미 장비가 있는 셀에 드롭 불가

### 5. 드래그앤드롭 라이브러리

`@dnd-kit/core` + `@dnd-kit/utilities` 사용.
이유: react-dnd보다 가볍고, 그리드 스냅핑 구현이 쉬움.

```bash
npm install @dnd-kit/core @dnd-kit/utilities
```

### 6. 저장 로직

"저장" 버튼 클릭 시:

1. kitchen_grids에 UPSERT (store_id 기준, 매장당 하나의 그리드)
   - 이미 있으면 UPDATE (grid_rows, grid_cols, grid_name)
   - 없으면 INSERT
2. 기존 kitchen_equipment 전체 DELETE (해당 grid_id)
3. 현재 배치된 장비 전부 INSERT

equipment_key 자동 생성: `{equipment_type.toLowerCase()}_{순번}` (예: burner_1, burner_2, sink_1)

### 7. 기존 데이터 로드

페이지 진입 시:
1. `kitchen_grids`에서 현재 매장의 그리드 조회
2. 있으면: grid 크기 설정 + `kitchen_equipment` 조회 → 그리드에 장비 배치 표시
3. 없으면: 빈 그리드 (기본 8×12)

### 8. 타입 추가

`database.types.ts`에 추가:

```typescript
export interface KitchenGrid {
  id: string
  store_id: string
  grid_rows: number
  grid_cols: number
  grid_name: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface KitchenEquipment {
  id: string
  kitchen_grid_id: string
  equipment_type: string
  equipment_key: string
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  equipment_config: Record<string, any>
  storage_location_ids: string[]
  display_name: string
  display_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type EquipmentType =
  | 'BURNER' | 'SINK' | 'DRAWER_FRIDGE' | 'FRIDGE_4BOX'
  | 'SEASONING_COUNTER' | 'PLATING_STATION' | 'CUTTING_BOARD'
  | 'MICROWAVE' | 'TORCH' | 'COLD_TABLE' | 'PREP_TABLE'
  | 'FRYER' | 'WORKTABLE'
```

---

## RLS 정책 (사용자가 직접 Supabase SQL Editor에서 실행)

```sql
CREATE POLICY "kitchen_grids_insert" ON kitchen_grids FOR INSERT WITH CHECK (true);
CREATE POLICY "kitchen_grids_update" ON kitchen_grids FOR UPDATE USING (true);
CREATE POLICY "kitchen_grids_delete" ON kitchen_grids FOR DELETE USING (true);
CREATE POLICY "kitchen_equipment_insert" ON kitchen_equipment FOR INSERT WITH CHECK (true);
CREATE POLICY "kitchen_equipment_update" ON kitchen_equipment FOR UPDATE USING (true);
CREATE POLICY "kitchen_equipment_delete" ON kitchen_equipment FOR DELETE USING (true);
```

---

## 주의사항

- 기존 시뮬레이터 코드(GamePlay.tsx, gameStore.ts)는 건드리지 마. Phase 5에서 전환.
- gameStore의 loadStoreData()도 수정하지 마. 어드민은 Supabase 직접 쿼리.
- 기존 StoreSelect/UserLogin 플로우 유지.
- 한국어 UI.
- Tailwind + framer-motion 스타일 유지.
- 장비 겹침 체크 로직 반드시 포함.

---

## 검증 체크리스트

- [ ] /admin/kitchen 페이지 접근 가능
- [ ] 매장 선택 후 어드민 진입 가능
- [ ] 그리드 크기 변경 (rows/cols) 가능
- [ ] 팔레트에서 장비를 그리드로 드래그앤드롭 배치 가능
- [ ] 배치된 장비가 올바른 크기(grid_w × grid_h)로 표시
- [ ] 장비 겹침 시 배치 거부
- [ ] 배치된 장비 클릭 → 설정 패널 표시 (display_name, config 수정, 삭제)
- [ ] "저장" → Supabase kitchen_grids + kitchen_equipment에 정상 저장
- [ ] 페이지 새로고침 → 저장된 데이터 정상 로드
- [ ] "초기화" → 그리드 비우기
- [ ] 기존 MARKET001 매장의 기존 데이터가 있으면 로드해서 표시
- [ ] Supabase 대시보드에서 INSERT된 데이터 확인