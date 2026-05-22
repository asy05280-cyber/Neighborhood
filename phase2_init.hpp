#ifndef PHASE2_INIT_HPP
#define PHASE2_INIT_HPP

#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>
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

// 4. [NEW] 초기 해 생성 (데드라인 정렬 + Best Insertion)
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

        // 1. 시드 찾기: 마감 시간이 가장 급한 주문부터 배차 시작!
        int curr_order_id = -1;
        int min_deadline = 1e9;
        for (int i = 0; i < K; i++) {
            if (!is_assigned[i] && order_list[i].deadline < min_deadline) {
                min_deadline = order_list[i].deadline;
                curr_order_id = i;
            }
        }

        current_bundle.route = {curr_order_id, curr_order_id + K};
        current_bundle.total_volume = order_list[curr_order_id].volume;
        is_assigned[curr_order_id] = true;
        assigned_count++;

        int last_added = curr_order_id; // 현재 라이더의 마지막 위치

        // 2. 현재 위치(last_added)에서 가장 유망한(가까운) 친구들을 줄 세워서 끼워넣기
        while (true) {
            struct FriendScore { int id; double score; };
            vector<FriendScore> friends;
            for (int j = 0; j < K; j++) {
                if (!is_assigned[j]) {
                    friends.push_back({j, promising_matrix[last_added][j]});
                }
            }
            
            // 점수가 낮은(궁합이 좋은/가까운) 순서대로 정렬
            sort(friends.begin(), friends.end(), [](const FriendScore& a, const FriendScore& b) {
                return a.score < b.score;
            });

            bool friend_added = false;

            // 가까운 동네 친구부터 차례대로 찔러보기
            for (const auto& f : friends) {
                int candidate = f.id;
                
                // 용량 검사 (초과하면 아예 찔러보지도 않음)
                if (current_bundle.total_volume + order_list[candidate].volume > current_rider.capacity) continue;

                vector<int> pickups, deliveries;
                for (int n : current_bundle.route) {
                    if (n < K) pickups.push_back(n);
                    else deliveries.push_back(n);
                }

                vector<int> best_route;
                double min_cost_increase = 1e9;
                bool found_insertion = false;

                // Best Insertion: 픽업/배달 조합 다 찔러보기
                for (int p = 0; p <= pickups.size(); p++) {
                    for (int d = 0; d <= deliveries.size(); d++) {
                        vector<int> temp_route;
                        for (int i = 0; i < p; ++i) temp_route.push_back(pickups[i]);
                        temp_route.push_back(candidate);
                        for (int i = p; i < pickups.size(); ++i) temp_route.push_back(pickups[i]);

                        for (int i = 0; i < d; ++i) temp_route.push_back(deliveries[i]);
                        temp_route.push_back(candidate + K);
                        for (int i = d; i < deliveries.size(); ++i) temp_route.push_back(deliveries[i]);

                        double dummy_penalty = 0.0;
                        // 90분 제한 무사 통과 시 비용 계산
                        if (simulate_route_time(temp_route, current_rider, dummy_penalty)) {
                            double new_cost = calculate_final_cost(temp_route, current_rider);
                            if (new_cost < min_cost_increase) {
                                min_cost_increase = new_cost;
                                best_route = temp_route;
                                found_insertion = true;
                            }
                        }
                    }
                }

                // 성공적으로 끼워 넣었다면!
                if (found_insertion) {
                    current_bundle.route = best_route;
                    current_bundle.total_volume += order_list[candidate].volume;
                    is_assigned[candidate] = true;
                    assigned_count++;
                    last_added = candidate; // 기준점 갱신 (꼬리물기)
                    friend_added = true;
                    break; // 한 명 탔으니 루프 빠져나가서 새 기준점으로 다시 가장 가까운 친구 찾기
                }
            }

            if (!friend_added) {
                // 아무리 찔러봐도 동네 친구 중에 탈 수 있는 애가 없다면, 이 라이더는 출발!
                break; 
            }
        }

        // 출발하는 라이더 최종 운임 정산
        current_bundle.cost = calculate_final_cost(current_bundle.route, current_rider);
        sol.bundles.push_back(current_bundle);
    }

    sol.total_cost = 0;
    for (const auto& b : sol.bundles) sol.total_cost += b.cost;
    return sol;
}

#endif