# Rider Dispatch UI

React + Tailwind 기반의 배달 라이더 배차 및 내비게이션 UI입니다.
카카오맵 위에 Canvas Hex Heatmap을 올려 주문 밀집도를 표현하고, 경로 최적화 API와 연동해 라이더에게 최적 배달 경로를 제공합니다.

## Setup

1. 의존성 설치

```bash
npm install
npm run build
```

2. 개발 서버 실행

```bash
npm run dev
```

3. input 데이터를 public 폴더에 넣습니다.

4. 터미널에 출력되는 로컬 주소(예: http://localhost:5173)를 브라우저에서 엽니다.

## 데이터 파일 교체
 
사용할 데이터 파일(`*.json`)을 교체할 경우 아래 두 파일에서 파일명을 수정합니다.
 
**`src/screens/LiveDispatchScreen.tsx`** — 69번, 113번 줄 (2곳)
 
```ts
const res = await fetch('/STAGE3_TEST_9.json')  // 변경
```
 
**`src/services/orderHeatmap.ts`** — 27번 줄 (1곳)
 
```ts
const res = await fetch("/STAGE3_TEST_9.json", {  // 변경
```

## 사용 흐름

1. **히트맵 화면** — 주문 밀집 지역을 히트맵으로 확인
2. **위치 설정** — GPS 버튼으로 현재 위치 고정 (선택 사항)
3. **주문 탐색** — "주변 주문 탐색하기" 버튼 클릭 → 경로 최적화 진행
4. **주문 선택** — 최적화된 주문 목록에서 경로 미리보기 후 원하는 주문 선택
5. **배정 확인** — 선택한 주문의 픽업/배달 경로 확인 후 픽업 시작
6. **내비게이션** — 픽업 → 배달 순서로 단계별 경로 안내, 배달 완료 시 초기 화면으로 복귀

## Structure

```
src/
├── screens/
│   ├── LiveDispatchScreen.tsx   # 히트맵 및 주문 탐색/배정 화면
│   ├── DeliveryScreen.tsx       # 배정된 주문 확인 및 안내 시작 화면
│   └── NavigationScreen.tsx     # 단계별 내비게이션 화면
├── components/
│   ├── DispatchMap.tsx          # 카카오맵 초기화, Hex Heatmap, 경로 렌더링
│   ├── RiderChrome.tsx          # 탐색 화면 UI 래퍼 (GPS 버튼 + BottomSheet)
│   ├── DeliveryChrome.tsx       # 배달 화면 UI 래퍼 (안내 시작 버튼)
│   ├── BottomSheet.tsx          # 주문 목록 / 배정 확인 바텀 시트
│   └── TopControls.tsx          # 상단 업무 중 pill
└── services/
    └── orderHeatmap.ts          # 주문 데이터 fetch 및 히트맵 변환
```
