"""
API 테스트 스크립트
실행: python test_api.py
(서버가 localhost:8000 에서 실행 중이어야 합니다)
"""

import json
import httpx

BASE = "http://localhost:8000"

# TEST_K50_1.json 파일을 그대로 전송하는 테스트
with open("TEST_K50_1.json") as f:
    payload = json.load(f)

payload["timelimit"] = 10  # 테스트용으로 10초만

print("=== /api/load-json 테스트 ===")
resp = httpx.post(f"{BASE}/api/load-json", json=payload, timeout=30)
print(f"Status: {resp.status_code}")

if resp.status_code == 200:
    result = resp.json()
    print(f"묶음 수       : {result['num_bundles']}")
    print(f"평균 비용     : {result['avg_cost']:.1f}원")
    print(f"총 비용       : {result['total_cost']:.0f}원")
    print(f"총 이동거리   : {result['total_dist']}m")
    print(f"Feasible     : {result['feasible']}")
    print(f"소요 시간     : {result['elapsed_sec']}초")
    print()
    for i, b in enumerate(result["bundles"][:3]):  # 앞 3개만 출력
        print(f"[Bundle {i+1}] {b['rider_type']} | 픽업: {b['shop_seq']} → 배달: {b['dlv_seq']}")
else:
    print(resp.text)
