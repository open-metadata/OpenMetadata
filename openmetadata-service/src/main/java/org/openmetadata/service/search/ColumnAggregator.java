/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import org.openmetadata.schema.api.data.ColumnGridResponse;

public interface ColumnAggregator {

  ColumnGridResponse aggregateColumns(ColumnAggregationRequest request) throws IOException;

  class ColumnAggregationRequest {
    private int size = 1000;
    private String cursor;
    private String columnNamePattern;
    private List<String> entityTypes;
    private String serviceName;
    private List<String> serviceTypes;
    private String databaseName;
    private String schemaName;
    private String domainId;
    private Boolean hasConflicts;
    private Boolean hasMissingMetadata;
    private String metadataStatus;
    private List<String> tags;
    private List<String> glossaryTerms;

    public int getSize() {
      return size;
    }

    public void setSize(int size) {
      this.size = size;
    }

    public String getCursor() {
      return cursor;
    }

    public void setCursor(String cursor) {
      this.cursor = cursor;
    }

    public String getColumnNamePattern() {
      return columnNamePattern;
    }

    public void setColumnNamePattern(String columnNamePattern) {
      this.columnNamePattern = columnNamePattern;
    }

    public List<String> getEntityTypes() {
      return entityTypes;
    }

    public void setEntityTypes(List<String> entityTypes) {
      this.entityTypes = entityTypes;
    }

    public String getServiceName() {
      return serviceName;
    }

    public void setServiceName(String serviceName) {
      this.serviceName = serviceName;
    }

    public List<String> getServiceTypes() {
      return serviceTypes;
    }

    public void setServiceTypes(List<String> serviceTypes) {
      this.serviceTypes = serviceTypes;
    }

    public String getDatabaseName() {
      return databaseName;
    }

    public void setDatabaseName(String databaseName) {
      this.databaseName = databaseName;
    }

    public String getSchemaName() {
      return schemaName;
    }

    public void setSchemaName(String schemaName) {
      this.schemaName = schemaName;
    }

    public String getDomainId() {
      return domainId;
    }

    public void setDomainId(String domainId) {
      this.domainId = domainId;
    }

    public Boolean getHasConflicts() {
      return hasConflicts;
    }

    public void setHasConflicts(Boolean hasConflicts) {
      this.hasConflicts = hasConflicts;
    }

    public Boolean getHasMissingMetadata() {
      return hasMissingMetadata;
    }

    public void setHasMissingMetadata(Boolean hasMissingMetadata) {
      this.hasMissingMetadata = hasMissingMetadata;
    }

    public String getMetadataStatus() {
      return metadataStatus;
    }

    public void setMetadataStatus(String metadataStatus) {
      this.metadataStatus = metadataStatus;
    }

    public List<String> getTags() {
      return tags;
    }

    public void setTags(List<String> tags) {
      this.tags = tags;
    }

    public List<String> getGlossaryTerms() {
      return glossaryTerms;
    }

    public void setGlossaryTerms(List<String> glossaryTerms) {
      this.glossaryTerms = glossaryTerms;
    }
  }
}
