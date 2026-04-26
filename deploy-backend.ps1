docker build -t nqueens-backend:latest ./backend
kubectl apply -R -f k8s/app/backend/
kubectl apply -f k8s/app/configmap.yaml
kubectl rollout restart deployment/backend
