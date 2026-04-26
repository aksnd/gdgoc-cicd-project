docker build -t nqueens-frontend:latest ./frontend
kubectl apply -R -f k8s/app/frontend/
kubectl rollout restart deployment/frontend
