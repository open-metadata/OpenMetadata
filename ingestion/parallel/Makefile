# OpenMetadata Parallel Ingestion Makefile

.PHONY: help build deploy submit watch clean

# Variables
IMAGE_NAME := om-parallel-worker
VERSION := latest
NAMESPACE := openmetadata
CONFIG := configs/postgres-workflow.yaml

help: ## Show this help
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker image
	@echo "Building $(IMAGE_NAME):$(VERSION)..."
	@docker build -f images/om-parallel-worker.Dockerfile -t $(IMAGE_NAME):$(VERSION) ../.. --platform linux/amd64 -q
	@echo "✓ Image built: $(IMAGE_NAME):$(VERSION)"

deploy: ## Deploy Kubernetes resources
	@echo "Deploying Kubernetes resources..."
	@kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@kubectl apply -f deploy/k8s/argo-rbac.yaml
	@echo "✓ Resources deployed"

submit: ## Submit workflow (use CONFIG=path/to/config.yaml)
	@echo "Submitting workflow with config: $(CONFIG)"
	@argo submit workflow.yaml -n $(NAMESPACE) --parameter-file $(CONFIG)
	@echo "✓ Workflow submitted"

watch: ## Watch latest workflow
	@argo watch @latest -n $(NAMESPACE)

logs: ## Show workflow logs
	@argo logs @latest -n $(NAMESPACE)

status: ## Show workflow status
	@argo get @latest -n $(NAMESPACE)

list: ## List all workflows
	@argo list -n $(NAMESPACE)

clean: ## Clean up completed workflows
	@echo "Cleaning up workflows..."
	@kubectl delete workflows -n $(NAMESPACE) --field-selector status.phase=Succeeded 2>/dev/null || true
	@kubectl delete workflows -n $(NAMESPACE) --field-selector status.phase=Failed 2>/dev/null || true
	@echo "✓ Cleanup complete"

# Combined commands
all: build deploy submit watch ## Build, deploy, submit and watch

quick: submit watch ## Submit workflow and watch progress