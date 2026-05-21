# 🚀 DMS 배달 최적화 하이브리드 알고리즘

## 📌 프로젝트 개요
ALNS(Adaptive Large Neighborhood Search) + Gurobi 집합 분할을 결합한
배달 경로 최적화 하이브리드 알고리즘입니다.

C++로 빠른 휴리스틱 탐색을 수행하고, Python/Gurobi로 최적 조합을 선택합니다.

## 🏗️ 파일 구조
| 파일 | 역할 |
|------|------|
| `main.cpp` | 전체 흐름 제어 및 타이머 |
| `models.hpp` | 핵심 데이터 구조 (Order, Bundle, Solution) |
| `phase1_promising.hpp` | 주문 간 유망 점수 행렬 생성 |
| `phase2_init.hpp` | 초기 해 생성 |
| `phase3_alns.hpp` | ALNS 탐색 엔진 (Destroy & Repair) |
| `phase4_rider.hpp` | 배달원 최적 배정 (도보/오토바이/차량) |
| `run_pipeline.py` | 전체 파이프라인 실행 (C++ ↔ Gurobi 반복) |

## 🚀 실행 방법

### 1. 의존성 설치
- [MSYS2](https://www.msys2.org/) 설치 후 g++ 사용
- [nlohmann/json](https://github.com/nlohmann/json) 다운로드 → `json.hpp`를 프로젝트 폴더에 저장
- Gurobi 라이선스 필요 (`gurobipy`)

### 2. 컴파일
```powershell
C:\msys64\ucrt64\bin\g++.exe -O2 -o main.exe main.cpp
```

### 3. 실행
```powershell
python run_pipeline.py
```

## 📦 데이터
- `TEST_K50`, `TEST_K100`, `TEST_K200` — 테스트용 소규모 데이터
- `STAGE3_TEST_1.json` — 실제 벤치마크 데이터 (K=2000, 용량 초과로 미포함)

## ⚙️ 알고리즘 흐름
1. C++ ALNS로 150초간 탐색 → 후보 경로를 CSV에 저장
2. Gurobi가 CSV에서 최적 조합 선택 (집합 분할 문제)
3. 위 과정을 3라운드 반복하며 점진적으로 개선