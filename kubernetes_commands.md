# Kubernetes 명령어 정리

## 1. 이미지 빌드

```bash
docker build -t nqueens-backend:latest ./backend
docker build -t nqueens-frontend:latest ./frontend
```

---

## 2. 앱 배포

```bash
kubectl apply -R -f k8s/app/
```

### 상태 확인
```bash
kubectl get pods
kubectl get services
```

### 접속
- 앱: http://localhost

---

## 3. 무중단 배포 시연

### APP_VERSION 변경 (v1 → v2)
```bash
kubectl patch configmap nqueens-config --patch '{"data":{"APP_VERSION":"v2"}}'
kubectl rollout restart deployment/backend
```

### 롤링 업데이트 실시간 확인
```bash
kubectl get pods -w
```

### 롤백
```bash
kubectl patch configmap nqueens-config --patch '{"data":{"APP_VERSION":"v1"}}'
kubectl rollout restart deployment/backend
```

---

## 4. 스케일링

### 수동 스케일
```bash
kubectl scale deployment/backend --replicas=5
kubectl scale deployment/backend --replicas=1
```

### HPA 상태 확인
```bash
kubectl get hpa
```

---

## 5. 모니터링 (Prometheus + Grafana)

### 설치
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### 가동
```bash
helm install prometheus prometheus-community/kube-prometheus-stack -f k8s/monitoring/values.yaml --namespace monitoring --create-namespace
```

### Pod 상태 확인
```bash
kubectl get pods -n monitoring
```

### 접속
- Grafana: http://localhost:3001 (admin / admin)

### 추천 대시보드
- Kubernetes / Compute Resources / Pod
- Kubernetes / Compute Resources / Namespace (Pods)

---

## 6. 코드 변경 후 재배포

```bash
docker build -t nqueens-backend:latest ./backend
kubectl rollout restart deployment/backend
```

```bash
docker build -t nqueens-frontend:latest ./frontend
kubectl rollout restart deployment/frontend
```

---

## 7. 전체 삭제 후 재시작

### 삭제
```bash
kubectl delete -R -f k8s/app/
helm uninstall prometheus -n monitoring
kubectl delete namespace monitoring
```

### 재배포
```bash
kubectl apply -R -f k8s/app/
helm install prometheus prometheus-community/kube-prometheus-stack -f k8s/monitoring/values.yaml --namespace monitoring --create-namespace
```
