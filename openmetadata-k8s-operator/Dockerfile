FROM eclipse-temurin:21-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy the fat JAR
COPY target/openmetadata-k8s-operator-*-boot.jar omjob-operator.jar

# Create non-root user
RUN addgroup -g 1000 omjob && adduser -u 1000 -G omjob -s /bin/sh -D omjob
RUN chown -R omjob:omjob /app
USER omjob

# Expose health check port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# -XX:-UseBASE64Intrinsics: CVE-2026-114938, as in bin/openmetadata-server-start.sh.
ENTRYPOINT ["java", "-XX:-UseBASE64Intrinsics", "-jar", "omjob-operator.jar"]