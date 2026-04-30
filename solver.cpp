#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>
#include <chrono>
#include <random>
#include <numeric>

using namespace std;

struct Rider {
    string type;
    double speed;
    int capa, var_cost, fixed_cost, available_number, service_time;
};

struct Order {
    int id, order_time;
    double shop_lat, shop_lon, dlv_lat, dlv_lon;
    int volume, ready_time, deadline, cook_time;
    bool assigned = false;
};

struct Route {
    string rider_type;
    vector<int> bundle; 
};

struct Solution {
    vector<Route> routes;
};

double get_T(const Rider& rider, double dist_val) {
    return round(dist_val / rider.speed + rider.service_time);
}

double calc_route_dist(const vector<int>& bundle, const vector<vector<double>>& dist, int num_orders) {
    if (bundle.empty()) return 0;
    double d = 0;
    for(int i = 0; i < bundle.size() - 1; i++) d += dist[bundle[i]][bundle[i+1]]; 
    d += dist[bundle.back()][bundle[0] + num_orders]; 
    for(int i = 0; i < bundle.size() - 1; i++) d += dist[bundle[i] + num_orders][bundle[i+1] + num_orders]; 
    return d;
}

// [핵심 추가] 이 경로가 전체적으로 얼마나 비싼지 평가하는 점수판!
// 배달원 1명 쓸 때마다 막대한 패널티(10000점)를 부여해서 무조건 사람 수를 줄이도록 압박함
double calc_solution_cost(const Solution& sol, const vector<vector<double>>& dist, int num_orders) {
    double cost = 0;
    for (const auto& r : sol.routes) {
        cost += 10000; // 배달원 고정비 패널티
        cost += calc_route_dist(r.bundle, dist, num_orders); // 이동 거리 패널티
    }
    return cost;
}

bool check_route(const vector<int>& bundle, const Rider& rider, const vector<Order>& orders, const vector<vector<double>>& dist, int num_orders) {
    if (bundle.empty()) return true;

    int total_vol = 0;
    for(int id : bundle) total_vol += orders[id].volume;
    if(total_vol > rider.capa) return false;

    double current_time = 0;
    int current_loc = bundle[0];

    current_time = orders[bundle[0]].ready_time + rider.service_time; 
    for (int i = 1; i < bundle.size(); i++) {
        int next_loc = bundle[i]; 
        current_time += get_T(rider, dist[current_loc][next_loc]);
        if (current_time < orders[bundle[i]].ready_time + rider.service_time) {
            current_time = orders[bundle[i]].ready_time + rider.service_time;
        }
        current_loc = next_loc;
    }

    for (int i = 0; i < bundle.size(); i++) {
        int next_loc = bundle[i] + num_orders; 
        current_time += get_T(rider, dist[current_loc][next_loc]);
        if (current_time > orders[bundle[i]].deadline) return false; 
        current_loc = next_loc;
    }
    return true; 
}

