#include <iostream>
#include <chrono> 
#include <windows.h>  // 한글 깨짐 방지

#include "models.hpp"
#include "utils.hpp"
#include "phase1_promising.hpp"
#include "phase2_init.hpp"
#include "phase3_alns.hpp"
#include "phase4_rider.hpp"

using namespace std;
using namespace chrono;

int main(int argc, char* argv[]) { // 💡 파이썬이 던져주는 인자를 받도록 수정!
    
    SetConsoleOutputCP(CP_UTF8);
    auto start_time = high_resolution_clock::now();
    double time_limit = 9.5; 

    // 💡 파이썬에서 파일명을 넘겨줬다면 그걸 쓰고, 아니면 기본값 사용
    string filepath = "TEST_K50_1.json"; 
    if (argc > 1) {
        filepath = argv[1]; 
    }

    cout << "=== 🚀 DMS 벤치마킹 알고리즘 시작 (" << filepath << ") ===" << endl;

    try {
        load_problem_data(filepath); 
    } catch (const exception& e) {
        cout << "\n🚨 [비상] JSON 파일을 찾을 수 없거나 열 수 없습니다!" << endl;
        cout << "상세 에러: " << e.what() << endl;
        return 1; // 여기서 안전하게 종료
    }

    // 2. [데이터 준비] JSON 파일 로드
    

    // 3. [Phase 1] 유망 점수판 생성
    build_promising_matrix(1.5); 

    // 4. [Phase 2] 초기 해 생성
    Solution best_sol = generate_initial_solution();
    optimize_riders(best_sol); // 가성비 한번 챙겨주기
    
    // 📌 각 번들의 비용을 모두 더해서 총비용(total_cost) 정산하기!
    best_sol.total_cost = 0;
    for(const auto& b : best_sol.bundles) {
        best_sol.total_cost += b.cost;
    }
    cout << "▶ 1차 초기 해 총비용: " << best_sol.total_cost << "원\n" << endl;

    // 📦 [Phase 5 준비물] Gurobi에게 넘겨줄 거대한 번들 창고!
    vector<Bundle> gurobi_warehouse;
    for(const auto& b : best_sol.bundles) {
        gurobi_warehouse.push_back(b);
    }

    // 5. [Phase 3 & 4] 탐색 루프 무한 반복!
    Solution current_sol = best_sol; // ★ NEW: 마음껏 돌아다닐 탐색 아바타 생성!
    int loop_count = 0;

    while (true) {
        if (loop_count % 10000 == 0) {
            cout << "🌀 ALNS 탐색 중... [" << loop_count << "회 반복] 최고 가성비: " << best_sol.total_cost << "원   \r";
        }

        auto current_time = high_resolution_clock::now();
        duration<double> elapsed = current_time - start_time;
        if (elapsed.count() > time_limit) {
            cout << "\n\n⏰ 시간 초과 임박! 탐색 루프를 종료합니다." << endl;
            break;
        }

        // ★ 수정: best_sol이 아니라 current_sol을 넘겨서 이리저리 돌아다니게 함
        current_sol = run_alns_step(current_sol, best_sol.total_cost);
        optimize_riders(current_sol); 

        // 그러다 우연히 역대 최고 기록(best_sol)을 깼을 때만 정답지 갈아끼우고 창고에 저장!
        if (current_sol.total_cost < best_sol.total_cost) {
            best_sol = current_sol;
            
            for(const auto& b : best_sol.bundles) {
                gurobi_warehouse.push_back(b);
            }
        }
        loop_count++;
    }



    // 6. 결과 발표
    cout << "=== 🏁 C++ 최적화 종료 ===" << endl;
    cout << "▶ 총 반복 횟수: " << loop_count << "회" << endl;
    cout << "▶ 최종 C++ 단독 비용: " << best_sol.total_cost << "원" << endl;

    // 7. [Phase 5 연동] 창고에 쌓인 번들들을 CSV로 대방출!
    export_warehouse(gurobi_warehouse, "gurobi_warehouse.csv");

    return 0;
}