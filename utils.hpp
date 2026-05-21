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
    cerr << "1. 함수 진입" << endl;
    
    ifstream file(filepath);
    cerr << "2. ifstream 생성됨" << endl;
    
    if (!file.is_open()) {
        cerr << "파일 열기 실패!" << endl;
        exit(1);
    }
    cerr << "3. 파일 열기 성공!" << endl;

    json j;
    cerr << "4. JSON 파싱 시작..." << endl;
    try {
        j = json::parse(file);
    } catch (const json::parse_error& e) {
        cerr << "JSON 파싱 에러: " << e.what() << endl;
        exit(1);
    }
    cerr << "5. JSON 파싱 완료!" << endl;

    K = j["K"];
    cerr << "6. K = " << K << endl;

    // RIDERS
    for (const auto& r : j["RIDERS"]) {
        Rider_Info rider;
        rider.type = r[0];
        rider.speed = r[1];
        rider.capacity = r[2];
        rider.var_cost = r[3];
        rider.fixed_cost = r[4];
        rider.service_time = r[5];
        rider.availability = r[6];
        rider_list.push_back(rider);
    }
    cerr << "7. RIDERS 완료" << endl;

    for (const auto& o : j["ORDERS"]) {
        Order order;
        order.id = o[0];
        int order_time = o[1];
        int prep_time = o[6];
        order.readytime = order_time + prep_time;
        order.volume = o[7];
        order.deadline = o[8];
        order_list.push_back(order);
    }
    cerr << "8. ORDERS 완료" << endl;

    dist_matrix = j["DIST"].get<vector<vector<int>>>();
    cerr << "9. DIST 완료! K=" << K << " rider=" << rider_list.size() << endl;
}

// 2. 편의성 도구: 거리 계산기
int get_distance(int from_node, int to_node) {
    return dist_matrix[from_node][to_node];
}


void export_warehouse(const vector<Bundle>& warehouse, const string& filename) {
    // 1. 파일이 비어있는지(새로 만든 건지) 확인
    bool is_empty = true;
    std::ifstream check_file(filename);
    if (check_file.good()) {
        is_empty = (check_file.peek() == std::ifstream::traits_type::eof());
    }
    check_file.close();

    // 2. '이어 쓰기(app)' 모드로 파일 열기
    std::ofstream out(filename, std::ios::app);
    
    // 3. 파일이 비어있을 때(1라운드)만 헤더 쓰기
    if (is_empty) {
        out << "Type,Cost,Orders\n";
    }

    // 4. 창고에 있는 번들 기록
    for (const auto& b : warehouse) {
        // 배달원 타입과 비용 출력
        out << b.rider_type << "," << b.cost << ",";
        
        // 💡 핵심! b.orders 대신 b.route 를 사용합니다!
        for (size_t i = 0; i < b.route.size(); ++i) {
            out << b.route[i]; // (vector<int> 이므로 ->id 없이 바로 출력!)
            if (i + 1 < b.route.size()) out << " ";
        }
        out << "\n";
    }
    out.close();
}


// 💡 Gurobi가 피드백해 준 최적 조합 파일을 읽어서 C++ Solution 구조체로 복원하는 함수
bool load_best_solution(Solution& sol, const string& filename) {
    ifstream in(filename);
    if (!in.is_open()) return false; // 파일이 없으면 false 반환 (1라운드 때)

    int num_bundles;
    if (!(in >> num_bundles)) return false;

    sol.bundles.clear();
    sol.total_cost = 0;

    for (int i = 0; i < num_bundles; ++i) {
        Bundle b;
        int route_size;
        // 파일 끝에 도달했거나 읽기 실패하면 안전하게 종료
        if (!(in >> b.rider_type >> b.cost >> b.total_volume >> route_size)) break;
        
        b.route.resize(route_size);
        for (int j = 0; j < route_size; ++j) {
            in >> b.route[j];
        }
        sol.total_cost += b.cost;
        sol.bundles.push_back(b);
    }
    in.close();
    return true; // 역주입 성공!
}



#endif