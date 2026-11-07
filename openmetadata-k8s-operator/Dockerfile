FROM eclipse-temurin:21-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# CVE-2026-114820 and CVE-2026-91403 (eMudhra).
# ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots
# Temurin 21.0.13 no longer ships the roots behind CVE-2026-91403 (emSign ECC G3, ECC C3, C1),
# so they are only checked here; a base older than 21.0.13 still has them and fails the build.
# It still ships emSign Root CA - G1, which the follow-up alert removes along with emSign G2 and
# Comodo's AAA Certificate Services. Delete those three by SHA-256 until eclipse-temurin:21-jre-alpine
# drops them.
# Roots, not intermediate fingerprints in blocked.certs: an ECDSA signature re-encoded as
# (r, n-s) gives an intermediate a new fingerprint that still verifies.
# Keep `java` as the entrypoint: Temurin's own entrypoint re-imports the system CA store when
# USE_SYSTEM_CA_CERTS is set.
RUN set -eu; \
    remove='40F6AF0346A99AA1CD1D555A4E9CCE62C7F9634603EE406615833DC8C8D00367 1AA0C2709E831BD6E3B5129A00BA41F7EEEF020872F1E6504BF0F6C3F24F3AF3 D7A7A0FB5D7E2731D771E9484EBCDEF71D5F0C3E0A2948782BC83EE0EA699EF4'; \
    check="$remove 86A1ECBA089C4A8D3BBE2734C612BA341D813E043CF9E8A862CD5C57A36BBE6B BC4D809B15189D78DB3E1D8CF4F9726A795DA1643CA5F1358E1DDB0EDC0D7EB3 125609AA301DA0A249B97A8239CB6A34216F44DCAC9F3954B14292F2E8C8608F"; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    printf '%s\n' "$certs" \
      | awk -v roots="$remove" 'BEGIN { split(roots, r, " "); for (i in r) want[r[i]] = 1 } /^Alias name:/ { alias = substr($0, 13) } /SHA256:/ { gsub(":", "", $2); if ($2 in want) print alias }' \
      | while IFS= read -r alias; do keytool -delete -cacerts -storepass changeit -alias "$alias"; done; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    if printf '%s\n' "$certs" | tr -d ':' | grep -qE "$(echo $check | tr ' ' '|')"; then \
      echo "a distrusted root CA is still trusted; emSign G3, C3 or C1 means the base JDK predates Temurin 21.0.13" >&2; exit 1; \
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