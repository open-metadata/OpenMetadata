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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;
import org.openmetadata.schema.api.data.OntologyBulkFindReplace;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkRetypeRelationships;
import org.openmetadata.schema.entity.data.Glossary;

final class OntologyBulkRequestValidator {
  static final int MAXIMUM_CSV_BYTES = 20 * 1024 * 1024;

  void validate(final Glossary glossary, final OntologyBulkRequest request) {
    requireRequestIdentity(glossary, request);
    requireWritable(glossary);
    requireChangeSetMetadata(request);
    switch (request.getOperation()) {
      case CSV_UPSERT -> requireCsvPayload(request);
      case FIND_REPLACE -> requireFindReplacePayload(request);
      case RETYPE_RELATIONSHIPS -> requireRetypePayload(request);
    }
  }

  private static void requireRequestIdentity(
      final Glossary glossary, final OntologyBulkRequest request) {
    final boolean isInvalid =
        request == null
            || request.getGlossaryId() == null
            || request.getOperation() == null
            || request.getDryRun() == null
            || !glossary.getId().equals(request.getGlossaryId());
    if (isInvalid) {
      throw new BadRequestException("Ontology bulk request does not match the target glossary");
    }
  }

  private static void requireWritable(final Glossary glossary) {
    final boolean isReadOnly =
        glossary.getOntologyConfiguration() == null
            || Boolean.TRUE.equals(glossary.getOntologyConfiguration().getReadOnly());
    if (isReadOnly) {
      throw new BadRequestException(
          "Ontology bulk authoring requires a writable configured glossary");
    }
  }

  private static void requireChangeSetMetadata(final OntologyBulkRequest request) {
    final boolean isInvalid =
        isBlank(request.getChangeSetName()) || isBlank(request.getChangeSetDescription());
    if (isInvalid) {
      throw new BadRequestException(
          "Ontology bulk authoring requires a change-set name and description");
    }
  }

  private static void requireCsvPayload(final OntologyBulkRequest request) {
    final int csvBytes =
        nullOrEmpty(request.getCsv())
            ? 0
            : request.getCsv().getBytes(StandardCharsets.UTF_8).length;
    final boolean isInvalid =
        csvBytes == 0
            || csvBytes > MAXIMUM_CSV_BYTES
            || request.getFindReplace() != null
            || request.getRetype() != null;
    if (isInvalid) {
      throw new BadRequestException(
          "CSV_UPSERT requires one UTF-8 CSV payload no larger than 20 MiB");
    }
  }

  private static void requireFindReplacePayload(final OntologyBulkRequest request) {
    final OntologyBulkFindReplace payload = request.getFindReplace();
    final boolean isInvalid =
        payload == null
            || payload.getField() == null
            || payload.getMatchMode() == null
            || payload.getCaseSensitive() == null
            || isBlank(payload.getFind())
            || payload.getReplacement() == null
            || request.getCsv() != null
            || request.getRetype() != null;
    if (isInvalid) {
      throw new BadRequestException("FIND_REPLACE requires exactly one typed replacement payload");
    }
  }

  private static void requireRetypePayload(final OntologyBulkRequest request) {
    final OntologyBulkRetypeRelationships payload = request.getRetype();
    final boolean isInvalid =
        payload == null
            || payload.getFromRelationshipTypeId() == null
            || payload.getToRelationshipTypeId() == null
            || payload.getFromRelationshipTypeId().equals(payload.getToRelationshipTypeId())
            || request.getCsv() != null
            || request.getFindReplace() != null;
    if (isInvalid) {
      throw new BadRequestException(
          "RETYPE_RELATIONSHIPS requires different source and target types");
    }
  }

  private static boolean isBlank(final String value) {
    return nullOrEmpty(value) || value.isBlank();
  }
}
