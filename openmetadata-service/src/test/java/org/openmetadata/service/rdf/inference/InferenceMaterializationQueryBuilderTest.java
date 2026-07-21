/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.rdf.inference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.update.UpdateFactory;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;

class InferenceMaterializationQueryBuilderTest {
  private static final String SOURCE = "urn:source";
  private static final String SOURCE_PREDICATE = "urn:source-predicate";
  private static final String TARGET_PREDICATE = "urn:target-predicate";
  private static final String GRAPH = "https://open-metadata.org/graph/inferred/test-rule";

  @Test
  void rewritesConstructIntoClearAndNamedGraphInsert() {
    final String update = InferenceMaterializationQueryBuilder.build(status());

    assertEquals(2, UpdateFactory.create(update).getOperations().size());
    assertTrue(update.contains("CLEAR SILENT GRAPH <" + GRAPH + ">"));
    assertTrue(update.contains("GRAPH <" + GRAPH + ">"));
  }

  @Test
  void updateMaterializesIntoTargetGraph() {
    final Dataset dataset = DatasetFactory.createTxnMem();
    final Model source = dataset.getDefaultModel();
    source.add(
        ResourceFactory.createResource(SOURCE),
        ResourceFactory.createProperty(SOURCE_PREDICATE),
        ResourceFactory.createResource("urn:object"));

    UpdateAction.parseExecute(InferenceMaterializationQueryBuilder.build(status()), dataset);

    final Model inferred = dataset.getNamedModel(GRAPH);
    assertTrue(
        inferred.contains(
            ResourceFactory.createResource(SOURCE),
            ResourceFactory.createProperty(TARGET_PREDICATE)));
    dataset.close();
  }

  private static InferenceRuleStatus status() {
    final InferenceRule rule =
        new InferenceRule()
            .withName("test-rule")
            .withRuleType(InferenceRule.RuleType.CONSTRUCT)
            .withRuleBody(
                "CONSTRUCT { ?subject <urn:target-predicate> ?object } "
                    + "WHERE { ?subject <urn:source-predicate> ?object }")
            .withEnabled(true);
    return new InferenceRuleStatus().withRule(rule).withGraphUri(URI.create(GRAPH));
  }
}
