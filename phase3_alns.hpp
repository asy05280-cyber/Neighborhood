#ifndef PHASE3_ALNS_HPP
#define PHASE3_ALNS_HPP

#include <iostream>
#include <vector>
#include <random>
#include <cstdlib> 
#include <algorithm>
#include "models.hpp"
#include "utils.hpp"
#include "phase1_promising.hpp"
#include "phase2_init.hpp" 

using namespace std;

// =================================================================
// 📊 [ALNS 인공지능 매니저] 가중치 및 설정값
// =================================================================
vector<double> weight_destroy = {1.0, 1.0}; // [0: 집중폭격, 1: 무작위]
vector<double> weight_repair = {1.0, 1.0};  // [0: 후회값(Regret), 1: 그리디(Greedy)]
double decay_rate = 0.2; // 최신 성과를 얼마나 반영할 것인가 (rho)

// 룰렛 휠 선택 함수 (가중치에 비례해서 무기 뽑기)
int select_operator(const vector<double>& weights) {
    double sum = 0;
    for(double w : weights) sum += w;
    
    // 0 ~ sum 사이의 랜덤 실수 뽑기
    double rand_val = (rand() / (double)RAND_MAX) * sum;
    
    double cumulative = 0;
    for(int i = 0; i < weights.size(); i++) {
        cumulative += weights[i];
        if(rand_val <= cumulative) return i;
    }
    return weights.size() - 1;
}

// 부피 재계산 안전장치 (어제 만든 철통 보안 로직!)
void recalculate_bundle_volume(Bundle& bundle) {
    bundle.total_volume = 0;
    for (int node : bundle.route) {
        if (node < K) bundle.total_volume += order_list[node].volume;
    }
}

// =================================================================
// 💣 파괴 도구 모음 (Destroy Operators)
// =================================================================

// [파괴 0] 집중 폭격 
vector<Order> destroy_neighborhood(Solution& current_sol, int num_to_remove) {
    vector<Order> removed_orders;
    if (current_sol.bundles.empty()) return removed_orders;

    int b_idx = rand() % current_sol.bundles.size();
    if (current_sol.bundles[b_idx].route.empty()) return removed_orders;
    
    int seed_node = -1;
    for(int n : current_sol.bundles[b_idx].route) {
        if(n < K) { seed_node = n; break; }
    }
    if(seed_node == -1) return removed_orders;

    struct NodeDist { int id; double dist; };
    vector<NodeDist> candidates;
    
    for(auto& b : current_sol.bundles) {
        for(int n : b.route) {
            if(n < K) candidates.push_back(NodeDist{n, (double)dist_matrix[seed_node][n]});
        }
    }

    sort(candidates.begin(), candidates.end(), [](const NodeDist& a, const NodeDist& b) { return a.dist < b.dist; });

    for (int i = 0; i < min(num_to_remove, (int)candidates.size()); i++) {
        int target_id = candidates[i].id;
        removed_orders.push_back(order_list[target_id]);

        for(int b = 0; b < current_sol.bundles.size(); b++) {
            auto& route = current_sol.bundles[b].route;
            auto it = find(route.begin(), route.end(), target_id);
            if(it != route.end()) {
                route.erase(remove(route.begin(), route.end(), target_id), route.end());
                route.erase(remove(route.begin(), route.end(), target_id + K), route.end());
                recalculate_bundle_volume(current_sol.bundles[b]);
                break; 
            }
        }
    }

    vector<Bundle> new_bundles;
    for(auto& b : current_sol.bundles) {
        if (!b.route.empty()) {
            Rider_Info r_info;
            for(auto& r : rider_list) if(r.type == b.rider_type) r_info = r;
            b.cost = calculate_final_cost(b.route, r_info);
            new_bundles.push_back(b);
        }
    }
    current_sol.bundles = new_bundles;
    return removed_orders;
}

