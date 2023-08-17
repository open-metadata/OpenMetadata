.DEFAULT_GOAL := help
# SOURCE_VERSION = old_version
# DESTINATION_VERSION = new_version

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[35m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: update_all

update_all: ## To update all the release related files
	@$(MAKE) update_maven
	@$(MAKE) update_github_action_paths 
	@$(MAKE) update_python_release_paths
	@$(MAKE) update_dockerfile_version
	@$(MAKE) update_ingestion_dockerfile_version
	@echo "All updates completed!"

.PHONY: update_maven
update_maven: #Update the common and pom.xml maven version
	@read -p "Enter the version: " version; \
	echo "Updating Maven projects to version $$version..."; \
	mvn versions:set -DnewVersion=$$version

.PHONY: update_github_action_paths
update_github_action_paths: ## To update the github action ci docker files
	@file_paths="../.github/workflows/docker-openmetadata-db.yml \
                ../.github/workflows/docker-openmetadata-ingestion-base.yml \
                ../.github/workflows/docker-openmetadata-ingestion.yml \
                ../.github/workflows/docker-openmetadata-postgres.yml \
                ../.github/workflows/docker-openmetadata-server.yml"; \
	read -p "Enter older version: " SOURCE_VERSION; \
	read -p "Enter release version: " DESTINATION_VERSION; \
	for file_path in $$file_paths; do \
	    python3 update_version.py $$file_path -s $$SOURCE_VERSION -d $$DESTINATION_VERSION; \
	done

.PHONY: update_python_release_paths
update_python_release_paths: ## To update all the python setup files version
	@file_paths="../ingestion/setup.py ../openmetadata-airflow-apis/setup.py"; \
	read -p "Enter source version: " SOURCE_VERSION; \
	read -p "Enter destination version: " DESTINATION_VERSION; \
	for file_path in $$file_paths; do \
	    python3 update_version.py $$file_path -s $$SOURCE_VERSION -d $$DESTINATION_VERSION; \
	done

.PHONY: update_dockerfile_version
update_dockerfile_version: ## To update the dockerfiles version
	@file_paths="../docker/docker-compose-ingestion/docker-compose-ingestion-postgres.yml \
                ../docker/docker-compose-ingestion/docker-compose-ingestion.yml \
                ../docker/docker-compose-openmetadata/docker-compose-openmetadata-postgres.yml \
                ../docker/docker-compose-openmetadata/docker-compose-openmetadata.yml \
                ../docker/docker-compose-quickstart/Dockerfile \
                ../docker/docker-compose-quickstart/docker-compose-postgres.yml \
                ../docker/docker-compose-quickstart/docker-compose.yml"; \
	read -p "Enter older version: " SOURCE_VERSION; \
	read -p "Enter release version: " DESTINATION_VERSION; \
	for file_path in $$file_paths; do \
	    python3 update_version.py $$file_path -s $$SOURCE_VERSION -d $$DESTINATION_VERSION; \
	done
	

.PHONY: update_ingestion_dockerfile_version
update_ingestion_dockerfile_version: ## To update the ingestion dockerfiles version
	@file_paths="../ingestion/Dockerfile" \
    			../ingestion/operators/docker/Dockerfile"
	read -p "Enter older version: " SOURCE_VERSION; \
	read -p "Enter release version: " DESTINATION_VERSION; \
	for file_path in $$file_paths; do \
	    python3 update_version.py $$file_path -s $$SOURCE_VERSION -d $$DESTINATION_VERSION; \
	done
