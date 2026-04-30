from util import *


def algorithm(K, all_orders, all_riders, dist_mat, timelimit=60):

    start_time = time.time()

    for r in all_riders:
        r.T = np.round(dist_mat/r.speed + r.service_time)



    #------------- Custom algorithm code starts from here --------------#
    

    import os
    import subprocess

    # 1. C++이 읽기 쉽도록 진짜 변수명 + DIST 행렬로 input.txt 생성
    with open('input.txt', 'w') as f:
        # 배달원 정보
        f.write(f"{len(all_riders)}\n")
        for r in all_riders:
            f.write(f"{r.type} {r.speed} {r.capa} {r.var_cost} {r.fixed_cost} {r.available_number} {r.service_time}\n")
            
        # 주문 정보
        f.write(f"{len(all_orders)}\n")
        for o in all_orders:
            f.write(f"{o.id} {o.order_time} {o.shop_lat} {o.shop_lon} {o.dlv_lat} {o.dlv_lon} {o.volume} {o.ready_time} {o.deadline} {o.cook_time}\n")

        # [핵심 추가] DIST 행렬 크기와 데이터 쓰기
        f.write(f"{len(dist_mat)}\n") # 행렬 크기 (100)
        for row in dist_mat:
            f.write(" ".join(map(str, row)) + "\n")

    # 2. C++ 최적화 엔진(solver.exe) 호출
    try:
        if os.name == 'nt':
            subprocess.run(['solver.exe'], check=True)
        else:
            subprocess.run(['./solver.exe'], check=True)
    except Exception as e:
        print(f"C++ 실행 중 에러 발생: {e}")

    # 3. 결과 읽어오기
    solution = []
    if os.path.exists('output.txt'):
        with open('output.txt', 'r') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
            for i in range(0, len(lines), 3):
                if i + 2 < len(lines):
                    r_type = lines[i]
                    s_seq = list(map(int, lines[i+1].split()))
                    d_seq = list(map(int, lines[i+2].split()))
                    solution.append([r_type, s_seq, d_seq])

    return solution
    
   
                
           


    #------------- End of custom algorithm code--------------#



    return solution
    