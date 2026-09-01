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
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.OntologyPrefix;
import org.openmetadata.service.Entity;

class OntologyLayerValidatorTest {
  private static final UUID L1_ID = UUID.fromString("2ad315aa-e630-4aad-88d1-b3b549aa7225");
  private static final UUID L2_ID = UUID.fromString("a92958c9-8703-43fc-adf1-cd7e37798af3");
  private static final UUID L3_ID = UUID.fromString("5aed4cc9-885b-43a7-b6ae-cff8a7c12346");

  @Test
  void suppliesDurableDefaults() {
    Glossary glossary = new Glossary().withId(L3_ID).withName("Commerce");
    OntologyLayerValidator validator = new OntologyLayerValidator(id -> glossary);

    validator.applyDefaultsAndValidate(glossary);

    assertEquals(OntologyLayer.L_3, glossary.getOntologyConfiguration().getLayer());
    assertEquals(
        URI.create("https://open-metadata.org/ontology/" + L3_ID + '/'),
        glossary.getOntologyConfiguration().getBaseIri());
    assertEquals("{term}", glossary.getOntologyConfiguration().getIriMintingPattern());
  }

  @Test
  void rejectsDependencyOnLessFoundationalLayer() {
    Glossary imported = model(L2_ID, "Business", OntologyLayer.L_2, List.of());
    Glossary source = model(L1_ID, "Foundation", OntologyLayer.L_1, List.of(reference(imported)));
    OntologyLayerValidator validator = validator(source, imported);

    assertThrows(BadRequestException.class, () -> validator.applyDefaultsAndValidate(source));
  }

  @Test
  void rejectsImportCycle() {
    Glossary first = model(L2_ID, "Business", OntologyLayer.L_2, List.of());
    Glossary second = model(L3_ID, "Application", OntologyLayer.L_3, List.of(reference(first)));
    first.getOntologyConfiguration().setImports(List.of(reference(second)));
    OntologyLayerValidator validator = validator(first, second);

    assertThrows(BadRequestException.class, () -> validator.applyDefaultsAndValidate(second));
  }

  @Test
  void rejectsDuplicateNamespaceAliases() {
    OntologyPrefix first = prefix("ex", "https://example.org/");
    OntologyPrefix duplicate = prefix("ex", "https://other.example.org/");
    Glossary glossary = model(L3_ID, "Application", OntologyLayer.L_3, List.of());
    glossary.getOntologyConfiguration().setPrefixes(List.of(first, duplicate));
    OntologyLayerValidator validator = validator(glossary);

    assertThrows(BadRequestException.class, () -> validator.applyDefaultsAndValidate(glossary));
  }

  @Test
  void rejectsPrefixNamesThatDifferOnlyByCase() {
    OntologyPrefix first = prefix("ex", "https://example.org/");
    OntologyPrefix duplicate = prefix("EX", "https://other.example.org/");
    Glossary glossary = model(L3_ID, "Application", OntologyLayer.L_3, List.of());
    glossary.getOntologyConfiguration().setPrefixes(List.of(first, duplicate));
    OntologyLayerValidator validator = validator(glossary);

    assertThrows(BadRequestException.class, () -> validator.applyDefaultsAndValidate(glossary));
  }

  private static OntologyLayerValidator validator(final Glossary... glossaries) {
    return new OntologyLayerValidator(
        id ->
            List.of(glossaries).stream()
                .filter(glossary -> glossary.getId().equals(id))
                .findFirst()
                .orElseThrow());
  }

  private static Glossary model(
      final UUID id,
      final String name,
      final OntologyLayer layer,
      final List<EntityReference> imports) {
    OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withLayer(layer)
            .withImports(imports)
            .withPrefixes(List.of())
            .withIriMintingPattern("{term}")
            .withReadOnly(false);
    return new Glossary().withId(id).withName(name).withOntologyConfiguration(configuration);
  }

  private static EntityReference reference(final Glossary glossary) {
    return new EntityReference()
        .withId(glossary.getId())
        .withType(Entity.GLOSSARY)
        .withName(glossary.getName());
  }

  private static OntologyPrefix prefix(final String name, final String namespace) {
    return new OntologyPrefix().withPrefix(name).withNamespace(URI.create(namespace));
  }
}
