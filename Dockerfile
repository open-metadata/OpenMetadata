FROM openjdk:21-jdk-slim

WORKDIR /app

# Install Maven
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Build OpenMetadata backend (skip tests for faster build)
RUN mvn clean package -DskipTests

# Expose the default OpenMetadata port
EXPOSE 8585

# Run the OpenMetadata server JAR
CMD ["java", "-jar", "openmetadata-dist/target/openmetadata-*-SNAPSHOT-all.jar"]
