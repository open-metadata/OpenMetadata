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

import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkRowError;
import org.openmetadata.service.ontology.OntologyBulkCsvParser.CsvRow;

final class OntologyBulkCsvValueParser {
  private static final Pattern UUID_PATTERN =
      Pattern.compile(
          "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");

  private OntologyBulkCsvValueParser() {}

  static URIValue iri(final String value, final CsvRow row) {
    URI uri = null;
    OntologyBulkRowError error = null;
    if (!nullOrEmpty(value)) {
      try {
        uri = new URI(value);
        if (!uri.isAbsolute()) {
          error = error(row, OntologyBulkErrorCode.INVALID_IRI, "IRI must be absolute");
        }
      } catch (URISyntaxException exception) {
        error = error(row, OntologyBulkErrorCode.INVALID_IRI, exception.getMessage());
      }
    }
    return new URIValue(uri, error);
  }

  static UUIDValue uuid(
      final String value, final boolean required, final CsvRow row, final String fieldName) {
    final boolean isMissing = nullOrEmpty(value);
    final boolean isInvalid = !isMissing && !UUID_PATTERN.matcher(value).matches();
    final UUID parsed = !isMissing && !isInvalid ? UUID.fromString(value) : null;
    final OntologyBulkRowError error =
        (required && isMissing) || isInvalid
            ? error(
                row,
                isMissing
                    ? OntologyBulkErrorCode.MISSING_REQUIRED_VALUE
                    : OntologyBulkErrorCode.INVALID_IDENTIFIER,
                fieldName + " must be a UUID")
            : null;
    return new UUIDValue(parsed, error);
  }

  private static OntologyBulkRowError error(
      final CsvRow row, final OntologyBulkErrorCode code, final String message) {
    return OntologyBulkPlanningErrors.error(row.rowNumber(), code, message, null, null);
  }

  record UUIDValue(UUID value, OntologyBulkRowError error) {}

  record URIValue(URI value, OntologyBulkRowError error) {}
}
