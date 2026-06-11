#ifndef PHASE4_RIDER_HPP
#define PHASE4_RIDER_HPP

#include <iostream>
#include <vector>
#include <string>
#include "models.hpp"
#include "utils.hpp"
#include "phase2_init.hpp" 

using namespace std;

// 💡 [수정] 통합 회계사를 불러와서 비용과 페널티를 재정산!
void update_bundle_cost(Bundle& bundle, const Rider_Info& rider) {
    bundle.cost = calculate_final_cost(bundle.route, rider);
}

void optimize_riders(Solution& current_sol) {
    for (Bundle& bundle : current_sol.bundles) {
        if (bundle.rider_type == rider_list[0].type) continue; 
        
        for (const Rider_Info& cheaper_rider : rider_list) {
            if (cheaper_rider.type == bundle.rider_type) break; 
            if (bundle.total_volume > cheaper_rider.capacity) continue;

            double dummy_penalty = 0.0;
            // 90분 제한(simulate_route_time)을 통과하는지 검사
            if (simulate_route_time(bundle.route, cheaper_rider, dummy_penalty)) {
                bundle.rider_type = cheaper_rider.type;
                update_bundle_cost(bundle, cheaper_rider);
                break; 
            }
        }
    }
}
#endif