int main() {
    ifstream fin("input.txt");
    if (!fin) return 1;

    int num_riders; fin >> num_riders;
    vector<Rider> riders(num_riders);
    for (int i = 0; i < num_riders; i++) 
        fin >> riders[i].type >> riders[i].speed >> riders[i].capa >> riders[i].var_cost >> riders[i].fixed_cost >> riders[i].available_number >> riders[i].service_time;

    int num_orders; fin >> num_orders;
    vector<Order> orders(num_orders);
    for (int i = 0; i < num_orders; i++) 
        fin >> orders[i].id >> orders[i].order_time >> orders[i].shop_lat >> orders[i].shop_lon >> orders[i].dlv_lat >> orders[i].dlv_lon >> orders[i].volume >> orders[i].ready_time >> orders[i].deadline >> orders[i].cook_time;

    int n_nodes; fin >> n_nodes; 
    vector<vector<double>> dist(n_nodes, vector<double>(n_nodes));
    for(int i=0; i<n_nodes; i++) {
        for(int j=0; j<n_nodes; j++) fin >> dist[i][j];
    }
    fin.close();

    Solution best_solution;

    // 1. 초기 해 생성 (Greedy)
    for (auto& rider : riders) {
        while (rider.available_number > 0) {
            int first_idx = -1;
            for (int i = 0; i < num_orders; i++) {
                if (!orders[i].assigned) {
                    vector<int> test_bundle = {orders[i].id};
                    if (check_route(test_bundle, rider, orders, dist, num_orders)) {
                        first_idx = i; break;
                    }
                }
            }
            if (first_idx == -1) break; 

            vector<int> bundle;
            bundle.push_back(orders[first_idx].id);
            orders[first_idx].assigned = true;

            for (int k = 0; k < 4; k++) {
                int best_idx = -1;
                double min_dist = 1e18;

                for (int i = 0; i < num_orders; i++) {
                    if (!orders[i].assigned) {
                        vector<int> test_bundle = bundle;
                        test_bundle.push_back(orders[i].id);

                        if (check_route(test_bundle, rider, orders, dist, num_orders)) {
                            double d = dist[bundle.back()][orders[i].id]; 
                            if (d < min_dist) { min_dist = d; best_idx = i; }
                        }
                    }
                }

                if (best_idx != -1) {
                    orders[best_idx].assigned = true;
                    bundle.push_back(orders[best_idx].id);
                } else break; 
            }
            best_solution.routes.push_back({rider.type, bundle});
            rider.available_number--;
        }
    }

    // 2. 궁극의 ALNS + Simulated Annealing (담금질 기법)
    auto start_time = chrono::high_resolution_clock::now();
    mt19937 rng(42); 
    uniform_real_distribution<double> rnd_prob(0.0, 1.0); // 0~1 사이 확률 뽑기

    Solution current_solution = best_solution; // 현재 내가 들고 있는 해
    double best_cost = calc_solution_cost(best_solution, dist, num_orders);
    double current_cost = best_cost;

    // SA 온도 설정 (뜨거울 땐 막 수용하다가, 식으면 깐깐해짐)
    double T_start = 5000.0;
    double T_end = 1.0;

    while (true) {
        auto current_time_m = chrono::high_resolution_clock::now();
        double elapsed = chrono::duration<double>(current_time_m - start_time).count();
        if (elapsed > 28.5) break; 

        // 현재 시간에 따른 온도 계산
        double T = T_start * pow(T_end / T_start, elapsed / 28.5);

        Solution neighbor = current_solution;
        if (neighbor.routes.size() <= 1) break; 

        int rm_idx = -1;
        if (rng() % 100 < 30) {
            rm_idx = rng() % neighbor.routes.size();
        } else {
            int min_orders = 1e9;
            vector<int> worst_routes;
            for (int i = 0; i < neighbor.routes.size(); i++) {
                if (neighbor.routes[i].bundle.size() < min_orders) {
                    min_orders = neighbor.routes[i].bundle.size();
                    worst_routes.clear();
                    worst_routes.push_back(i);
                } else if (neighbor.routes[i].bundle.size() == min_orders) {
                    worst_routes.push_back(i);
                }
            }
            rm_idx = worst_routes[rng() % worst_routes.size()];
        }

        vector<int> orphaned_orders = neighbor.routes[rm_idx].bundle;
        neighbor.routes.erase(neighbor.routes.begin() + rm_idx);

        bool all_inserted = true;
        for (int order_id : orphaned_orders) {
            int best_r_idx = -1;
            int best_pos = -1;
            double min_extra_dist = 1e18; 

            for (int r_idx = 0; r_idx < neighbor.routes.size(); r_idx++) {
                Rider current_rider;
                for(const auto& r : riders) if(r.type == neighbor.routes[r_idx].rider_type) { current_rider = r; break; }

                int cur_vol = 0;
                for(int oid : neighbor.routes[r_idx].bundle) cur_vol += orders[oid].volume;
                if (cur_vol + orders[order_id].volume > current_rider.capa) continue;

                double original_dist = calc_route_dist(neighbor.routes[r_idx].bundle, dist, num_orders);

                for (int pos = 0; pos <= neighbor.routes[r_idx].bundle.size(); pos++) {
                    vector<int> test_bundle = neighbor.routes[r_idx].bundle;
                    test_bundle.insert(test_bundle.begin() + pos, order_id);

                    if (check_route(test_bundle, current_rider, orders, dist, num_orders)) {
                        double new_dist = calc_route_dist(test_bundle, dist, num_orders);
                        double extra_dist = new_dist - original_dist; 
                        
                        if (extra_dist < min_extra_dist) {
                            min_extra_dist = extra_dist;
                            best_r_idx = r_idx;
                            best_pos = pos;
                        }
                    }
                }
            }

            if (best_r_idx != -1) {
                neighbor.routes[best_r_idx].bundle.insert(neighbor.routes[best_r_idx].bundle.begin() + best_pos, order_id);
            } else {
                all_inserted = false; 
                break; 
            }
        }

        // --- [UPGRADE 3: 담금질 기법(SA) 수락 로직] ---
        if (all_inserted) {
            double neighbor_cost = calc_solution_cost(neighbor, dist, num_orders);
            double delta = neighbor_cost - current_cost; // 0보다 작으면 이득, 크면 손해

            // 이득이거나(delta < 0), 손해라도 확률적으로 수락(exp(-delta / T))
            if (delta < 0 || exp(-delta / T) > rnd_prob(rng)) {
                current_solution = neighbor; // 일단 현재 경로로 수용! (손해라도 일단 감)
                current_cost = neighbor_cost;

                // 근데 그중에 진짜 제일 좋았던 최고 기록은 따로 저장해 둠
                if (current_cost < best_cost) {
                    best_solution = current_solution;
                    best_cost = current_cost;
                }
            }
        }
    }

    // 3. 최고 기록(best_solution) 파일 쓰기
    ofstream fout("output.txt");
    for (const auto& route : best_solution.routes) {
        fout << route.rider_type << "\n";
        for (int i = 0; i < route.bundle.size(); i++) fout << route.bundle[i] << (i == route.bundle.size() - 1 ? "" : " "); fout << "\n";
        for (int i = 0; i < route.bundle.size(); i++) fout << route.bundle[i] << (i == route.bundle.size() - 1 ? "" : " "); fout << "\n";
    }
    fout.close();

    return 0;
}