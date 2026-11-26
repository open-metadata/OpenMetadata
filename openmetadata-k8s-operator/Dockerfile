# Amazon Corretto 21 for Alpine, from its official image: Temurin has not published OpenJDK's
# November 2026 security release yet.
FROM amazoncorretto:21-alpine AS jre-builder

# --strip-java-debug-attributes, not --strip-debug: Corretto ships its native libraries
# stripped, and --strip-debug would need objcopy for nothing.
# Headless: drop the X11 and sound natives, which link libraries this image does not have.
RUN jlink \
      --add-modules ALL-MODULE-PATH \
      --strip-java-debug-attributes \
      --no-man-pages \
      --no-header-files \
      --compress=zip-6 \
      --output /javaruntime && \
    rm -f /javaruntime/lib/libawt_xawt.so /javaruntime/lib/libjawt.so \
      /javaruntime/lib/libsplashscreen.so /javaruntime/lib/libjsound.so

FROM alpine:3

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}" \
    LANG='en_US.UTF-8' LANGUAGE='en_US:en' LC_ALL='en_US.UTF-8'

# Install curl for health checks
RUN apk add --no-cache curl

COPY --from=jre-builder /javaruntime ${JAVA_HOME}

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

# Run the operator
ENTRYPOINT ["java", "-jar", "omjob-operator.jar"]