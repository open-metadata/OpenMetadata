/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Collectors;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;

public final class LineMapWriter {
  private LineMapWriter() {}

  public static String render() {
    final StringBuilder sb = new StringBuilder();
    sb.append("# Entity Index Line-Map (generated)\n\n");
    sb.append(
        "> Observed on Elasticsearch 9.3 (self-hosted testcontainer). Outcomes are engine-agnostic for\n");
    sb.append(
        "> self-hosted ES / self-hosted OpenSearch (same defaults: total_fields=1000, nested_objects=10000,\n");
    sb.append(
        "> 100 MB http content limit, ignore_above per mapping). The OpenSearch column is PREDICTED from the\n");
    sb.append(
        "> same functions, not independently observed — run with `-DsearchType=opensearch` to validate it.\n");
    sb.append(
        "> Note: AWS-managed OpenSearch's 10 MB http.max_content_length would additionally reject the >= 16 MB\n");
    sb.append(
        "> description / very large docs that pass here under the self-hosted 100 MB default.\n\n");
    sb.append("| Entity | Dimension | Rung | Elasticsearch | OpenSearch |\n");
    sb.append("|--------|-----------|------|---------------|------------|\n");
    sb.append(
        new EntityShapeRegistry()
            .plannedCases().stream()
                .map(
                    c ->
                        "| "
                            + c.entityType()
                            + " | "
                            + c.dimension()
                            + " | "
                            + c.rung().label()
                            + " | "
                            + c.expected().apply(SearchType.ELASTICSEARCH)
                            + " | "
                            + c.expected().apply(SearchType.OPENSEARCH)
                            + " |")
                .collect(Collectors.joining("\n")));
    sb.append("\n");
    return sb.toString();
  }

  public static void writeTo(final Path path) throws IOException {
    Files.writeString(path, render());
  }
}
