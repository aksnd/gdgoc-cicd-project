# GDGOC CI/CD Demo — N-Queens

Kubernetes의 주요 기능 5가지를 N-Queens 연산으로 시연하는 데모 프로젝트입니다.

---

## 기술 스택

- **Frontend**: React + Vite + Nginx (HTTP/2)
- **Backend**: FastAPI + Uvicorn (SSE 스트리밍)
- **Container**: Docker
- **Orchestration**: Kubernetes (Docker Desktop)
- **Monitoring**: Prometheus + Grafana (Helm)

---

## 초기 설치

### 사전 요구사항

**Docker Desktop**
- Settings → Kubernetes → Enable Kubernetes → Apply & Restart
- 우하단 Kubernetes 상태가 초록불인지 확인

**Helm** (Prometheus/Grafana 설치에 필요)
```powershell
# Windows (winget)
winget install Helm.Helm

# 또는 chocolatey
choco install kubernetes-helm
```

### 1. 이미지 빌드 및 K8s 배포

```powershell
.\deploy.ps1
```

### 2. metrics-server 설치 (HPA 작동에 필수)

```powershell
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

kubectl patch deployment metrics-server -n kube-system --type=strategic -p '{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"metrics-server\",\"args\":[\"--cert-dir=/tmp\",\"--secure-port=10250\",\"--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname\",\"--kubelet-use-node-status-port\",\"--metric-resolution=15s\",\"--kubelet-insecure-tls\"]}]}}}}'
```

설치 확인 (1/1 Running 될 때까지 대기):

```powershell
kubectl get pods -n kube-system -w
```

정상 작동 확인:

```powershell
kubectl top pods
```

### 3. Prometheus + Grafana 설치

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack `
  -f k8s/monitoring/values.yaml --namespace monitoring --create-namespace
```

### 접속 주소

| 서비스 | 주소 |
|---|---|
| K8s 앱 | https://localhost (인증서 경고 무시) |
| Docker Compose 앱 | https://localhost:8443 |
| Grafana | http://localhost:3001 (admin / admin) |

> 브라우저에서 `https://localhost` 접속 시 "안전하지 않음" 경고가 뜨면 **고급 → 계속 진행** 클릭

---

## 배포 스크립트

| 스크립트 | 설명 |
|---|---|
| `.\deploy.ps1` | 전체 재빌드 및 배포 (초기 실행 또는 전체 변경 시) |
| `.\deploy-backend.ps1` | 백엔드만 재빌드 및 배포 (Rolling Update 시연용) |
| `.\deploy-frontend.ps1` | 프론트엔드만 재빌드 및 배포 |
| `docker-compose up --build` | Docker 단일 인스턴스 실행 (Load Balancing 비교용) |

> Docker Compose와 K8s는 포트가 달라 동시에 실행 가능
> - K8s: `https://localhost`
> - Docker Compose: `https://localhost:8443`

---

## 시연 가이드

### 공통 준비

1. Docker Desktop Kubernetes가 초록불인지 확인
2. `kubectl get pods` 로 모든 Pod `Running` 확인
3. `https://localhost` 접속

---

### 1. Self-Healing

**K8s가 죽은 Pod를 자동으로 재시작하는 기능**

```bash
# 터미널 1: Pod 상태 실시간 감시
kubectl get pods -w

# 터미널 2: Pod 강제 종료
kubectl delete pod <pod-name>
```

- 브라우저 **단일 요청** 탭에서 N=10으로 연산 시작
- Pod 종료 후 자동으로 새 Pod 이름이 나타나는 것 확인

---

### 2. Load Balancing

**여러 요청이 다수의 Pod에 분산되는 기능**

- **부하 분산 테스트** 탭 → N=10, 요청 수=6 → **동시 요청 시작**
- 테이블에서 각 요청이 다른 Pod 이름으로 처리되는 것 확인
- Pod 분산 현황이 하단에 표시됨

> **비교**: Docker Compose(`https://localhost:8443`) 부하 분산 테스트 탭에서는 모든 요청이 동일한 Pod 이름 → K8s와 나란히 비교

---

### 3. Auto Scaling (HPA)

**트래픽 증가 시 Pod가 자동으로 늘어나는 기능**

```bash
# 터미널: HPA 및 Pod 수 실시간 감시
kubectl get hpa -w
kubectl get pods -w
```

1. **부하 분산 테스트** 탭을 여러 창에서 열기
2. 각 창에서 N=12~13, 요청 수=6 → 동시 요청 시작
3. CPU 50% 초과 시 자동으로 Pod 2 → 5개로 증가 확인

> HPA는 15~30초 주기로 CPU를 확인하므로 스케일업까지 약 30초 소요

---

### 4. Rolling Update + Graceful Shutdown

**진행 중인 연산을 끊지 않고 새 버전으로 배포하는 기능**

```bash
# 터미널: Pod 교체 과정 실시간 감시
kubectl get pods -w
```

1. 브라우저에서 N=15로 연산 시작 (오래 걸리는 것)
2. 버전 변경 후 백엔드만 재배포

```powershell
kubectl patch configmap nqueens-config --patch '{"data":{"APP_VERSION":"v2"}}'
.\deploy-backend.ps1
```

3. 연산이 끊기지 않고 완료되는 것 확인
4. 이후 새 요청은 v2 Pod에서 처리되는 것 확인

> 롤백: `kubectl patch configmap nqueens-config --patch '{"data":{"APP_VERSION":"v1"}}'`

---

### 5. 모니터링

**Grafana에서 실시간 CPU 사용량 확인**

- `http://localhost:3001` (admin / admin)
- 대시보드: **Kubernetes / Compute Resources / Pod**
  - namespace: `default`
  - pod: `backend-...` 선택
- 부하 걸면 CPU Usage 그래프가 0.3(limits)까지 올라가는 것 확인

> **N=11 권장**: 연산이 적당히 길어서 그래프 변화를 관찰하기 좋고, 완료 후 CPU가 자연스럽게 내려가는 흐름까지 한 사이클로 보여줄 수 있습니다.

---

## 주의사항

- **중지 버튼을 눌러도 백엔드 연산은 계속 진행됩니다.** CPU를 내리려면 연산이 완료되거나 Pod를 재시작해야 합니다.
- **평상시 N값은 10 이하**로 유지하세요. N=12 이상은 CPU가 즉시 한계치까지 올라갑니다.
- **HPA 스케일다운**은 부하 종료 후 약 1분 뒤 발생합니다.
- **K8s 재시작 후**에는 `.\deploy.ps1`을 다시 실행해야 합니다. Grafana/Prometheus는 `helm install` 명령을, metrics-server는 `kubectl apply` + `kubectl patch` 명령을 다시 실행해야 합니다.
- **metrics-server**가 없으면 HPA가 동작하지 않습니다. `kubectl get hpa`에서 TARGETS가 `<unknown>`이면 재설치 필요. `kubectl get pods -n kube-system | sls metrics-server` 로 설치 여부 확인 가능.
- Rolling Update 시연 시 **`.\deploy-backend.ps1`만** 사용하세요. `.\deploy.ps1`은 프론트도 재시작해서 연결이 끊깁니다.
