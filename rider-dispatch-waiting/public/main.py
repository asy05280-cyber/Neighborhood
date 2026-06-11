"""
배민 기사 묶음배송 최적화 API
-------------------------------
실행:  uvicorn main:app --reload --port 8000
문서:  http://localhost:8000/docs
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import numpy as np
import uuid
import time
import json
from datetime import datetime

# 알고리즘 모듈 import (같은 폴더에 있어야 함)
from util import Order, Rider, solution_check
from myalgorithm import algorithm


# ──────────────────────────────────────────────
# 앱 초기화
# ──────────────────────────────────────────────

app = FastAPI(
    title="묶음배송 최적화 API",
    description="배달 기사용 묶음배송 경로 최적화 서비스",
    version="1.0.0",
)

# CORS 설정 (프론트엔드 React 앱에서 호출 가능하도록)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 진행 중인 작업 상태 저장 (실제 서비스에선 Redis 사용 권장)
job_store: dict = {}


# ──────────────────────────────────────────────
# Pydantic 스키마 (요청 / 응답 모델)
# ──────────────────────────────────────────────

class RiderInfo(BaseModel):
    """배달원 정보 — TEST_K50_1.json의 RIDERS 항목과 동일한 구조"""
    type: str = Field(..., description="배달원 유형: BIKE | WALK | CAR")
    speed: float = Field(..., description="이동 속도 (m/s)")
    capa: int = Field(..., description="최대 적재 용량")
    var_cost: float = Field(..., description="거리당 변동비 (원/100m)")
    fixed_cost: float = Field(..., description="고정비 (원)")
    service_time: float = Field(..., description="서비스 시간 (초)")
    available_number: int = Field(..., description="사용 가능한 배달원 수")

    def to_list(self) -> list:
        return [
            self.type,
            self.speed,
            self.capa,
            self.var_cost,
            self.fixed_cost,
            self.service_time,
            self.available_number,
        ]


class OrderInfo(BaseModel):
    """주문 정보 — TEST_K50_1.json의 ORDERS 항목과 동일한 구조"""
    id: int = Field(..., description="주문 ID (0-indexed)")
    order_time: int = Field(..., description="주문 접수 시간 (초)")
    shop_lat: float = Field(..., description="픽업지 위도")
    shop_lon: float = Field(..., description="픽업지 경도")
    dlv_lat: float = Field(..., description="배달지 위도")
    dlv_lon: float = Field(..., description="배달지 경도")
    cook_time: int = Field(..., description="조리 시간 (초)")
    volume: int = Field(..., description="주문 부피")
    deadline: int = Field(..., description="배달 마감 시간 (초)")

    def to_list(self) -> list:
        return [
            self.id,
            self.order_time,
            self.shop_lat,
            self.shop_lon,
            self.dlv_lat,
            self.dlv_lon,
            self.cook_time,
            self.volume,
            self.deadline,
        ]


class OptimizeRequest(BaseModel):
    """최적화 요청 바디 — JSON 파일 전체 구조와 매핑"""
    K: int = Field(..., description="총 주문 수", ge=1)
    riders: list[RiderInfo] = Field(..., description="배달원 목록")
    orders: list[OrderInfo] = Field(..., description="주문 목록")
    dist: list[list[int]] = Field(..., description="거리 행렬 (2K x 2K)")
    timelimit: int = Field(60, description="최적화 제한 시간 (초)", ge=5, le=300)


class BundleResult(BaseModel):
    """단일 묶음 배송 결과"""
    rider_type: str
    shop_seq: list[int]
    dlv_seq: list[int]
    order_count: int
    shops: list[dict]   # 픽업지 위경도 목록
    dlvs: list[dict]    # 배달지 위경도 목록


class OptimizeResponse(BaseModel):
    """최적화 응답"""
    job_id: str
    status: str
    elapsed_sec: float
    K: int
    num_bundles: int
    avg_cost: float
    total_cost: float
    total_dist: int
    feasible: bool
    infeasibility: Optional[str]
    bundles: list[BundleResult]
    created_at: str


class JobStatusResponse(BaseModel):
    """비동기 작업 상태 응답"""
    job_id: str
    status: str          # pending | running | done | failed
    progress_msg: str
    result: Optional[OptimizeResponse] = None
    error: Optional[str] = None


# ──────────────────────────────────────────────
# 내부 헬퍼 함수
# ──────────────────────────────────────────────

def parse_request(req: OptimizeRequest):
    """요청 데이터를 알고리즘이 받는 형태로 변환"""
    all_orders = [Order(o.to_list()) for o in req.orders]
    all_riders = [Rider(r.to_list()) for r in req.riders]
    dist_mat = np.array(req.dist)
    return all_orders, all_riders, dist_mat


def build_response(
    job_id: str,
    req: OptimizeRequest,
    solution: list,
    all_orders: list,
    all_riders: list,
    dist_mat: np.ndarray,
    elapsed: float,
) -> OptimizeResponse:
    """알고리즘 결과를 API 응답 형태로 변환"""

    checked = solution_check(req.K, all_orders, all_riders, dist_mat, solution)

    bundles = []
    for bundle_info in solution:
        rider_type, shop_seq, dlv_seq = bundle_info
        shops = [
            {"lat": all_orders[i].shop_lat, "lon": all_orders[i].shop_lon, "order_id": i}
            for i in shop_seq
        ]
        dlvs = [
            {"lat": all_orders[i].dlv_lat, "lon": all_orders[i].dlv_lon, "order_id": i}
            for i in dlv_seq
        ]
        bundles.append(BundleResult(
            rider_type=rider_type,
            shop_seq=shop_seq,
            dlv_seq=dlv_seq,
            order_count=len(shop_seq),
            shops=shops,
            dlvs=dlvs,
        ))

    return OptimizeResponse(
        job_id=job_id,
        status="done",
        elapsed_sec=round(elapsed, 2),
        K=req.K,
        num_bundles=len(bundles),
        avg_cost=round(checked.get("avg_cost", 0), 2),
        total_cost=round(checked.get("total_cost", 0), 2),
        total_dist=checked.get("total_dist", 0),
        feasible=checked.get("feasible", False),
        infeasibility=checked.get("infeasibility"),
        bundles=bundles,
        created_at=datetime.now().isoformat(),
    )


# ──────────────────────────────────────────────
# 엔드포인트
# ──────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "묶음배송 최적화 API", "docs": "/docs"}


@app.get("/health")
def health_check():
    """서버 상태 확인"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/api/optimize", response_model=OptimizeResponse, summary="묶음배송 최적화 (동기)")
