build:
	docker-compose -f docker-compose.yml up --force-recreate --build -d
	mc config host add minio http://localhost:9001 minio password --api S3v4
	mc mb -p minio/mlops.local.com
