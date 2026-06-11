import subprocess
import os
import pandas as pd
import ast
import json   # 💡 JSON 파일을 직접 읽기 위해 추가!
import gurobipy as gp
from gurobipy import GRB

# --- 설정 구간 ---
CPP_SOURCE = "main.cpp"
CPP_EXE = "main.exe"
DATA_FILE = "TEST_K200_1.json"  # 👉 이제 여기서 파일명만 바꾸면 전부 자동 적용됩니다!
CSV_PATH = "gurobi_warehouse.csv"
# ----------------

def run_pipeline():
    print("=== 🛠️ 통합 최적화 파이프라인 가동 ===")

    # 1. C++ 컴파일
    print(f"📡 1단계: C++ 엔진 빌드 중... ({CPP_SOURCE})")
    compile_result = subprocess.run(["g++", CPP_SOURCE, "-o", CPP_EXE], capture_output=True, text=True)
    if compile_result.returncode != 0:
        print("❌ 컴파일 에러 발생!")
        print(compile_result.stderr)
        return

    # 2. C++ 실행 (파이썬이 C++에게 파일명을 던져줌!)
    print(f"🏃 2단계: C++ ALNS 엔진 가동 ({DATA_FILE} 데이터 사용)...")
    process = subprocess.run([f"./{CPP_EXE}", DATA_FILE], capture_output=True, text=True, encoding='utf-8')
    print(process.stdout) 

    # 3. Gurobi 최적화
    if not os.path.exists(CSV_PATH):
        print(f"🚨 에러: {CSV_PATH}가 생성되지 않았습니다!")
        return

    # --- 라이선스 설정 ---
    options = {
        "WLSACCESSID": "6baa96bf-19a7-4c1c-b530-6b96eea14004",
        "WLSSECRET": "df86cbd5-41e9-4530-8b5a-5957efa97e25",
        "LICENSEID": 2821860,
    }

    print("🧬 3단계: Gurobi 집합 분할 최적화 시작...")
    df = pd.read_csv(CSV_PATH)
    df['orders'] = df['orders'].apply(ast.literal_eval)
    
    # 💡 [핵심 수정] JSON 파일에서 직접 K값(주문 수)을 읽어옵니다!
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        problem_data = json.load(f)
        K = problem_data["K"]
    print(f"📊 데이터 분석: 총 {K}개의 주문을 최적화합니다.")

    order_to_bundles = {i: [] for i in range(K)}
    for b_id, row in df.iterrows():
        for order_id in row['orders']:
            if order_id < K:
                order_to_bundles[order_id].append(b_id)

    # Gurobi 실행
    with gp.Env(params=options) as env:
        with gp.Model("DMS_Integrated", env=env) as m:
            m.setParam('TimeLimit', 60)
            m.setParam('OutputFlag', 1) 

            x = m.addVars(len(df), vtype=GRB.BINARY, obj=df['cost'], name="x")
            for o in range(K):
                m.addConstr(gp.quicksum(x[b] for b in order_to_bundles[o]) == 1)

            m.optimize()

            if m.status == GRB.OPTIMAL:
                print(f"\n✨ [최종 결과] 최적 비용: {m.ObjVal:.2f}원")
                selected_count = sum(1 for b in range(len(df)) if x[b].X > 0.5)
                print(f"✨ 선택된 번들 개수: {selected_count}개")
            
    print("\n=== ✅ 모든 공정 완료 ===")

if __name__ == "__main__":
    run_pipeline()