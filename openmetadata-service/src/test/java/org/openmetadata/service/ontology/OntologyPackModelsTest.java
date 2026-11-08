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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Entry;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Snapshot;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;

class OntologyPackModelsTest {
  private final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
  private final OntologyPackModels models =
      new OntologyPackModels(new OntologyPackContentLoader(getClass().getClassLoader()));
  private final Ontology root =
      new Ontology()
          .withId(UUID.randomUUID())
          .withName("library")
          .withFullyQualifiedName("library");
  private final Snapshot emptySnapshot =
      new Snapshot(
          new OntologyState().withOntologyId(root.getId()).withWorkingRevision(0L),
          List.of(new Entry(MemberKind.ONTOLOGY, root)));

  @BeforeAll
  static void registerOntologyType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(Entity.ONTOLOGY, Entity.ONTOLOGY);
  }

  @Test
  void readingModulesOneByOneYieldsTheSamePlanAsTheJoinedBodyOfEveryBundledPack() {
    for (final var manifest : catalog.list()) {
      final List<OntologyPackModule> modules = manifest.getModules();
      final List<String> ids = modules.stream().map(OntologyPackModule::getId).toList();

      final List<OntologyChangeOperation> perModule = reconcilePerModule(modules);
      final List<OntologyChangeOperation> joined = reconcileJoined(manifest.getId(), ids);

      assertFalse(perModule.isEmpty(), manifest.getId());
      assertEquals(
          OntologyPackSlicePlan.sliceDigest(joined),
          OntologyPackSlicePlan.sliceDigest(perModule),
          manifest.getId());
    }
  }

  @Test
  void refusesAModuleWhoseChecksumDoesNotMatchTheCatalogue() {
    final OntologyPackModule tampered =
        JsonUtils.deepCopy(
                catalog.require("fhir").getModules().getFirst(), OntologyPackModule.class)
            .withSha256("0".repeat(64));

    assertThrows(IllegalStateException.class, () -> models.load(List.of(tampered)));
  }

  private List<OntologyChangeOperation> reconcilePerModule(final List<OntologyPackModule> modules) {
    final var model = models.load(modules);
    try {
      return new NativeOntologyRdfImporter()
          .reconcileUnbounded(model, emptySnapshot)
          .getOperations();
    } finally {
      model.close();
    }
  }

  private List<OntologyChangeOperation> reconcileJoined(
      final String packId, final List<String> moduleIds) {
    final var selected = catalog.loadSelected(packId, moduleIds);
    final var importer = new NativeOntologyRdfImporter();
    final var model =
        importer.parse(selected.body(), RdfSerializationFormat.parse(selected.format()));
    try {
      return importer.reconcile(model, emptySnapshot).getOperations();
    } finally {
      model.close();
    }
  }
}
