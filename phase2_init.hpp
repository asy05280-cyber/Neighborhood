#ifndef PHASE2_INIT_HPP
#define PHASE2_INIT_HPP

#include <iostream>
#include <vector>
#include <cmath>
#include "models.hpp"
#include "utils.hpp"
#include "phase1_promising.hpp"

using namespace std;

// 1. [핵심 엔진] 시간 시뮬레이션 및 페널티 영수증 발급!
bool simulate_route_time(const vector<int>& proposed_route, const Rider_Info& rider, double& out_penalty) {
    double current_time = 0.0;
    double first_pickup_time = 0.0;
    double penalty = 0.0;
    
    // 🚧 [현실 반영 제약 조건 설정]
    double PENALTY_PER_MIN = 500.0;    // 지각 1분당 500원 벌금 (Soft Constraint)
    double MAX_DURATION = 90.0 * 60.0; // 배달원 최대 주행 시간: 1시간 30분 (Hard Constraint)

    for (int i = 0; i < proposed_route.size(); i++) {
        int curr_node = proposed_route[i];

        if (i == 0) {
            current_time = order_list[curr_node].readytime;
            first_pickup_time = current_time;
        } else {
            int prev_node = proposed_route[i - 1];
            current_time += round(dist_matrix[prev_node][curr_node] / rider.speed);

            if (curr_node < K) { // 픽업지
                current_time = max(current_time, (double)order_list[curr_node].readytime);
            } else { // 배달지 도착
                int order_idx = curr_node - K;
                double arrival_time = current_time + rider.service_time;

                // 🚨 [조건 1] Soft Time Window: 지각하면 탈락이 아니라 벌금 부과!
                if (arrival_time > order_list[order_idx].deadline) {
                    double tardiness_min = ceil((arrival_time - order_list[order_idx].deadline) / 60.0);
                    penalty += tardiness_min * PENALTY_PER_MIN;
                }
                current_time = arrival_time;
            }
        }
    }

    // 🚨 [조건 2] Max Route Duration: 첫 픽업부터 마지막 배달까지 90분 넘으면 가차 없이 탈락!
    if (current_time - first_pickup_time > MAX_DURATION) {
        return false; 
    }

    out_penalty = penalty; // 계산된 벌금을 영수증(out_penalty)에 적어줍니다.
    return true; // 90분은 안 넘었으니 합격!
}

// 2. 💰 [NEW 통합 회계사] 운송비 + 벌금을 한 번에 계산하는 함수
double calculate_final_cost(const vector<int>& route, const Rider_Info& rider) {
    if (route.empty()) return 0.0;

    // 1) 순수 이동 거리 기반 요금 계산
    double dist_sum = 0;
    for (size_t i = 0; i < route.size() - 1; i++) {
        dist_sum += dist_matrix[route[i]][route[i+1]];
    }
    double base_cost = rider.fixed_cost + (dist_sum / 100.0) * rider.var_cost;

    // 2) 시뮬레이션 돌려서 지각 벌금 영수증 떼오기
    double penalty = 0.0;
    simulate_route_time(route, rider, penalty);

    // 총비용 = 배달원 일당 + 지각 페널티
    return base_cost + penalty; 
}

// 3. 탑승 심사 (용량 & 90분 제한 검사)
bool check_feasibility(const Bundle& bundle, const Order& new_order, const Rider_Info& rider) {
    if (bundle.total_volume + new_order.volume > rider.capacity) return false;

    vector<int> proposed_route;
    vector<int> pickups, deliveries;
    for (int node : bundle.route) {
        if (node < K) pickups.push_back(node);
        else deliveries.push_back(node);
    }
    pickups.push_back(new_order.id);
    deliveries.push_back(new_order.id + K);

    proposed_route.insert(proposed_route.end(), pickups.begin(), pickups.end());
    proposed_route.insert(proposed_route.end(), deliveries.begin(), deliveries.end());

    double dummy_penalty = 0.0; 
    return simulate_route_time(proposed_route, rider, dummy_penalty);
}

// 4. 초기 해 생성
Solution generate_initial_solution() {
    Solution sol;
    vector<bool> is_assigned(K, false); 
    int assigned_count = 0;

    int walk_left = rider_list[0].availability; 
    int bike_left = rider_list[1].availability; 

    while (assigned_count < K) {
        Bundle current_bundle;
        Rider_Info current_rider;
        if (walk_left > 0) { current_rider = rider_list[0]; walk_left--; }
        else if (bike_left > 0) { current_rider = rider_list[1]; bike_left--; }
        else { current_rider = rider_list[2]; } 

        current_bundle.rider_type = current_rider.type;

        int curr_order_id = -1;
        for (int i = 0; i < K; i++) {
            if (!is_assigned[i]) { curr_order_id = i; break; }
        }

        current_bundle.route.push_back(curr_order_id);       
        current_bundle.route.push_back(curr_order_id + K);   
        current_bundle.total_volume = order_list[curr_order_id].volume;
        is_assigned[curr_order_id] = true;
        assigned_count++;

        while (true) {
            int best_friend = -1;
            double best_score = 1e9; 
            for (int j = 0; j < K; j++) {
                if (!is_assigned[j]) {
                    if (promising_matrix[curr_order_id][j] < best_score) {
                        best_score = promising_matrix[curr_order_id][j];
                        best_friend = j;
                    }
                }
            }

            if (best_friend == -1) break;

            if (check_feasibility(current_bundle, order_list[best_friend], current_rider)) {
                vector<int> new_route;
                for (int node : current_bundle.route) if (node < K) new_route.push_back(node);
                new_route.push_back(best_friend);
                for (int node : current_bundle.route) if (node >= K) new_route.push_back(node);
                new_route.push_back(best_friend + K);
                
                current_bundle.route = new_route;
                current_bundle.total_volume += order_list[best_friend].volume;
                is_assigned[best_friend] = true;
                assigned_count++;
            } else {
                break; 
            }
        }

        // 💡 [수정] 복잡한 비용 계산식을 지우고 통합 회계사 호출!
        current_bundle.cost = calculate_final_cost(current_bundle.route, current_rider);
        sol.bundles.push_back(current_bundle);
    }
    return sol;
}

#endif