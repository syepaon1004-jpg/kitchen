# Kitchen Simulator - 필수 원칙

## 수정 원칙 (모든 작업에 적용)

1. **단일 플로우 원칙** - 장비별 별도 함수 금지. 하나의 통합 함수가 `cooking_type`/`action_type`으로 분기.
2. **DB 구조 기반 수정** - 하드코딩 비교 금지. DB 컬럼 값(`cooking_type`, `is_main_dish`, `action_type`, `action_params`)으로만 판별.
3. **데이터 흐름 추적** - 증상이 아니라 DB → gameStore → 컴포넌트 흐름의 근본 원인 수정.

## 설계 원칙 (아키텍처)

1. **묶음과 장비는 별개의 존재** - 묶음은 "뭘 만들고 있나", 장비는 "장비 자체의 물리 상태".
2. **장비가 주체** - "소면을 넣으려면 웍에 물이 있어야 해"가 아니라 "웍이 소면을 끓이려면 웍에 물이 있어야 해".
3. **위치 이동 = location 필드만 변경** - 묶음 데이터는 불변. 컨테이너 간 데이터 변환 없음.

## 합치기 원칙 (mergeBundle)

`mergeBundle(targetInstanceId, sourceInstanceId)`

### 처리 순서
1. 두 BundleInstance 찾기
2. `recipeId` 일치 검증 (orderId 아님 - 크로스 오더 허용)
3. `target.isMainDish === true` 검증
4. `deco_steps`에서 `source_type === 'BUNDLE' && source_bundle_id === source.bundleId` 검색
5. 순서 검증 (`deco_order` 기준, level별 분기)
6. `target.plating`에 레이어 추가
7. `moveBundle(sourceInstanceId, { type: 'MERGED', targetInstanceId })`

### 규칙 요약

| 규칙 | 설명 |
|------|------|
| 매칭 기준 | `source_bundle_id` (recipe_bundles.id) - 묶음 템플릿 레벨 |
| 크로스 오더 | recipeId만 일치하면 orderId 달라도 합치기 허용 |
| 방향 | 비메인(DECO_SETTING) → 메인(DECO_MAIN)으로만 합침 |
| 순서 | `deco_steps.deco_order` 기준. BEGINNER면 순서 틀리면 거절, 그 외 감점 |
| source 위치 | `bundleInstances.filter(b => b.bundleId === sourceBundleId && b.location.type === 'DECO_SETTING')` |

### 예시: 육회물회 합치기 순서
```
메인(COLD, DECO_MAIN) <- 냉면육수(MICROWAVE, DECO_SETTING)  deco_order 1
                      <- 소면(HOT, DECO_SETTING)            deco_order 2
                      <- 쫄면야채(데코 아이템)                deco_order 3
                      <- 육회(MICROWAVE, DECO_SETTING)       deco_order 4
                      <- 부추+깨+참기름(데코 아이템)           deco_order 5
```

## 참고 문서
- `.claude/HANDOFF_FRONTEND_260207.md` - 프론트엔드 가이드
- `.claude/HANDOFF_BACKEND_260207.md` - 백엔드/스토어 가이드
