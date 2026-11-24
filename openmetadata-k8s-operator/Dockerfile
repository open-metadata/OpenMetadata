# Amazon Corretto 21 for Alpine; see ADR:2026-11-18-shipped-jvm-images-run-on-corretto.
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

# CVE-2026-91403 (ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots):
# eMudhra's compromised intermediates chain to three emSign roots (ECC G3, ECC C3, C1). Oracle JDK
# 21.0.13.0.3 also removes emSign G1, G2 and Comodo's AAA Certificate Services from cacerts, so
# this step drops those too.
# Corretto's cacerts has none of them, so nothing is deleted today. The step stays as the check:
# it drops any that come back by SHA-256 and fails the build if one is still trusted.
# Roots, not the advisory's intermediate fingerprints in blocked.certs: an ECDSA signature
# re-encoded as (r, n-s) gives an intermediate a new fingerprint that still verifies.
RUN set -eu; \
    roots='86A1ECBA089C4A8D3BBE2734C612BA341D813E043CF9E8A862CD5C57A36BBE6B BC4D809B15189D78DB3E1D8CF4F9726A795DA1643CA5F1358E1DDB0EDC0D7EB3 125609AA301DA0A249B97A8239CB6A34216F44DCAC9F3954B14292F2E8C8608F 40F6AF0346A99AA1CD1D555A4E9CCE62C7F9634603EE406615833DC8C8D00367 1AA0C2709E831BD6E3B5129A00BA41F7EEEF020872F1E6504BF0F6C3F24F3AF3 D7A7A0FB5D7E2731D771E9484EBCDEF71D5F0C3E0A2948782BC83EE0EA699EF4'; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    printf '%s\n' "$certs" \
      | awk -v roots="$roots" 'BEGIN { split(roots, r, " "); for (i in r) want[r[i]] = 1 } /^Alias name:/ { alias = substr($0, 13) } /SHA256:/ { gsub(":", "", $2); if ($2 in want) print alias }' \
      | while IFS= read -r alias; do keytool -delete -cacerts -storepass changeit -alias "$alias"; done; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    if printf '%s\n' "$certs" | tr -d ':' | grep -qE "$(echo $roots | tr ' ' '|')"; then \
      echo "a root CA this step removes is still trusted" >&2; exit 1; \
    fi

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
