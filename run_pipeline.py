import sys
import json
import subprocess
import time
import gurobipy as gp
from gurobipy import GRB
import os

DATA_FILE = "STAGE3_TEST_1.json" 
CANDIDATE_FILE = "gurobi_warehouse.csv" 
TOTAL_TIMELIMIT = 300 

def get_timelist(timelimit):
    if timelimit >= 300:
        return [[150, 60], [30, 20], [15, 15]] 
    elif timelimit >= 180:
        return [[80, 40], [20, 15], [10, 5]]   
    elif timelimit >= 60:
        return [[25, 15], [8, 7]]              
    else:
        return [[15, 10]]                      

def run_iterative_pipeline():
    start_time = time.time()
    
    if os.path.exists(CANDIDATE_FILE):
        os.remove(CANDIDATE_FILE)
        print("🧹 [초기화] 이전 테스트의 CSV 파일을 깨끗하게 청소했습니다!")
        
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    num_orders = len(data['ORDERS'])
    print(f"=== 🚀 DMS 벤치마킹 하이브리드 알고리즘 시작 ({DATA_FILE}) ===")
    
    timelist = get_timelist(TOTAL_TIMELIMIT)
    best_cost = float('inf')
    
    for i, (alns_time, sp_time) in enumerate(timelist):
        round_num = i + 1
        print(f"\n▶▶ [라운드 {round_num}/{len(timelist)}] (C++: {alns_time}초 ➔ Gurobi: {sp_time}초)")
        
        seed = round_num * 100 
        subprocess.run(["main.exe", str(alns_time), str(seed)], check=False)
        
        if not os.path.exists(CANDIDATE_FILE):
            break
            
        bundles = []
        with open(CANDIDATE_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for line in lines[1:]: 
                parts = line.strip().split(',')
                rider_type = parts[0]
                cost = float(parts[1])
                order_ids = [int(x) for x in parts[2].split()]
                bundles.append((rider_type, cost, order_ids))
                
        print(f" └ 📦 누적 후보 경로 {len(bundles)}개 확보. Gurobi 결재 대기 중...")
        
        env_options = {"OutputFlag": 0, "TimeLimit": sp_time}
        with gp.Env(params=env_options) as env:
            with gp.Model("DMS_Iterative", env=env) as m:
                x = m.addVars(len(bundles), vtype=GRB.BINARY, name="x")
                m.setObjective(gp.quicksum(bundles[j][1] * x[j] for j in range(len(bundles))), GRB.MINIMIZE)
                
                for i_order in range(num_orders):
                    m.addConstr(
                        gp.quicksum(x[j] for j, b in enumerate(bundles) if i_order in b[2]) == 1,
                        name=f"cov_{i_order}"
                    )
                
                m.optimize()
                
                if m.status == GRB.OPTIMAL or m.status == GRB.TIME_LIMIT:
                    if m.SolCount > 0:
                        current_cost = m.ObjVal
                        print(f" └ 🎉 Gurobi 결재 완료! 현재 최소 비용: {current_cost:,.0f}원")
                        if current_cost < best_cost:
                            best_cost = current_cost
                    else:
                        print(" └ ⚠️ 제한 시간 내에 유효한 조합을 찾지 못했습니다.")

        elapsed = time.time() - start_time
        print(f" └ 라운드 {round_num} 종료 (누적 소요 시간: {elapsed:.1f}초)")

    print(f"\n=== 🏁 모든 하이브리드 최적화 종료! (최종 비용: {best_cost:,.0f}원) ===")

if __name__ == "__main__":
    run_iterative_pipeline()