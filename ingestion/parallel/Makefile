# Makefile for OpenMetadata Parallel Ingestion

.PHONY: help install test build deploy clean

REGISTRY ?= localhost:5000
VERSION ?= latest
NAMESPACE ?= openmetadata

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install development dependencies
	cd ../.. && pip install -e ".[dev]"
	pip install ray[default]==2.31.0
	pip install pytest pytest-asyncio pytest-mock pytest-kubernetes
	pip install prometheus-client boto3 google-cloud-storage azure-storage-blob

test-unit: ## Run unit tests
	pytest -v tests/unit/parallel --cov=ingestion.parallel --cov-report=term-missing

test-integration: ## Run integration tests (requires Docker)
	docker-compose -f tests/docker-compose.test.yml up -d
	sleep 10
	pytest -v tests/integration/parallel
	docker-compose -f tests/docker-compose.test.yml down

test-k8s: ## Run Kubernetes tests (requires Kind)
	./tests/k8s/setup-test-cluster.sh
	pytest -v tests/k8s
	kind delete cluster --name om-test

test-all: test-unit test-integration ## Run all tests

build-images: ## Build Docker images
	docker build -f images/om-ray-runner.Dockerfile -t $(REGISTRY)/om-ray-runner:$(VERSION) ../..
	docker build -f images/om-sink.Dockerfile -t $(REGISTRY)/om-sink:$(VERSION) ../..

push-images: build-images ## Build and push Docker images
	docker push $(REGISTRY)/om-ray-runner:$(VERSION)
	docker push $(REGISTRY)/om-sink:$(VERSION)

deploy-rbac: ## Deploy RBAC resources
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	kubectl apply -f deploy/kuberay/rbac.yaml

deploy-argo-template: ## Deploy Argo workflow template
	kubectl apply -f deploy/argo/om-parallel-ingestion.yaml

deploy-argo-only-template: ## Deploy Argo-only workflow template
	kubectl apply -f deploy/argo/om-parallel-ingestion-argo-only.yaml

deploy: deploy-rbac deploy-argo-template ## Deploy all resources

run-example: ## Run example workflow
	argo submit -n $(NAMESPACE) --from workflowtemplate/om-parallel-ingestion \
		-p source_class=ingestion.parallel.examples.postgres_quality_check.PostgresTableSourceAdapter \
		-p processor_class=ingestion.parallel.examples.postgres_quality_check.DataQualityProcessor \
		-p sink_class=ingestion.parallel.examples.postgres_quality_check.OpenMetadataQualitySink \
		-p runner_image=$(REGISTRY)/om-ray-runner:$(VERSION) \
		--watch

run-argo-only-example: ## Run Argo-only example workflow
	argo submit -n $(NAMESPACE) --from workflowtemplate/om-parallel-ingestion-argo-only \
		-p source_class=ingestion.parallel.examples.postgres_quality_check.PostgresTableSourceAdapter \
		-p processor_class=ingestion.parallel.examples.postgres_quality_check.DataQualityProcessor \
		-p sink_class=ingestion.parallel.examples.postgres_quality_check.OpenMetadataQualitySink \
		-p runner_image=$(REGISTRY)/om-ray-runner:$(VERSION) \
		--watch

port-forward-argo: ## Port forward Argo UI
	kubectl -n argo port-forward deployment/argo-server 2746:2746

port-forward-ray: ## Port forward Ray dashboard
	@echo "Finding Ray head service..."
	$(eval RAY_HEAD := $(shell kubectl get svc -n $(NAMESPACE) -l app=ray-head -o jsonpath='{.items[0].metadata.name}'))
	kubectl -n $(NAMESPACE) port-forward svc/$(RAY_HEAD) 8265:8265

debug-workflow: ## Debug a workflow (usage: make debug-workflow WORKFLOW=<name>)
	python tests/debug/debug_workflow.py $(WORKFLOW) --namespace $(NAMESPACE)

monitor-workflow: ## Monitor a workflow (usage: make monitor-workflow WORKFLOW=<name>)
	python tests/debug/debug_workflow.py $(WORKFLOW) --namespace $(NAMESPACE) --monitor

clean-workflows: ## Clean up completed workflows
	kubectl delete workflows -n $(NAMESPACE) --field-selector status.phase=Succeeded
	kubectl delete workflows -n $(NAMESPACE) --field-selector status.phase=Failed

clean-ray-clusters: ## Clean up Ray clusters
	kubectl delete rayclusters -n $(NAMESPACE) --all

clean: clean-workflows clean-ray-clusters ## Clean up all resources

perf-test-local: ## Run local performance test
	python tests/performance/load_test.py

perf-test-ray: ## Run Ray performance test
	python tests/performance/ray_performance_test.py

generate-docs: ## Generate documentation
	cd docs && python generate_api_docs.py > api-reference.md

lint: ## Run linters
	black ingestion/parallel --check
	isort ingestion/parallel --check
	flake8 ingestion/parallel
	mypy ingestion/parallel

format: ## Format code
	black ingestion/parallel
	isort ingestion/parallel

security-scan: ## Run security scan
	bandit -r ingestion/parallel
	safety check

validate-k8s: ## Validate Kubernetes manifests
	kubectl apply --dry-run=client -f deploy/argo/om-parallel-ingestion.yaml
	kubectl apply --dry-run=client -f deploy/argo/om-parallel-ingestion-argo-only.yaml
	kubectl apply --dry-run=client -f deploy/kuberay/rbac.yaml

# Development helpers
dev-setup: install ## Setup development environment
	pre-commit install
	echo "Development environment ready!"

dev-teardown: clean ## Tear down development environment
	docker-compose -f tests/docker-compose.test.yml down -v
	kind delete cluster --name om-test || true