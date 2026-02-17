# 어드민 페이지 개발 로드맵

## 목적

어드민 = 시뮬레이터가 읽는 DB에 데이터를 넣는 UI. 시뮬레이터는 이미 store_id 기준으로 데이터를 로드 → 렌더링하는 구조이므로, 어드민에서 올바른 데이터만 넣으면 어떤 매장이든 시뮬레이터가 자동 작동.

## 전체 Phase 순서

데이터 의존 관계 (FK 순서) 기반. 각 Phase 완료 후 시뮬레이터 접속해서 검증.

```
Phase 1: 매장 생성 + 사용자/아바타 생성  ← 현재 진행 중
   └─ 검증: 새 매장 선택 → 새 사용자 로그인 → /level-select 도달

Phase 2: 주방 레이아웃 설정
   └─ 검증: 시뮬레이터에서 그리드 + 장비 렌더링 확인

Phase 3: 저장 공간 + 식자재 배치
   └─ 검증: 시뮬레이터에서 냉장고/서랍 열었을 때 식자재 표시 확인

Phase 4: 레시피 등록
   └─ 검증: 시뮬레이터에서 메뉴 주문 → 조리 → 데코 → 서빙 전체 플로우

Phase 5: 시뮬레이터 연동 종합 검증
   └─ 검증: 새 매장 데이터만으로 전체 게임 플레이 가능 확인
```

## Phase 1: 매장 생성 + 사용자/아바타 생성

### 배경

기존 StoreSelect.tsx는 매장 목록을 SELECT해서 보여주고, UserLogin.tsx는 사용자 목록을 SELECT해서 보여준다. 여기에 "생성" 기능을 추가한다.

### 작업 전 분석 (plan mode)

아래 파일을 먼저 읽고 현재 구조 파악:
1. src/pages/StoreSelect.tsx — 매장 목록 조회 + 선택 로직
2. src/pages/UserLogin.tsx — 사용자 목록 조회 + 비밀번호 로그인 로직
3. src/types/database.types.ts — Store, User 타입 (실제 DB 스키마와 차이 확인)
4. src/stores/gameStore.ts — setStore, setCurrentUser 함수
5. src/lib/supabase.ts — Supabase 클라이언트 설정
6. src/App.tsx — 라우팅 구조

파악 후 구현 계획 보고. 코드 수정은 승인 후.

### 매장 생성 기능

기존 StoreSelect.tsx에 "새 매장 만들기" 버튼 추가, 또는 별도 /admin/stores 경로. 기존 코드 구조 보고 판단.

입력:
- store_name (필수)
- store_code (필수, 영문+숫자, 자동 대문자 변환, UNIQUE)
- store_address (선택)
- store_phone (선택)

동작:
- Supabase INSERT → 성공 시 목록 즉시 갱신
- store_code 중복 에러 핸들링
- 생성된 매장을 바로 선택 가능

### 사용자/아바타 생성 기능

매장이 선택된 상태에서 해당 매장에 사용자 추가. 기존 UserLogin.tsx에 "사용자 추가" 버튼, 또는 모달.

입력:
- username (필수)
- avatar_name (선택, 기본값 'default')
- role (선택, 기본값 'STAFF', 드롭다운: ADMIN / MANAGER / STAFF)

동작:
- Supabase INSERT (store_id = 현재 선택된 매장) → 성공 시 목록 즉시 갱신
- 생성된 사용자로 바로 로그인 가능

### RLS 정책

현재 stores와 users에 INSERT 정책이 없음. 추가 필요:

```sql
-- stores INSERT/UPDATE (어드민용)
CREATE POLICY "stores_insert" ON stores FOR INSERT WITH CHECK (true);
CREATE POLICY "stores_update" ON stores FOR UPDATE USING (true);

-- users INSERT/UPDATE (어드민용)
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);
```

Supabase 대시보드 → Authentication → Policies에서 직접 추가하거나, SQL Editor에서 실행.

### 주의사항

- 기존 StoreSelect/UserLogin 플로우를 깨뜨리지 않을 것
- 기존 Tailwind 스타일과 일관성 유지
- 기존 supabase 클라이언트 그대로 사용
- 한국어 UI
- database.types.ts의 User 타입에 role 필드가 없으면 추가 필요

### 검증 체크리스트

- [ ] 새 매장 생성 → 매장 목록에 즉시 표시
- [ ] 새 매장 선택 → /user-login 이동
- [ ] 새 사용자 생성 → 사용자 목록에 즉시 표시
- [ ] 새 사용자 선택 → 비밀번호 입력 → /level-select 정상 이동
- [ ] Supabase 대시보드에서 stores, users 테이블 데이터 확인
- [ ] 기존 매장/사용자 (MARKET001, 테스트유저) 플로우 정상 작동

---

## Phase 2: 주방 레이아웃 설정

### 작업 내용 (Phase 1 완료 후 상세화)

- /admin/kitchen 경로
- 그리드 크기 설정 (rows × cols)
- 장비 팔레트에서 드래그앤드롭 배치 (BURNER, SINK, FRYER, MICROWAVE, FREEZER 등)
- 장비별 config 설정 (화구 수, 바스켓 수 등 → equipment_config JSONB)
- 장비 위치 저장 (grid_x, grid_y, grid_w, grid_h)
- kitchen_grids + kitchen_equipment 테이블 INSERT

### RLS 추가 필요
```sql
CREATE POLICY "kitchen_grids_insert" ON kitchen_grids FOR INSERT WITH CHECK (true);
CREATE POLICY "kitchen_grids_update" ON kitchen_grids FOR UPDATE USING (true);
CREATE POLICY "kitchen_equipment_insert" ON kitchen_equipment FOR INSERT WITH CHECK (true);
CREATE POLICY "kitchen_equipment_update" ON kitchen_equipment FOR UPDATE USING (true);
CREATE POLICY "kitchen_equipment_delete" ON kitchen_equipment FOR DELETE USING (true);
```

---

## Phase 3: 저장 공간 + 식자재 배치

### 작업 내용 (Phase 2 완료 후 상세화)

- 폼 기반 (드래그앤드롭 아님)
- 저장 공간 생성 (location_type, grid 크기, 층수)
- ingredients_master에서 재료 선택
- 저장 공간 내 위치 지정 (grid_positions, floor_number)
- storage_locations + ingredients_inventory 테이블 INSERT

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