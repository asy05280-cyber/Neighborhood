#include <iostream>
#include <chrono> 
#include <windows.h>  
#include <vector>
#include <string>
#include <cstdlib>

#include "models.hpp"
#include "utils.hpp"
#include "phase1_promising.hpp"
#include "phase2_init.hpp"
#include "phase3_alns.hpp"
#include "phase4_rider.hpp"

using namespace std;
using namespace chrono;

int main(int argc, char* argv[]) {
    // SetConsoleOutputCP(CP_UTF8); //
    auto start_time = high_resolution_clock::now();
    double time_limit = 60.0;
    int seed = 42;

    if (argc >= 3) {
        time_limit = std::atof(argv[1]);
        seed = std::atoi(argv[2]);
    }
    
    srand(seed); 
    string filepath = "TEST_K200_1.json";

    try {
        load_problem_data(filepath); 
    } catch (const exception& e) {
        cerr << "❌ 에러: " << e.what() << endl;
        return 1;
    }

    build_promising_matrix(1.5); 

    // 💡 [롤백] 역주입 제거! 매 라운드 백지(초기해)에서 출발하여 다양한 길을 탐색합니다.
    Solution best_sol = generate_initial_solution();
    optimize_riders(best_sol); 
    best_sol.total_cost = 0;
    for(const auto& b : best_sol.bundles) {
        best_sol.total_cost += b.cost;
    }
    cout << "▶ 1차 초기 해 총비용: " << (int)best_sol.total_cost << "원\n" << endl;

    vector<Bundle> gurobi_warehouse;
    for(const auto& b : best_sol.bundles) {
        gurobi_warehouse.push_back(b);
    }

    Solution current_sol = best_sol; 
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

            // 💡 [롤백] 기록을 깰 때마다(내려가는 길목마다) 창고에 팍팍 납품합니다!
            if (current_sol.total_cost < best_sol.total_cost) {
                best_sol = current_sol;
                for(const auto& b : best_sol.bundles) {
                    gurobi_warehouse.push_back(b);
                }
            }
        } else {
            // 💡 [롤백] 엄격한 문지기 (0.1% 마진, 5% 확률)로 산으로 가는 것을 막습니다!
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

    return 0;
}
