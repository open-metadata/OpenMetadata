package org.openmetadata.service.rdf;

import java.util.List;
import java.util.Set;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.SortCondition;
import org.apache.jena.sparql.algebra.Algebra;
import org.apache.jena.sparql.algebra.Op;
import org.apache.jena.sparql.algebra.OpVisitorBase;
import org.apache.jena.sparql.algebra.op.OpBGP;
import org.apache.jena.sparql.algebra.op.OpDatasetNames;
import org.apache.jena.sparql.algebra.op.OpGraph;
import org.apache.jena.sparql.algebra.op.OpGroup;
import org.apache.jena.sparql.algebra.op.OpOrder;
import org.apache.jena.sparql.algebra.op.OpPath;
import org.apache.jena.sparql.algebra.op.OpProcedure;
import org.apache.jena.sparql.algebra.op.OpPropFunc;
import org.apache.jena.sparql.algebra.op.OpQuadBlock;
import org.apache.jena.sparql.algebra.op.OpQuadPattern;
import org.apache.jena.sparql.algebra.op.OpService;
import org.apache.jena.sparql.algebra.op.OpTopN;
import org.apache.jena.sparql.algebra.op.OpTriple;
import org.apache.jena.sparql.algebra.walker.Walker;
import org.apache.jena.sparql.expr.E_Call;
import org.apache.jena.sparql.expr.E_Function;
import org.apache.jena.sparql.expr.ExprAggregator;
import org.apache.jena.sparql.expr.ExprFunctionN;
import org.apache.jena.sparql.expr.ExprFunctionOp;
import org.apache.jena.sparql.expr.ExprVisitorBase;
import org.apache.jena.sparql.path.P_Link;
import org.apache.jena.sparql.pfunction.PropertyFunctionRegistry;

/**
 * Experiment-only query profile for a sanitized model: SELECT or ASK over the default graph, with
 * no construct that can read outside the model (SERVICE, GRAPH, FROM, property or extension
 * functions).
 */
final class SanitizedQueryProfile {
  private static final Set<String> PROPERTY_FUNCTION_PREFIXES =
      Set.of("http://jena.apache.org/ARQ/", "http://jena.apache.org/text#", "java:");

  private SanitizedQueryProfile() {}

  static Query requireSupported(final String sparql) {
    final Query query = parse(sparql);
    requireSelectOrAsk(query);
    requireNoDatasetDescription(query);
    requireConfined(Algebra.compile(query));
    return query;
  }

  private static Query parse(final String sparql) {
    try {
      return QueryFactory.create(sparql);
    } catch (QueryException exception) {
      throw new IllegalArgumentException("Invalid SPARQL: " + exception.getMessage(), exception);
    }
  }

  private static void requireSelectOrAsk(final Query query) {
    if (!query.isSelectType() && !query.isAskType()) {
      throw new IllegalArgumentException("Only SELECT and ASK are supported");
    }
  }

  private static void requireNoDatasetDescription(final Query query) {
    if (!query.getGraphURIs().isEmpty() || !query.getNamedGraphURIs().isEmpty()) {
      throw new IllegalArgumentException("FROM and FROM NAMED are not supported");
    }
  }

  private static void requireConfined(final Op op) {
    Walker.walk(op, new ConfinedOpVisitor(), new ConfinedExprVisitor());
  }

  private static void reject(final String construct) {
    throw new IllegalArgumentException(construct + " is not supported over a sanitized model");
  }

  private static void requirePlainPredicate(final Node predicate) {
    if (predicate.isURI() && isPropertyFunction(predicate.getURI())) {
      reject("Property function " + predicate.getURI());
    }
  }

  private static boolean isPropertyFunction(final String uri) {
    return PropertyFunctionRegistry.get().isRegistered(uri)
        || PROPERTY_FUNCTION_PREFIXES.stream().anyMatch(uri::startsWith);
  }

  private static void requireConfined(final List<SortCondition> conditions) {
    for (SortCondition condition : conditions) {
      Walker.walk(condition.getExpression(), new ConfinedExprVisitor());
    }
  }

  private static final class ConfinedOpVisitor extends OpVisitorBase {
    @Override
    public void visit(final OpOrder op) {
      requireConfined(op.getConditions());
    }

    @Override
    public void visit(final OpTopN op) {
      requireConfined(op.getConditions());
    }

    @Override
    public void visit(final OpGroup op) {
      Walker.walk(op.getGroupVars(), new ConfinedExprVisitor());
      for (ExprAggregator aggregator : op.getAggregators()) {
        if (aggregator.getAggregator().getExprList() != null) {
          Walker.walk(aggregator.getAggregator().getExprList(), new ConfinedExprVisitor());
        }
      }
    }

    @Override
    public void visit(final OpService op) {
      reject("SERVICE");
    }

    @Override
    public void visit(final OpGraph op) {
      reject("GRAPH");
    }

    @Override
    public void visit(final OpQuadPattern op) {
      reject("GRAPH");
    }

    @Override
    public void visit(final OpQuadBlock op) {
      reject("GRAPH");
    }

    @Override
    public void visit(final OpDatasetNames op) {
      reject("GRAPH");
    }

    @Override
    public void visit(final OpPropFunc op) {
      reject("Property function");
    }

    @Override
    public void visit(final OpProcedure op) {
      reject("Procedure");
    }

    @Override
    public void visit(final OpBGP op) {
      for (Triple triple : op.getPattern()) {
        requirePlainPredicate(triple.getPredicate());
      }
    }

    @Override
    public void visit(final OpTriple op) {
      requirePlainPredicate(op.getTriple().getPredicate());
    }

    @Override
    public void visit(final OpPath op) {
      // ARQ only binds property functions to plain predicates, never inside complex paths.
      if (op.getTriplePath().getPath() instanceof P_Link link) {
        requirePlainPredicate(link.getNode());
      }
    }
  }

  private static final class ConfinedExprVisitor extends ExprVisitorBase {
    @Override
    public void visit(final ExprFunctionN function) {
      if (function instanceof E_Function || function instanceof E_Call) {
        reject("Extension function");
      }
    }

    @Override
    public void visit(final ExprFunctionOp function) {
      requireConfined(function.getGraphPattern());
    }
  }
}
