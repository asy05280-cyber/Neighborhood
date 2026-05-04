# Rider Dispatch Waiting UI

React + Tailwind 기반의 배달 라이더 배차 대기 화면입니다. 카카오맵 위에 canvas hex heatmap을 올려 Uber 스타일 밀집도를 표현합니다.

## Setup

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`의 `VITE_KAKAO_MAP_APP_KEY`를 카카오 JavaScript 키로 변경하세요.

3. 개발 서버 실행

```bash
npm run dev
```

## Structure

- `src/components/MapView.tsx`: 카카오맵 초기화, 좌표 변환, hex heatmap canvas 렌더
- `src/components/TopControls.tsx`: 상단 햄버거 버튼 + 업무 중 pill
- `src/components/BottomSheet.tsx`: 하단 배차 안내 바텀 시트
- `src/services/orderHeatmap.ts`: 주문 히트맵 데이터 fetch 함수 (mock -> API 확장용)

## Backend Extension

현재 `fetchOrderHeatPoints()`는 mock 데이터를 반환합니다. FastAPI 연동 시 해당 함수 내부를 실제 API 호출로 교체하면 됩니다.
