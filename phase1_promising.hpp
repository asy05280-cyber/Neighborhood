#ifndef PHASE1_PROMISING_HPP
#define PHASE1_PROMISING_HPP

#include <iostream>
#include <vector>
#include <cmath>      // abs(절댓값) 함수를 쓰기 위해 추가
#include "models.hpp" // Order 구조체 가져오기
#include "utils.hpp"  // K, order_list, dist_matrix 가져오기

using namespace std;

// 전역에서 언제든 꺼내볼 수 있는 K x K 크기의 점수판!
vector<vector<double>> promising_matrix;

// 점수판을 생성하는 함수 (알고리즘 시작할 때 딱 한 번만 실행됨)
void build_promising_matrix(double alpha) {
    cout << "Phase 1: 유망 점수판 생성 시작..." << endl;

    // K x K 크기로 행렬을 0으로 꽉 채워서 초기화
    promising_matrix.assign(K, vector<double>(K, 0.0));

    // 이중 루프를 돌면서 모든 주문 쌍(i, j)의 궁합 점수를 계산
    for (int i = 0; i < K; i++) {
        for (int j = 0; j < K; j++) {
            // 자기 자신과의 궁합은 계산할 필요 없으니 무한대(매우 큰 값)로 처리
            if (i == j) {
                promising_matrix[i][j] = 1e9; 
                continue;
            }

            // 1. 픽업 거리 계산 (i 픽업 -> j 픽업)
            double dist_pickup = dist_matrix[i][j];

            // 2. 배달 거리 계산 (i 배달 -> j 배달)
            // 배달 노드는 K만큼 인덱스가 뒤로 밀려있음을 잊지 말자!
            double dist_delivery = dist_matrix[i + K][j + K];

            // 3. 시간 페널티 계산 (준비 시각의 차이)
            double time_penalty = abs(order_list[i].readytime - order_list[j].readytime);

            // 4. 최종 점수 기록
            promising_matrix[i][j] = dist_pickup + dist_delivery + (alpha * time_penalty);
        }
    }

    cout << "Phase 1: 유망 점수판 생성 완료!" << endl;
}

#endif