def optimize_sync(req: OptimizeRequest):
    """
    주문 데이터를 받아 묶음배송 최적화를 실행하고 결과를 즉시 반환합니다.

    - **timelimit** 이내에 실행이 완료됩니다.
    - 주문이 많거나 timelimit이 길면 `/api/optimize/async`를 사용하세요.
    """
    if len(req.orders) != req.K:
        raise HTTPException(400, f"orders 개수({len(req.orders)})가 K({req.K})와 다릅니다.")

    expected_size = req.K * 2
    if len(req.dist) != expected_size or any(len(row) != expected_size for row in req.dist):
        raise HTTPException(400, f"dist 행렬 크기가 {expected_size}x{expected_size}여야 합니다.")

    try:
        all_orders, all_riders, dist_mat = parse_request(req)
        t0 = time.time()
        solution = algorithm(req.K, all_orders, all_riders, dist_mat, timelimit=req.timelimit)
        elapsed = time.time() - t0

        job_id = str(uuid.uuid4())[:8]
        return build_response(job_id, req, solution, all_orders, all_riders, dist_mat, elapsed)

    except Exception as e:
        raise HTTPException(500, f"최적화 중 오류 발생: {str(e)}")


@app.post("/api/optimize/async", response_model=dict, summary="묶음배송 최적화 (비동기)")
def optimize_async(req: OptimizeRequest, background_tasks: BackgroundTasks):
    """
    최적화를 백그라운드에서 실행하고 job_id를 즉시 반환합니다.
    `/api/jobs/{job_id}` 로 상태를 폴링하세요.
    """
    job_id = str(uuid.uuid4())[:8]
    job_store[job_id] = {"status": "pending", "progress_msg": "대기 중...", "result": None, "error": None}

    def run_job():
        job_store[job_id]["status"] = "running"
        job_store[job_id]["progress_msg"] = "최적화 실행 중..."
        try:
            all_orders, all_riders, dist_mat = parse_request(req)
            t0 = time.time()
            solution = algorithm(req.K, all_orders, all_riders, dist_mat, timelimit=req.timelimit)
            elapsed = time.time() - t0
            result = build_response(job_id, req, solution, all_orders, all_riders, dist_mat, elapsed)
            job_store[job_id]["status"] = "done"
            job_store[job_id]["progress_msg"] = "완료"
            job_store[job_id]["result"] = result
        except Exception as e:
            job_store[job_id]["status"] = "failed"
            job_store[job_id]["error"] = str(e)

    background_tasks.add_task(run_job)
    return {"job_id": job_id, "message": f"/api/jobs/{job_id} 에서 상태를 확인하세요."}


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse, summary="작업 상태 조회")
def get_job_status(job_id: str):
    """비동기 최적화 작업의 현재 상태와 결과를 반환합니다."""
    if job_id not in job_store:
        raise HTTPException(404, f"job_id '{job_id}' 를 찾을 수 없습니다.")
    job = job_store[job_id]
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress_msg=job["progress_msg"],
        result=job["result"],
        error=job["error"],
    )