// [파괴 1] 무작위 파괴 (예측 불가능성을 주어 우물 안 개구리 탈출)
vector<Order> destroy_random(Solution& current_sol, int num_to_remove) {
    vector<Order> removed_orders;
    vector<int> all_assigned;
    
    // 배정된 모든 주문 번호 수집
    for(auto& b : current_sol.bundles) {
        for(int n : b.route) if(n < K) all_assigned.push_back(n);
    }
    
    // 랜덤하게 섞기
    static std::mt19937 g(rand()); 
    std::shuffle(all_assigned.begin(), all_assigned.end(), g);

    // 앞에서부터 지정된 개수만큼 뽑아서 파괴
    for(int i = 0; i < min(num_to_remove, (int)all_assigned.size()); i++) {
        int target_id = all_assigned[i];
        removed_orders.push_back(order_list[target_id]);

        for(int b = 0; b < current_sol.bundles.size(); b++) {
            auto& route = current_sol.bundles[b].route;
            auto it = find(route.begin(), route.end(), target_id);
            if(it != route.end()) {
                route.erase(remove(route.begin(), route.end(), target_id), route.end());
                route.erase(remove(route.begin(), route.end(), target_id + K), route.end());
                recalculate_bundle_volume(current_sol.bundles[b]);
                break; 
            }
        }
    }

    // 빈 번들 청소 & 재계산
    vector<Bundle> new_bundles;
    for(auto& b : current_sol.bundles) {
        if (!b.route.empty()) {
            Rider_Info r_info;
            for(auto& r : rider_list) if(r.type == b.rider_type) r_info = r;
            b.cost = calculate_final_cost(b.route, r_info);
            new_bundles.push_back(b);
        }
    }
    current_sol.bundles = new_bundles;
    return removed_orders;
}

// =================================================================
// 🛠️ 수리 도구 모음 (Repair Operators)
// =================================================================

// [수리 0] 후회값 삽입 (Regret Insertion)
void repair_regret(Solution& current_sol, vector<Order>& removed_orders) {
    while (!removed_orders.empty()) {
        int best_o_idx = -1, target_b_idx = -1;
        double max_regret = -1.0; 
        
        for (int i = 0; i < removed_orders.size(); i++) {
            Order& tgt = removed_orders[i];
            double best_score = 1e9, second_best_score = 1e9;
            int current_best_b_idx = -1;
            
            for (int b = 0; b < current_sol.bundles.size(); b++) {
                for (int node : current_sol.bundles[b].route) {
                    if (node < K) { 
                        double score = promising_matrix[tgt.id][node];
                        if (score < best_score) {
                            second_best_score = best_score; 
                            best_score = score;             
                            current_best_b_idx = b;
                        } else if (score < second_best_score) {
                            second_best_score = score;      
                        }
                    }
                }
            }
            
            double regret = second_best_score - best_score;
            if (regret > max_regret) {
                max_regret = regret;
                best_o_idx = i;
                target_b_idx = current_best_b_idx;
            }
        }
        
        Order sel_order = removed_orders[best_o_idx];
        bool inserted = false;
        
        if (target_b_idx != -1) {
            Bundle& c_bundle = current_sol.bundles[target_b_idx];
            Rider_Info r_info;
            for(auto& r : rider_list) if(r.type == c_bundle.rider_type) r_info = r;
            
            if (check_feasibility(c_bundle, sel_order, r_info)) {
                vector<int> new_route;
                for (int n : c_bundle.route) if (n < K) new_route.push_back(n);
                new_route.push_back(sel_order.id);
                for (int n : c_bundle.route) if (n >= K) new_route.push_back(n);
                new_route.push_back(sel_order.id + K);
                
                c_bundle.route = new_route;
                recalculate_bundle_volume(c_bundle);

                c_bundle.cost = calculate_final_cost(c_bundle.route, r_info);
                inserted = true;
            }
        }
        
        if (!inserted) {
            Bundle new_car;
            new_car.rider_type = "CAR";
            new_car.route = {sel_order.id, sel_order.id + K}; 
            new_car.total_volume = sel_order.volume;
            Rider_Info r_info;
            for(auto& r : rider_list) if(r.type == "CAR") r_info = r;
            new_car.cost = r_info.fixed_cost + (dist_matrix[sel_order.id][sel_order.id + K] / 100.0) * r_info.var_cost;
            current_sol.bundles.push_back(new_car);
        }
        removed_orders.erase(removed_orders.begin() + best_o_idx);
    }
}

