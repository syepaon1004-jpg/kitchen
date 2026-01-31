# 주방 시뮬레이터

주방 알바생이 레시피와 식자재 위치를 학습할 수 있는 웹 기반 시뮬레이터입니다.

## 기술 스택

- React 18+ (TypeScript)
- Vite
- Tailwind CSS
- Zustand (상태 관리)
- React Query
- Supabase (DB/인증)
- Recharts (그래프)
- Framer Motion (애니메이션)

## 실행 방법

1. 의존성 설치: `npm install`
2. `.env` 파일이 프로젝트 루트에 있는지 확인 (Supabase URL, Anon Key)
3. 개발 서버: `npm run dev`
4. 빌드: `npm run build`

## 화면 흐름

1. **매장 선택** (`/`) → Supabase `stores`에서 매장 목록 로드
2. **사용자 선택** (`/user`) → 매장별 사용자 목록, 신규 생성 가능
3. **레벨 선택** (`/level`) → 신입/알바/관리자 (메뉴 입장 속도 차이)
4. **게임** (`/game`) → 타이머, 메뉴 대기열, 화구/싱크대/서랍냉장고/조미료대, 액션 로그, 화구 사용율
5. **결과** (`/result`) → 레시피 정확도·속도·화구 사용율 점수, 실력 상승 그래프

## 환경 변수

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