@app.post("/api/load-json", response_model=OptimizeResponse, summary="JSON 파일 형식으로 최적화")
def optimize_from_json(payload: dict):
    """
    STAGE3_TEST_3.json 파일 형식을 그대로 받아서 최적화합니다.
    파일 구조: {"K": ..., "RIDERS": [...], "ORDERS": [...], "DIST": [...]}
    """
    try:
        K = payload["K"]
        riders = [RiderInfo(
            type=r[0], speed=r[1], capa=r[2],
            var_cost=r[3], fixed_cost=r[4],
            service_time=r[5], available_number=r[6]
        ) for r in payload["RIDERS"]]

        orders = [OrderInfo(
            id=o[0], order_time=o[1],
            shop_lat=o[2] + 1.5, shop_lon=o[3] + 1.5,
            dlv_lat=o[4] + 1.5, dlv_lon=o[5] + 1.5,
            cook_time=o[6], volume=o[7], deadline=o[8]
        ) for o in payload["ORDERS"]]

        req = OptimizeRequest(
            K=K,
            riders=riders,
            orders=orders,
            dist=payload["DIST"],
            timelimit=payload.get("timelimit", 60),
        )
        return optimize_sync(req)

    except KeyError as e:
        raise HTTPException(400, f"필수 필드 누락: {e}")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/run-dms", response_model=OptimizeResponse, summary="데이터셋 자동 로드 후 최적화")
def run_dms():
    """
    서버에서 직접 STAGE3_TEST_3.json을 로드해서 최적화를 실행합니다.
    프론트에서 별도로 데이터를 전송할 필요 없이 GET 요청만으로 결과를 받습니다.
    """
    try:
        dataset_path = "STAGE3_TEST_9.json"
        with open(dataset_path, "r") as f:
            payload = json.load(f)

        K = payload["K"]
        riders = [RiderInfo(
            type=r[0], speed=r[1], capa=r[2],
            var_cost=r[3], fixed_cost=r[4],
            service_time=r[5], available_number=r[6]
        ) for r in payload["RIDERS"]]

        orders = [OrderInfo(
            id=o[0], order_time=o[1],
            shop_lat=o[2] + 1.5, shop_lon=o[3]+ 1.5,
            dlv_lat=o[4]+ 1.5, dlv_lon=o[5]+ 1.5,
            cook_time=o[6], volume=o[7], deadline=o[8]
        ) for o in payload["ORDERS"]]

        req = OptimizeRequest(
            K=K,
            riders=riders,
            orders=orders,
            dist=payload["DIST"],
            timelimit=30,
        )
        return optimize_sync(req)

    except FileNotFoundError:
        raise HTTPException(404, "STAGE3_TEST_3.json 파일을 찾을 수 없습니다. main.py와 같은 폴더에 있어야 합니다.")
    except KeyError as e:
        raise HTTPException(400, f"필수 필드 누락: {e}")
    except Exception as e:
        raise HTTPException(500, str(e))