// [수리 1] 그리디 삽입 (눈앞의 이익만 쫓아서 아주 빠르게 채워 넣기)
void repair_greedy(Solution& current_sol, vector<Order>& removed_orders) {
    while (!removed_orders.empty()) {
        Order sel_order = removed_orders.back(); // 그냥 맨 뒤에 있는 애 하나 뽑기
        removed_orders.pop_back();

        int target_b_idx = -1;
        double best_score = 1e9;
        
        // 이 주문을 넣었을 때 가장 단짝(점수가 낮은)이 있는 번들 찾기
        for (int b = 0; b < current_sol.bundles.size(); b++) {
            for (int node : current_sol.bundles[b].route) {
                if (node < K) { 
                    double score = promising_matrix[sel_order.id][node];
                    if (score < best_score) {
                        best_score = score;             
                        target_b_idx = b;
                    }
                }
            }
        }
        
        bool inserted = false;
        if (target_b_idx != -1) {
            Bundle& c_bundle = current_sol.bundles[target_b_idx];
            Rider_Info r_info;
            for(auto& r : rider_list) if(r.type == c_bundle.rider_type) r_info = r;
            
            if (check_feasibility(c_bundle, sel_order, r_info)) {
                vector<int> new_route;
                for (int n : c_bundle.route) if (n < K) new_route.push_back(n);
                new_route.push_back(sel_order.id);
                for (int n : c_bundle.route) if (n >= K) new_route.push_back(n);
                new_route.push_back(sel_order.id + K);
                
                c_bundle.route = new_route;
                recalculate_bundle_volume(c_bundle);

                c_bundle.cost = calculate_final_cost(c_bundle.route, r_info);
                inserted = true;
            }
        }
        
        if (!inserted) {
            Bundle new_car;
            new_car.rider_type = "CAR";
            new_car.route = {sel_order.id, sel_order.id + K}; 
            new_car.total_volume = sel_order.volume;
            Rider_Info r_info;
            for(auto& r : rider_list) if(r.type == "CAR") r_info = r;
            new_car.cost = r_info.fixed_cost + (dist_matrix[sel_order.id][sel_order.id + K] / 100.0) * r_info.var_cost;
            current_sol.bundles.push_back(new_car);
        }
    }
}

// =================================================================
// 🏁 메인 ALNS 루프 (지휘 통제실 + 담금질 기법 SA 장착!)
// =================================================================
double current_temperature = 5000.0; // 초기 온도 (초반 대범함 수치)
double cooling_rate = 0.9999;        // 냉각율 (루프마다 0.9999배씩 식음)

// 함수 서명이 바뀌었습니다! (현재 위치와 역대 최고 기록을 동시에 받음)
Solution run_alns_step(Solution current_sol, double best_cost) {
    int num_to_remove = max(1, (int)(K * 0.01)); 
    
    // 1. 인공지능 매니저가 오늘의 무기를 선택!
    int d_idx = select_operator(weight_destroy);
    int r_idx = select_operator(weight_repair);
    
    Solution new_sol = current_sol;
    
    // 2. 파괴 및 수리 작전 실행!
    vector<Order> removed;
    if (d_idx == 0) removed = destroy_neighborhood(new_sol, num_to_remove);
    else            removed = destroy_random(new_sol, num_to_remove);
    
    if (r_idx == 0) repair_regret(new_sol, removed);
    else            repair_greedy(new_sol, removed);
    
    double new_total = 0;
    for(auto& b : new_sol.bundles) new_total += b.cost;
    new_sol.total_cost = new_total;
    
    // 3. 🧠 SA (Simulated Annealing) 수용 여부 결정
    double diff = new_sol.total_cost - current_sol.total_cost;
    double score = 0.0;

    if (diff < 0) {
        if (new_sol.total_cost < best_cost) score = 5.0; // 신기록
        else score = 3.0; // 개선됨
    } else {
        score = 1.0; // 나빠졌지만 시도는 좋았음
    }
    
    // 가중치 학습 (Adaptive)
    weight_destroy[d_idx] = (1 - decay_rate) * weight_destroy[d_idx] + decay_rate * score;
    weight_repair[r_idx]  = (1 - decay_rate) * weight_repair[r_idx]  + decay_rate * score;
    
    // 무조건 밖으로 새 솔루션을 던집니다!! (수락 여부는 main.cpp가 결정)
    return new_sol;
          
} 
  

#endif