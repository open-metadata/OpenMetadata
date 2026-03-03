package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.util.List;
import java.util.Map;
import org.apache.commons.text.StringSubstitutor;
import org.apache.commons.text.TextStringBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class YamlSafeSubstitutorTest {

  private static final ObjectMapper YAML_MAPPER = new ObjectMapper(new YAMLFactory());

  // --- quoteIfNeeded: null and empty ---

  @Test
  void quoteIfNeeded_returnsNullForNull() {
    assertNull(YamlSafeSubstitutor.quoteIfNeeded(null));
  }

  @Test
  void quoteIfNeeded_leavesEmptyStringUnchanged() {
    assertEquals("", YamlSafeSubstitutor.quoteIfNeeded(""));
  }

  // --- quoteIfNeeded: values that should NOT be quoted ---

  @ParameterizedTest
  @ValueSource(
      strings = {
        "password123",
        "openmetadata_password",
        "false",
        "true",
        "8585",
        "0",
        "100",
        "3306",
        "com.mysql.cj.jdbc.Driver",
        "org.openmetadata.service.security.DefaultAuthorizer",
        "localhost",
        "0.0.0.0",
        "http",
        "mysql",
        "postgresql",
        "openmetadata_db",
        "EN",
        "INFO",
        "ERROR",
        "admin",
        "basic",
        "public",
        "primary",
        "db",
        "none",
        "prometheus",
        "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=",
        "allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC",
        "-nospace",
        "host:3306",
      })
  void quoteIfNeeded_leavesSimpleValuesUnchanged(String value) {
    assertEquals(value, YamlSafeSubstitutor.quoteIfNeeded(value));
  }

  // --- quoteIfNeeded: values that SHOULD be quoted ---

  @ParameterizedTest
  @ValueSource(
      strings = {
        ">8fYhD>dkcxy#HkVi8~ET",
        "|literal_block",
        "*alias",
        "&anchor",
        "!tag",
        "%directive",
        "@reserved",
        "`reserved",
        "'single_quoted",
        "\"double_quoted",
        "{broken_flow",
        "[broken_flow",
        "?mapping_key",
        ",flow_separator",
        "#comment",
      })
  void quoteIfNeeded_quotesLeadingSpecialCharacters(String value) {
    String result = YamlSafeSubstitutor.quoteIfNeeded(value);
    assertTrue(
        result.startsWith("\"") && result.endsWith("\""), "Expected value to be quoted: " + value);
  }

  @Test
  void quoteIfNeeded_quotesBlockSequenceIndicator() {
    assertEquals("\"- list_item\"", YamlSafeSubstitutor.quoteIfNeeded("- list_item"));
  }

  @Test
  void quoteIfNeeded_quotesValuesWithCommentIndicator() {
    assertEquals("\"password #comment\"", YamlSafeSubstitutor.quoteIfNeeded("password #comment"));
    assertEquals(
        "\"value\\t#tab-comment\"", YamlSafeSubstitutor.quoteIfNeeded("value\t#tab-comment"));
  }

  @Test
  void quoteIfNeeded_quotesValuesWithMappingIndicator() {
    assertEquals("\"key: value\"", YamlSafeSubstitutor.quoteIfNeeded("key: value"));
    assertEquals("\"trailing:\"", YamlSafeSubstitutor.quoteIfNeeded("trailing:"));
  }

  @Test
  void quoteIfNeeded_quotesLeadingTrailingWhitespace() {
    assertEquals("\" leading\"", YamlSafeSubstitutor.quoteIfNeeded(" leading"));
    assertEquals("\"trailing \"", YamlSafeSubstitutor.quoteIfNeeded("trailing "));
  }

  @Test
  void quoteIfNeeded_quotesNewlines() {
    assertEquals("\"line1\\nline2\"", YamlSafeSubstitutor.quoteIfNeeded("line1\nline2"));
  }

  // --- Flow sequences and mappings are preserved ---

  @Test
  void quoteIfNeeded_leavesFlowSequenceUnquoted() {
    assertEquals("[admin]", YamlSafeSubstitutor.quoteIfNeeded("[admin]"));
    assertEquals("[0.99, 0.90]", YamlSafeSubstitutor.quoteIfNeeded("[0.99, 0.90]"));
    assertEquals(
        "[email,preferred_username,sub]",
        YamlSafeSubstitutor.quoteIfNeeded("[email,preferred_username,sub]"));
    assertEquals("[]", YamlSafeSubstitutor.quoteIfNeeded("[]"));
    assertEquals("[\"all\"]", YamlSafeSubstitutor.quoteIfNeeded("[\"all\"]"));
  }

  @Test
  void quoteIfNeeded_leavesFlowMappingUnquoted() {
    assertEquals("{key: value}", YamlSafeSubstitutor.quoteIfNeeded("{key: value}"));
  }

  @Test
  void quoteIfNeeded_quotesUnmatchedBrackets() {
    String result = YamlSafeSubstitutor.quoteIfNeeded("{fa3B]gsTYb");
    assertTrue(result.startsWith("\""), "Unmatched { should be quoted");

    result = YamlSafeSubstitutor.quoteIfNeeded("[partial");
    assertTrue(result.startsWith("\""), "Unmatched [ should be quoted");
  }

  // --- yamlDoubleQuote escaping ---

  @Test
  void yamlDoubleQuote_escapesBackslashesAndQuotes() {
    assertEquals("\"pass\\\\word\"", YamlSafeSubstitutor.yamlDoubleQuote("pass\\word"));
    assertEquals("\"pass\\\"word\"", YamlSafeSubstitutor.yamlDoubleQuote("pass\"word"));
    assertEquals("\"a\\\\b\\\"c\"", YamlSafeSubstitutor.yamlDoubleQuote("a\\b\"c"));
  }

  // --- isInlineSubstitution detection ---

  @Test
  void isInlineSubstitution_standaloneAfterSpace() {
    TextStringBuilder buf = new TextStringBuilder("password: ${DB_PASSWORD:-default}");
    // ${...} starts at 10, ends at 33
    assertFalse(YamlSafeSubstitutor.isInlineSubstitution(buf, 10, 33));
  }

  @Test
  void isInlineSubstitution_embeddedInJdbcUrl() {
    TextStringBuilder buf = new TextStringBuilder("url: jdbc:${DB_SCHEME:-mysql}://localhost");
    // ${...} starts at 10, ends at 29
    assertTrue(YamlSafeSubstitutor.isInlineSubstitution(buf, 10, 29));
  }

  @Test
  void isInlineSubstitution_embeddedBetweenSlashAndColon() {
    TextStringBuilder buf = new TextStringBuilder("url: jdbc:mysql://${DB_HOST:-localhost}:3306");
    // ${...} starts at 18, ends at 38
    assertTrue(YamlSafeSubstitutor.isInlineSubstitution(buf, 18, 38));
  }

  @Test
  void isInlineSubstitution_afterQueryMark() {
    TextStringBuilder buf = new TextStringBuilder("url: jdbc:mysql://host:3306/db?${DB_PARAMS:-p}");
    // ${...} starts at 30, ends at 46
    assertTrue(YamlSafeSubstitutor.isInlineSubstitution(buf, 30, 46));
  }

  @Test
  void isInlineSubstitution_atEndOfBuffer() {
    TextStringBuilder buf = new TextStringBuilder("password: ${DB_PASSWORD:-x}");
    assertFalse(YamlSafeSubstitutor.isInlineSubstitution(buf, 10, 27));
  }

  @Test
  void isInlineSubstitution_followedByNewline() {
    TextStringBuilder buf = new TextStringBuilder("password: ${DB_PASSWORD:-x}\n");
    assertFalse(YamlSafeSubstitutor.isInlineSubstitution(buf, 10, 27));
  }

  @Test
  void isInlineSubstitution_atStartOfBuffer() {
    TextStringBuilder buf = new TextStringBuilder("${VAR:-val}");
    assertFalse(YamlSafeSubstitutor.isInlineSubstitution(buf, 0, 11));
  }

  // --- Full YAML round-trip parsing tests ---

  @Test
  void yamlParsing_passwordWithBlockScalarIndicator() throws Exception {
    String password = ">8fYhD>dkcxy#HkVi8~ET";
    String quoted = YamlSafeSubstitutor.quoteIfNeeded(password);
    String yaml = "database:\n  password: " + quoted + "\n";

    Map<String, Object> config = YAML_MAPPER.readValue(yaml, Map.class);
    Map<String, String> db = (Map<String, String>) config.get("database");
    assertEquals(password, db.get("password"));
  }

  @Test
  void yamlParsing_passwordWithBraces() throws Exception {
    String password = "{fa3B]gsTYb";
    String quoted = YamlSafeSubstitutor.quoteIfNeeded(password);
    String yaml = "database:\n  password: " + quoted + "\n";

    Map<String, Object> config = YAML_MAPPER.readValue(yaml, Map.class);
    Map<String, String> db = (Map<String, String>) config.get("database");
    assertEquals(password, db.get("password"));
  }

  @Test
  void yamlParsing_passwordWithEmbeddedQuotesAndBackslashes() throws Exception {
    String password = "p@ss\"w\\ord";
    String quoted = YamlSafeSubstitutor.quoteIfNeeded(password);
    String yaml = "database:\n  password: " + quoted + "\n";

    Map<String, Object> config = YAML_MAPPER.readValue(yaml, Map.class);
    Map<String, String> db = (Map<String, String>) config.get("database");
    assertEquals(password, db.get("password"));
  }

  @Test
  void yamlParsing_normalPasswordRemainsUnquoted() throws Exception {
    String password = "simplePassword123";
    String result = YamlSafeSubstitutor.quoteIfNeeded(password);
    assertEquals(password, result);

    String yaml = "database:\n  password: " + result + "\n";
    Map<String, Object> config = YAML_MAPPER.readValue(yaml, Map.class);
    Map<String, String> db = (Map<String, String>) config.get("database");
    assertEquals(password, db.get("password"));
  }

  // --- Full substitution + YAML parsing round-trip tests ---

  private StringSubstitutor createTestSubstitutor(Map<String, String> vars) {
    return new StringSubstitutor(vars) {
      @Override
      protected String resolveVariable(
          String variableName, TextStringBuilder buf, int startPos, int endPos) {
        String value = super.resolveVariable(variableName, buf, startPos, endPos);
        if (value == null || !YamlSafeSubstitutor.needsYamlQuoting(value)) {
          return value;
        }
        if (YamlSafeSubstitutor.isInlineSubstitution(buf, startPos, endPos)) {
          return value;
        }
        return YamlSafeSubstitutor.yamlDoubleQuote(value);
      }
    };
  }

  @Test
  void fullSubstitution_specialCharPasswordParsesCorrectly() throws Exception {
    StringSubstitutor sub =
        createTestSubstitutor(
            Map.of(
                "DB_PASSWORD", ">8fYhD>dkcxy#HkVi8~ET",
                "DB_HOST", "localhost",
                "DB_PORT", "3306"));

    String template =
        "database:\n"
            + "  host: ${DB_HOST:-localhost}\n"
            + "  port: ${DB_PORT:-3306}\n"
            + "  password: ${DB_PASSWORD:-default}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> db = (Map<String, Object>) config.get("database");
    assertEquals(">8fYhD>dkcxy#HkVi8~ET", db.get("password"));
    assertEquals("localhost", db.get("host"));
    assertEquals(3306, db.get("port"));
  }

  @Test
  void fullSubstitution_bracesPasswordFromIssueComment() throws Exception {
    StringSubstitutor sub = createTestSubstitutor(Map.of("DB_PASSWORD", "{fa3B]gsTYb"));

    String template = "database:\n  password: ${DB_PASSWORD:-default}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> db = (Map<String, Object>) config.get("database");
    assertEquals("{fa3B]gsTYb", db.get("password"));
  }

  @Test
  void fullSubstitution_flowSequencePreserved() throws Exception {
    StringSubstitutor sub = createTestSubstitutor(Map.of("PRINCIPALS", "[admin, user1]"));

    String template = "adminPrincipals: ${PRINCIPALS:-[admin]}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    assertTrue(config.get("adminPrincipals") instanceof List);
    List<String> principals = (List<String>) config.get("adminPrincipals");
    assertEquals(2, principals.size());
    assertEquals("admin", principals.get(0));
    assertEquals("user1", principals.get(1));
  }

  @Test
  void fullSubstitution_booleanValuesRemainUnquoted() throws Exception {
    StringSubstitutor sub = createTestSubstitutor(Map.of("ENABLED", "true", "DISABLED", "false"));

    String template =
        "config:\n" + "  enabled: ${ENABLED:-false}\n" + "  disabled: ${DISABLED:-true}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> inner = (Map<String, Object>) config.get("config");
    assertEquals(true, inner.get("enabled"));
    assertEquals(false, inner.get("disabled"));
  }

  @Test
  void fullSubstitution_numericValuesRemainUnquoted() throws Exception {
    StringSubstitutor sub =
        createTestSubstitutor(Map.of("PORT", "8585", "POOL_SIZE", "100", "TIMEOUT", "30000"));

    String template =
        "server:\n"
            + "  port: ${PORT:-8586}\n"
            + "  poolSize: ${POOL_SIZE:-50}\n"
            + "  timeout: ${TIMEOUT:-5000}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> server = (Map<String, Object>) config.get("server");
    assertEquals(8585, server.get("port"));
    assertEquals(100, server.get("poolSize"));
    assertEquals(30000, server.get("timeout"));
  }

  @Test
  void fullSubstitution_inlineJdbcUrlNotBroken() throws Exception {
    StringSubstitutor sub =
        createTestSubstitutor(
            Map.of(
                "DB_SCHEME", "mysql",
                "DB_HOST", "db.example.com",
                "DB_PORT", "3306",
                "OM_DATABASE", "openmetadata_db",
                "DB_PARAMS", "useSSL=true&serverTimezone=UTC"));

    String template =
        "database:\n"
            + "  url: jdbc:${DB_SCHEME:-mysql}://${DB_HOST:-localhost}:${DB_PORT:-3306}/${OM_DATABASE:-openmetadata_db}?${DB_PARAMS:-allowPublicKeyRetrieval=true}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> db = (Map<String, Object>) config.get("database");
    assertEquals(
        "jdbc:mysql://db.example.com:3306/openmetadata_db?useSSL=true&serverTimezone=UTC",
        db.get("url"));
  }

  @Test
  void fullSubstitution_inlineJdbcUrlWithSpecialCharsInHostNotQuoted() throws Exception {
    // Even if a hostname had a special char (unlikely but defensive), inline should not quote
    StringSubstitutor sub =
        createTestSubstitutor(Map.of("DB_HOST", ">weird-host", "DB_PORT", "3306"));

    String template = "url: jdbc:mysql://${DB_HOST:-localhost}:${DB_PORT:-3306}/db\n";
    String result = sub.replace(template);

    // The >weird-host should NOT be quoted since it's inline in the URL
    assertFalse(result.contains("\""), "Inline value should not have quotes inserted");
    assertEquals("url: jdbc:mysql://>weird-host:3306/db\n", result);
  }

  @Test
  void fullSubstitution_urlValuesNotQuoted() throws Exception {
    StringSubstitutor sub =
        createTestSubstitutor(
            Map.of(
                "API_ENDPOINT", "http://localhost:8080",
                "SERVER_URL", "http://localhost:8585/api"));

    String template =
        "pipeline:\n"
            + "  apiEndpoint: ${API_ENDPOINT:-http://localhost:8080}\n"
            + "  metadataApiEndpoint: ${SERVER_URL:-http://localhost:8585/api}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> pipeline = (Map<String, Object>) config.get("pipeline");
    assertEquals("http://localhost:8080", pipeline.get("apiEndpoint"));
    assertEquals("http://localhost:8585/api", pipeline.get("metadataApiEndpoint"));
  }

  @Test
  void fullSubstitution_base64FernetKeyNotQuoted() throws Exception {
    String fernetKey = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
    StringSubstitutor sub = createTestSubstitutor(Map.of("FERNET_KEY", fernetKey));

    String template = "fernetConfiguration:\n  fernetKey: ${FERNET_KEY:-defaultKey}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> fernet = (Map<String, Object>) config.get("fernetConfiguration");
    assertEquals(fernetKey, fernet.get("fernetKey"));
  }

  @Test
  void fullSubstitution_emptyDefaultsPassThrough() throws Exception {
    // When env var is NOT set, the default after :- is used directly by StringSubstitutor
    // (our quoting does not apply to defaults, only to resolved values)
    StringSubstitutor sub = createTestSubstitutor(Map.of());

    String template =
        "config:\n"
            + "  emptyDefault: ${UNSET_VAR:-}\n"
            + "  quotedEmpty: ${UNSET_VAR2:-\"\"}\n"
            + "  defaultValue: ${UNSET_VAR3:-default}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> inner = (Map<String, Object>) config.get("config");
    // Empty default results in null in YAML
    assertNull(inner.get("emptyDefault"));
    assertEquals("", inner.get("quotedEmpty"));
    assertEquals("default", inner.get("defaultValue"));
  }

  @Test
  void fullSubstitution_elasticsearchPasswordWithSpecialChars() throws Exception {
    StringSubstitutor sub = createTestSubstitutor(Map.of("ES_PASSWORD", "|pipe>arrow#hash"));

    String template =
        "elasticsearch:\n" + "  host: localhost\n" + "  password: ${ES_PASSWORD:-\"\"}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> es = (Map<String, Object>) config.get("elasticsearch");
    assertEquals("|pipe>arrow#hash", es.get("password"));
  }

  @Test
  void fullSubstitution_dropwizardDurationValuesNotQuoted() throws Exception {
    // Dropwizard duration values like "60 seconds", "5 minutes" contain spaces
    // but ": " is the mapping indicator pattern, not just a space
    StringSubstitutor sub =
        createTestSubstitutor(Map.of("IDLE_TIMEOUT", "120 seconds", "EVICTION", "10 minutes"));

    String template =
        "database:\n"
            + "  idleTimeout: ${IDLE_TIMEOUT:-60 seconds}\n"
            + "  evictionInterval: ${EVICTION:-5 minutes}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> db = (Map<String, Object>) config.get("database");
    assertEquals("120 seconds", db.get("idleTimeout"));
    assertEquals("10 minutes", db.get("evictionInterval"));
  }

  @Test
  void fullSubstitution_classNameWithDotsNotQuoted() throws Exception {
    StringSubstitutor sub =
        createTestSubstitutor(
            Map.of("CLASS", "org.openmetadata.service.security.DefaultAuthorizer"));

    String template = "config:\n  className: ${CLASS:-default}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> inner = (Map<String, Object>) config.get("config");
    assertEquals("org.openmetadata.service.security.DefaultAuthorizer", inner.get("className"));
  }

  @Test
  void fullSubstitution_dockerImageWithColonNotQuoted() throws Exception {
    // Docker image references contain ':' but NOT ': ' (colon-space), so they should be safe
    StringSubstitutor sub =
        createTestSubstitutor(
            Map.of("IMAGE", "docker.getcollate.io/openmetadata/ingestion-base:1.5.0"));

    String template = "k8s:\n  ingestionImage: ${IMAGE:-default:latest}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> k8s = (Map<String, Object>) config.get("k8s");
    assertEquals(
        "docker.getcollate.io/openmetadata/ingestion-base:1.5.0", k8s.get("ingestionImage"));
  }

  @Test
  void fullSubstitution_redisUrlNotQuoted() throws Exception {
    StringSubstitutor sub =
        createTestSubstitutor(Map.of("REDIS_URL", "redis://my-cluster.cache.amazonaws.com:6379"));

    String template = "cache:\n  url: ${REDIS_URL:-redis://localhost:6379}\n";
    String result = sub.replace(template);

    Map<String, Object> config = YAML_MAPPER.readValue(result, Map.class);
    Map<String, Object> cache = (Map<String, Object>) config.get("cache");
    assertEquals("redis://my-cluster.cache.amazonaws.com:6379", cache.get("url"));
  }
}
