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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.OntologyPrefix;
import org.openmetadata.service.Entity;

public final class OntologyLayerValidator {
  private static final String DEFAULT_IRI_ROOT = "https://open-metadata.org/ontology/";
  private static final String DEFAULT_MINTING_PATTERN = "{term}";
  private final Function<UUID, Glossary> glossaryResolver;

  public OntologyLayerValidator(final Function<UUID, Glossary> glossaryResolver) {
    this.glossaryResolver = glossaryResolver;
  }

  public void applyDefaultsAndValidate(final Glossary glossary) {
    final OntologyConfiguration configuration = configuration(glossary);
    applyDefaults(glossary, configuration);
    OntologyIriMinter.validateConfiguration(configuration);
    validateImports(glossary, configuration);
    validatePrefixes(configuration.getPrefixes());
    glossary.setOntologyConfiguration(configuration);
  }

  private static OntologyConfiguration configuration(final Glossary glossary) {
    final OntologyConfiguration configuration =
        glossary.getOntologyConfiguration() == null
            ? new OntologyConfiguration()
            : glossary.getOntologyConfiguration();
    return configuration;
  }

  private static void applyDefaults(
      final Glossary glossary, final OntologyConfiguration configuration) {
    configuration.setLayer(
        configuration.getLayer() == null ? OntologyLayer.L_3 : configuration.getLayer());
    configuration.setImports(List.copyOf(listOrEmpty(configuration.getImports())));
    configuration.setInstalledPacks(List.copyOf(listOrEmpty(configuration.getInstalledPacks())));
    configuration.setPrefixes(List.copyOf(listOrEmpty(configuration.getPrefixes())));
    configuration.setIriMintingPattern(
        configuration.getIriMintingPattern() == null
            ? DEFAULT_MINTING_PATTERN
            : configuration.getIriMintingPattern());
    configuration.setReadOnly(Boolean.TRUE.equals(configuration.getReadOnly()));
    configuration.setBaseIri(
        configuration.getBaseIri() == null
            ? defaultBaseIri(glossary.getId())
            : configuration.getBaseIri());
  }

  private static URI defaultBaseIri(final UUID glossaryId) {
    return URI.create(DEFAULT_IRI_ROOT + glossaryId + '/');
  }

  private void validateImports(final Glossary glossary, final OntologyConfiguration configuration) {
    final Set<UUID> importedIds = new HashSet<>();
    for (final EntityReference importReference : configuration.getImports()) {
      validateImportReference(glossary, configuration.getLayer(), importReference, importedIds);
    }
  }

  private void validateImportReference(
      final Glossary glossary,
      final OntologyLayer sourceLayer,
      final EntityReference importReference,
      final Set<UUID> importedIds) {
    requireGlossaryReference(glossary, importReference, importedIds);
    final Glossary imported = glossaryResolver.apply(importReference.getId());
    final OntologyLayer importedLayer = layerOf(imported);
    requireUpwardDependency(glossary, sourceLayer, imported, importedLayer);
    requireAcyclicDependency(glossary, imported);
  }

  private static void requireGlossaryReference(
      final Glossary glossary, final EntityReference importReference, final Set<UUID> importedIds) {
    final boolean isInvalid =
        importReference == null
            || importReference.getId() == null
            || !Entity.GLOSSARY.equals(importReference.getType());
    if (isInvalid) {
      throw new BadRequestException(
          "Ontology imports for glossary '" + glossary.getName() + "' must reference glossaries");
    }
    if (glossary.getId().equals(importReference.getId())
        || !importedIds.add(importReference.getId())) {
      throw new BadRequestException(
          "Ontology imports for glossary '"
              + glossary.getName()
              + "' must be unique and cannot reference itself");
    }
  }

  private static OntologyLayer layerOf(final Glossary glossary) {
    final OntologyConfiguration configuration = glossary.getOntologyConfiguration();
    final OntologyLayer layer =
        configuration == null || configuration.getLayer() == null
            ? OntologyLayer.L_3
            : configuration.getLayer();
    return layer;
  }

  private static void requireUpwardDependency(
      final Glossary source,
      final OntologyLayer sourceLayer,
      final Glossary imported,
      final OntologyLayer importedLayer) {
    if (layerRank(importedLayer) > layerRank(sourceLayer)) {
      throw new BadRequestException(
          "Ontology '"
              + source.getName()
              + "' in "
              + sourceLayer
              + " cannot import less foundational ontology '"
              + imported.getName()
              + "' in "
              + importedLayer);
    }
  }

  private void requireAcyclicDependency(final Glossary source, final Glossary imported) {
    if (imports(imported, source.getId(), new HashSet<>())) {
      throw new BadRequestException(
          "Ontology import from '"
              + source.getName()
              + "' to '"
              + imported.getName()
              + "' creates a cycle");
    }
  }

  private boolean imports(
      final Glossary current, final UUID targetId, final Set<UUID> visitedGlossaryIds) {
    boolean found = current.getId().equals(targetId);
    if (!found && visitedGlossaryIds.add(current.getId())) {
      for (final EntityReference reference : importsOf(current)) {
        found =
            found
                || imports(glossaryResolver.apply(reference.getId()), targetId, visitedGlossaryIds);
      }
    }
    return found;
  }

  private static List<EntityReference> importsOf(final Glossary glossary) {
    final OntologyConfiguration configuration = glossary.getOntologyConfiguration();
    final List<EntityReference> imports =
        configuration == null ? List.of() : listOrEmpty(configuration.getImports());
    return imports;
  }

  private static int layerRank(final OntologyLayer layer) {
    final int rank =
        switch (layer) {
          case L_1 -> 1;
          case L_2 -> 2;
          case L_3 -> 3;
        };
    return rank;
  }

  private static void validatePrefixes(final List<OntologyPrefix> prefixes) {
    final Set<String> names = new HashSet<>();
    final Set<URI> namespaces = new HashSet<>();
    for (final OntologyPrefix prefix : prefixes) {
      requireValidPrefix(prefix);
      final String normalizedName = prefix.getPrefix().toLowerCase(Locale.ROOT);
      if (!names.add(normalizedName) || !namespaces.add(prefix.getNamespace().normalize())) {
        throw new BadRequestException("Ontology prefixes and namespaces must be unique");
      }
    }
  }

  private static void requireValidPrefix(final OntologyPrefix prefix) {
    final boolean isInvalid =
        prefix == null
            || prefix.getPrefix() == null
            || prefix.getPrefix().isBlank()
            || prefix.getNamespace() == null
            || !prefix.getNamespace().isAbsolute();
    if (isInvalid) {
      throw new BadRequestException("Ontology prefixes require a name and an absolute namespace");
    }
  }
}
