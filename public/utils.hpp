#ifndef UTILS_HPP
#define UTILS_HPP

#include <iostream>
#include <vector>
#include <string>
#include <fstream>    // 파일을 읽기 위한 라이브러리
#include "models.hpp" // 데이터 그릇
#include "json.hpp"   // 방금 다운받은 마법의 JSON 라이브러리!

using namespace std;
using json = nlohmann::json; // 이름이 기니까 줄여서 씁니다

// 전역 변수들
int K; 
vector<Rider_Info> rider_list;
vector<Order> order_list;
vector<vector<int>> dist_matrix;

// 1. 데이터 로드 함수 (JSON 파싱)
void load_problem_data(string filepath) {
    cout << "데이터 로딩 시작: " << filepath << endl;

    // 파일 열기
    ifstream file(filepath);
    if (!file.is_open()) {
        cerr << "🚨 에러: 파일을 찾을 수 없거나 열 수 없습니다! (" << filepath << ")" << endl;
        exit(1); // 파일 없으면 프로그램 강제 종료
    }

    // JSON 데이터 파싱
    json j;
    file >> j;

    // 1-1. K 값 파싱
    K = j["K"];
    
    // 1-2. 배달원 정보 (RIDERS) 파싱
    // ["BIKE", 5.291, 100, 60, 5000, 120, 10]
    for (const auto& r : j["RIDERS"]) {
        Rider_Info rider;
        rider.type = r[0];            // 종류
        rider.speed = r[1];           // 속도
        rider.capacity = r[2];        // 용량
        rider.var_cost = r[3];        // 변동비
        rider.fixed_cost = r[4];      // 고정비
        rider.service_time = r[5];    // 접근 시간
        rider.availability = r[6];    // 가용 수
        rider_list.push_back(rider);
    }

    // 1-3. 주문 정보 (ORDERS) 파싱 및 다이어트
    // [0, 7, 37.49.., 127.03.., 37.50.., 127.03.., 900, 40, 2610]
    for (const auto& o : j["ORDERS"]) {
        Order order;
        order.id = o[0]; 
        
        // ★ 핵심 포인트: readytime = 주문발생시각(인덱스 1) + 조리시간(인덱스 6)
        int order_time = o[1];
        int prep_time = o[6];
        order.readytime = order_time + prep_time;
        
        order.volume = o[7];   // 부피
        order.deadline = o[8]; // 데드라인
        
        order_list.push_back(order);
    }

    // 1-4. 거리 행렬 (DIST) 파싱
    // json 라이브러리의 get 기능을 쓰면 2차원 배열을 한 번에 C++ vector로 변환해줍니다!
    dist_matrix = j["DIST"].get<vector<vector<int>>>();

    cout << "✅ 데이터 로딩 완료! (주문 수: " << K << "개, 배달원 종류: " << rider_list.size() << "개)" << endl;
}

// 2. 편의성 도구: 거리 계산기
int get_distance(int from_node, int to_node) {
    return dist_matrix[from_node][to_node];
}


// Gurobi 창고(수많은 번들들)를 CSV로 예쁘게 포장하는 함수
void export_warehouse(const vector<Bundle>& warehouse, string filename = "gurobi_warehouse.csv") {
    ofstream file(filename);
    
    // 엑셀에서 한글 안 깨지게 하는 마법의 코드 (BOM)
    file << "\xEF\xBB\xBF"; 
    
    // CSV 헤더 (첫 줄)
    file << "bundle_id,rider_type,cost,orders\n";
    
    for (int i = 0; i < warehouse.size(); i++) {
        const Bundle& b = warehouse[i];
        file << i << "," << b.rider_type << "," << b.cost << ",\"[";

        // 경로(route)에서 픽업 노드(=주문 번호)만 쏙쏙 뽑아내기
        vector<int> included_orders;
        for (int node : b.route) {
            if (node < K) included_orders.push_back(node);
        }

        // 뽑아낸 주문 번호들을 "[0, 5, 12]" 형태로 만들기
        for (size_t j = 0; j < included_orders.size(); j++) {
            file << included_orders[j];
            if (j != included_orders.size() - 1) file << ", ";
        }
        file << "]\"\n";
    }
    
    file.close();
    cout << "✅ Gurobi 창고 CSV 추출 완료! (총 " << warehouse.size() << "개 번들)" << endl;
}

#endif