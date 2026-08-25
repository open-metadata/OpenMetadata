package org.openmetadata.service.rdf.sql2sparql;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.calcite.config.Lex;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.openmetadata.service.exception.BadRequestException;

@Slf4j
public class SqlToSparqlTranslator {

  @Getter private final SqlMappingContext mappingContext;

  private final Cache<String, String> translationCache;

  private static final int CACHE_SIZE = 1000;
  private static final int CACHE_EXPIRY_MINUTES = 60;

  public enum SqlDialect {
    MYSQL(Lex.MYSQL),
    POSTGRESQL(Lex.JAVA), // Calcite uses JAVA lex for standard SQL which PostgreSQL follows
    STANDARD(Lex.JAVA);

    private final Lex lexConfig;

    SqlDialect(Lex lexConfig) {
      this.lexConfig = lexConfig;
    }
  }

  @Getter private final SqlDialect dialect;

  public SqlToSparqlTranslator(SqlMappingContext mappingContext) {
    this(mappingContext, SqlDialect.STANDARD);
  }

  public SqlToSparqlTranslator(SqlMappingContext mappingContext, SqlDialect dialect) {
    this.mappingContext = mappingContext;
    this.dialect = dialect;
    this.translationCache =
        CacheBuilder.newBuilder()
            .maximumSize(CACHE_SIZE)
            .expireAfterWrite(CACHE_EXPIRY_MINUTES, TimeUnit.MINUTES)
            .build();
  }

  public String translate(String sqlQuery) {
    return translationCache
        .asMap()
        .computeIfAbsent(
            sqlQuery,
            sql -> {
              try {
                LOG.debug("Translating SQL to SPARQL: {}", sql);

                // Parse SQL using Calcite with appropriate dialect
                SqlNode sqlNode = parseSql(sql);

                // Build SPARQL using visitor pattern
                SparqlBuilder builder = new SparqlBuilder(mappingContext);
                sqlNode.accept(builder);

                // Generate and validate SPARQL
                String sparql = builder.build();
                validateSparql(sparql);

                LOG.debug("Generated SPARQL: {}", sparql);
                return sparql;

              } catch (Exception e) {
                LOG.error("Failed to translate SQL to SPARQL: {}", sql, e);
                throw new BadRequestException("SQL translation failed: " + e.getMessage());
              }
            });
  }

  private SqlNode parseSql(String sql) throws SqlParseException {
    SqlParser.Config config =
        SqlParser.config().withLex(dialect.lexConfig).withCaseSensitive(false);

    SqlParser parser = SqlParser.create(sql, config);
    return parser.parseQuery();
  }

  private void validateSparql(String sparql) {
    try {
      Query query = QueryFactory.create(sparql);
      if (query.isUnknownType()) {
        throw new BadRequestException("Generated invalid SPARQL query type");
      }
    } catch (Exception e) {
      throw new BadRequestException("Invalid SPARQL generated: " + e.getMessage());
    }
  }

  public void clearCache() {
    translationCache.invalidateAll();
  }
}
