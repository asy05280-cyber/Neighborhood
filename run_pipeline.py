import sys
import json
import subprocess
import time
import gurobipy as gp
from gurobipy import GRB
import os

DATA_FILE = "STAGE3_TEST_1.json" 
CANDIDATE_FILE = "gurobi_warehouse.csv" 
FEEDBACK_FILE = "gurobi_feedback.txt"  # 💡 직관적인 관리를 위해 변수명 선언

# 💡 터미널에서 시간을 입력받을 수 있게 열어둡니다! (입력 없으면 기본 150초)
if len(sys.argv) > 1:
    TOTAL_TIMELIMIT = int(sys.argv[1])
else:
    TOTAL_TIMELIMIT = 150

def get_timelist(timelimit):
    if timelimit >= 300:
        # 할당 총합 275초 (오버헤드 마진 25초 확보)
        # 데이터가 쌓여도 300초면 3라운드까지 무난히 소화 가능합니다.
        return [[140, 60], [30, 20], [15, 10]] 
    
    elif timelimit >= 150:   
        # 💡 [핵심 수정] 150초 컷: 오버헤드 폭탄을 피하기 위해 과감히 2라운드로 압축!
        # 할당 총합 130초 (오버헤드 마진 20초 확보)
        return [[75, 20], [20, 15]]
       
    elif timelimit >= 60:
        # 할당 총합 50초 (오버헤드 마진 10초 확보)
        return [[30, 10], [7, 3]]              
    else:
        # 할당 총합 25초 (극한의 상황, 1라운드 단판 승부)
        return [[18, 7]]                    

def run_iterative_pipeline():
    start_time = time.time()
    
    # 청소 로직
    if os.path.exists(CANDIDATE_FILE): os.remove(CANDIDATE_FILE)
    if os.path.exists(FEEDBACK_FILE): os.remove(FEEDBACK_FILE)
    if os.path.exists("start_alns.txt"): os.remove("start_alns.txt")
    if os.path.exists("alns_done.txt"): os.remove("alns_done.txt")
    print("🧹 [초기화] 이전 실행의 CSV 및 통신 파일들을 깨끗하게 청소했습니다!")
        
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    num_orders = len(data['ORDERS'])
    print(f"=== 🚀 DMS 벤치마킹 하이브리드 알고리즘 시작 ({DATA_FILE} / 총 제한시간: {TOTAL_TIMELIMIT}초) ===")
    
    timelist = get_timelist(TOTAL_TIMELIMIT)
    best_cost = float('inf')
    
    # 💡 [핵심] C++ 엔진을 백그라운드에 띄워두고 끄지 않습니다! (Popen 사용)
    cpp_process = subprocess.Popen(["main.exe", DATA_FILE])
    time.sleep(3) # C++이 최초 1회 JSON을 읽고 점수판을 만들 시간을 잠깐 줍니다.
    
    for i, (alns_time, sp_time) in enumerate(timelist):
        round_num = i + 1
        print(f"\n▶▶ [라운드 {round_num}/{len(timelist)}] (C++: {alns_time}초 ➔ Gurobi: {sp_time}초)")
        
        seed = round_num * 100 
        
        # 💡 통신 1: C++에게 일하라고 명령 파일 쓰기
        with open("start_alns.txt", "w") as f:
            f.write(f"{alns_time} {seed}\n")
            
        # 💡 통신 2: C++이 일을 다 끝내고 알림 파일을 만들 때까지 대기
        while not os.path.exists("alns_done.txt"):
            time.sleep(0.5)
            
        while True:
            try:
                os.remove("alns_done.txt")
                break  # 성공적으로 지웠으면 루프 탈출!
            except PermissionError:
                time.sleep(0.1)
        
        if not os.path.exists(CANDIDATE_FILE):
            print("🚨 C++ 엔진이 후보 경로 파일을 생성하지 못했습니다. 파이프라인을 중단합니다.")
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
        
        env_options = {
            "OutputFlag": 0, 
            "TimeLimit": sp_time,
            "MIPGap": 0.005 
        }
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
                            
                        selected_bundles = [bundles[j] for j in range(len(bundles)) if x[j].X > 0.5]
                        
                        with open(FEEDBACK_FILE, 'w', encoding='utf-8') as f:
                            f.write(f"{len(selected_bundles)}\n")
                            for rider_type, cost, order_ids in selected_bundles:
                                route_str = " ".join(map(str, order_ids))
                                f.write(f"{rider_type} {cost} 0 {len(order_ids)} {route_str}\n")
                                
                        print(f" └ 💾 Gurobi 최적해 {len(selected_bundles)}개를 다음 라운드(ALNS)로 전달합니다!")
                    else:
                        print(" └ ⚠️ 제한 시간 내에 유효한 조합을 찾지 못했습니다.")
                else:
                    print(" └ ⚠️ 최적화에 실패했습니다.")

        elapsed = time.time() - start_time
        print(f" └ 라운드 {round_num} 종료 (누적 소요 시간: {elapsed:.1f}초)")

    # 💡 모든 라운드 종료 후, 대기 중인 C++에게 영원한 휴식을 명합니다 (-1 전송)
    with open("start_alns.txt", "w") as f:
        f.write("-1 -1\n")
    cpp_process.wait() # C++이 안전하게 꺼질 때까지 대기

    print(f"\n=== 🏁 모든 하이브리드 최적화 종료! (최종 비용: {best_cost:,.0f}원) ===")      

if __name__ == "__main__":
    run_iterative_pipeline()