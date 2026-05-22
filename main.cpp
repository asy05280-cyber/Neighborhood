#include <iostream>
#include <chrono> 
#include <windows.h>  
#include <vector>
#include <string>
#include <cstdlib>
#include <fstream>
#include <cstdio> // 💡 remove() 함수 사용을 위해 추가

#include "models.hpp"
#include "utils.hpp"
#include "phase1_promising.hpp"
#include "phase2_init.hpp"
#include "phase3_alns.hpp"
#include "phase4_rider.hpp"

using namespace std;
using namespace chrono;

int main(int argc, char* argv[]) {
    SetConsoleOutputCP(CP_UTF8);

    // =======================================================
    // 💡 1. 단 한 번만 실행되는 무거운 초기화 작업!
    // =======================================================
    string filepath = "STAGE3_TEST_1.json";
    try {
        load_problem_data(filepath); 
    } catch (const exception& e) {
        return 1;
    }

    cout << "⏳ 유망 점수판(Promising Matrix) 생성 중... (최초 1회만 실행됩니다)" << endl;
    build_promising_matrix(1.5); 
    cout << "✅ C++ 엔진 부팅 완료! 파이썬의 신호를 대기합니다...\n" << endl;


    // =======================================================
    // 💡 2. 파이썬과 통신하며 대기하는 상주(Daemon) 루프
    // =======================================================
    int round_count = 1;
    while (true) {
        // 파이썬이 'start_alns.txt' 신호탄을 쏠 때까지 대기
        ifstream sig_in("start_alns.txt");
        if (!sig_in.is_open()) {
            Sleep(200); // 0.2초 대기 후 다시 확인
            continue;
        }        

    
        double time_limit = -999;
        int seed = -999;
        sig_in >> time_limit >> seed;
        sig_in.close();

        // 💡 [수정] 파일이 아직 덜 써져서 값을 못 읽었을 때만 대기하도록 변경
        if (time_limit == -999 || seed == -999) {
            Sleep(100);
            continue;
        }

        

        // ✅ 이제 정상적으로 이 문턱을 통과하여 깔끔하게 퇴근(break)합니다!
        if (time_limit < 0) {
            cout << "🛑 파이썬의 종료 명령 수신. C++ 엔진을 완전히 종료합니다." << endl;
            break;
        }
        

        // 명령을 받았으니 신호 파일 삭제
        remove("start_alns.txt"); 

        // 파이썬이 -1을 보내면 모든 일정이 끝난 것이므로 퇴근!
        if (time_limit < 0) {
            cout << "🛑 파이썬의 종료 명령 수신. C++ 엔진을 완전히 종료합니다." << endl;
            break;
        }

        srand(seed); 
        auto start_time = high_resolution_clock::now();
        cout << "\n▶▶ [C++ 엔진 가동] 라운드 " << round_count << " 시작! (제한시간: " << time_limit << "초)" << endl;
        
        weight_destroy = {1.0, 1.0};
        weight_repair = {1.0, 1.0};

        // --- 여기서부터 기존의 Phase 2 ~ 탐색 로직 시작 ---
        Solution best_sol;
        
        if (load_best_solution(best_sol, "gurobi_feedback.txt")) {
            for (auto& b : best_sol.bundles) {
                b.total_volume = 0;
                for (int node : b.route) {
                    if (node < K) b.total_volume += order_list[node].volume;
                }
            }
            cout << "🔄 [Gurobi 역주입] 파이썬에서 최적 조합을 수신했습니다! (시작 비용: " 
                 << (int)best_sol.total_cost << "원)" << endl;
        } else {
            best_sol = generate_initial_solution();
            optimize_riders(best_sol); 
            best_sol.total_cost = 0;
            for(const auto& b : best_sol.bundles) {
                best_sol.total_cost += b.cost;
            }
            cout << "▶ 1차 초기 해 총비용: " << (int)best_sol.total_cost << "원\n" << endl;
        }

        Solution current_sol = best_sol; 
        vector<Bundle> gurobi_warehouse;
        for(const auto& b : current_sol.bundles) {
            gurobi_warehouse.push_back(b);
        }

        // 강제 지진
        if (current_sol.total_cost < 9000000) { 
            cout << "💥 [강제 지진 발생] 너무 완벽한 Gurobi 해에 변형을 가하여 틈새를 만듭니다!" << endl;
            int num_perturb = max(1, (int)(K * 0.10)); 
            vector<Order> removed = destroy_random(current_sol, num_perturb);
            repair_regret(current_sol, removed); 
            optimize_riders(current_sol);
            
            current_sol.total_cost = 0;
            for (const auto& b : current_sol.bundles) {
                current_sol.total_cost += b.cost;
            }
            for(const auto& b : current_sol.bundles) {
                gurobi_warehouse.push_back(b);
            }
        }

        int loop_count = 0;
        while (true) {
            if (loop_count % 100 == 0) {
                cout << "🌀 ALNS 탐색 [" << loop_count << "회] "
                     << "아바타: " << (int)current_sol.total_cost << "원 "
                     << "🏆 최고 기록: " << (int)best_sol.total_cost << "원       \r";
            }

            auto current_time = high_resolution_clock::now();
            duration<double> elapsed = current_time - start_time;
            if (elapsed.count() > time_limit) {
                cout << "\n\n⏰ 제한 시간 종료! C++ 탐색을 마칩니다." << endl;
                break;
            }

            Solution next_sol = run_alns_step(current_sol, best_sol.total_cost);
            optimize_riders(next_sol); 

            next_sol.total_cost = 0;
            for (const auto& b : next_sol.bundles) {
                next_sol.total_cost += b.cost;
            }

            if (next_sol.total_cost < current_sol.total_cost) {
                current_sol = next_sol; 

                // [창고 다이어트] 1% 확률로만 납품
                if (rand() % 100 < 15) {
                    for(const auto& b : current_sol.bundles) {
                        gurobi_warehouse.push_back(b);
                    }
                }

                if (current_sol.total_cost < best_sol.total_cost) {
                    best_sol = current_sol;
                }
            } else {
                double margin = current_sol.total_cost * 1.001; 
                if (next_sol.total_cost < margin) {
                    if (rand() % 100 < 5) {
                        current_sol = next_sol; 
                    }
                }
            }
            loop_count++;
        }

        cout << "=== 🏁 C++ 최적화 종료 ===" << endl;
        export_warehouse(gurobi_warehouse, "gurobi_warehouse.csv");

        // 💡 3. 파이썬에게 내 일이 다 끝났다고 신호탄(알림 파일) 쏘기
        ofstream sig_out("alns_done.txt");
        sig_out << "DONE";
        sig_out.close();

        round_count++;
    }

    return 0;
}