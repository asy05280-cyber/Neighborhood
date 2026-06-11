# 묶음배송 최적화 API — 백엔드

## 폴더 구조

```
backend/
├── main.py              ← FastAPI 서버 (이 파일)
├── requirements.txt     ← 의존성
├── test_api.py          ← 테스트 스크립트
├── algorithm/
│   ├── __init__.py
│   ├── myalgorithm.py   ← 업로드한 파일 그대로 복사
│   └── util.py          ← 업로드한 파일 그대로 복사
└── TEST_K50_1.json      ← 테스트용 데이터
```

## 설치 및 실행

```bash
# 1. conda 환경 활성화 (ogc2024_env.yml 기반)
conda activate ogc2024

# 2. FastAPI 추가 설치
pip install fastapi uvicorn[standard] pydantic httpx

# 3. algorithm 폴더 만들고 파일 복사
mkdir algorithm
touch algorithm/__init__.py
cp myalgorithm.py algorithm/
cp util.py algorithm/

# 4. 서버 실행
uvicorn main:app --reload --port 8000
```

## API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/` | 서버 확인 |
| GET | `/health` | 헬스체크 |
| GET | `/docs` | Swagger 자동문서 |
| POST | `/api/optimize` | 최적화 (동기) |
| POST | `/api/optimize/async` | 최적화 (비동기) |
| GET | `/api/jobs/{job_id}` | 작업 상태 조회 |
| POST | `/api/load-json` | JSON 파일 형식 그대로 전송 |

## 테스트

```bash
# 테스트 스크립트 실행
python test_api.py

# 또는 Swagger UI에서 직접 테스트
open http://localhost:8000/docs
```
