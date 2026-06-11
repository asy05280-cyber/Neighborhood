#ifndef MODELS_HPP
#define MODELS_HPP

#include <iostream>
#include <vector>
#include <string>

using namespace std;

// 1. Order (주문 정보)
struct Order {
    int id;             // 주문 번호 (0 ~ K-1) [cite: 21]
    int readytime;      // 픽업 가능 시각 (주문발생시각 + 주문 준비 시간) [cite: 23]
    int volume;         // 음식 부피 [cite: 25]
    int deadline;       // 배달한계시각 [cite: 26]
};

// 2. Rider_Info (배달원 스펙)
struct Rider_Info {
    string type;        // "WALK", "BIKE", "CAR" [cite: 31]
    double speed;       // 속도 (거리 계산 후 시간으로 나눌 때 사용) [cite: 32]
    int capacity;       // 최대 적재 용량 [cite: 33]
    int var_cost;       // 100m당 변동비 [cite: 34]
    int fixed_cost;     // 고정비 [cite: 35]
    int service_time;   // 접근 시간 (초) [cite: 36]
    int availability;   // 가용 수 (차량 무한 리필 체크용) [cite: 37]
};

// 3. Bundle (배달원 1명의 스케줄)
struct Bundle {
    string rider_type;  // 현재 배정된 배달원 타입 [cite: 46]
    vector<int> route;  // 방문 순서 리스트 (0~2K-1 노드 번호) [cite: 47]
    double cost;        // 총비용 (고정비 + 변동비) [cite: 48]
    int total_volume;   // 현재 가방에 담긴 총부피 [cite: 49]
};

// 4. Solution (전체 배달 시간표)
struct Solution {
    vector<Bundle> bundles; // 만들어진 Bundle들의 리스트 [cite: 53]
    double total_cost;      // 모든 Bundle의 cost를 합친 목적 함수 값 [cite: 54]
};

#endif