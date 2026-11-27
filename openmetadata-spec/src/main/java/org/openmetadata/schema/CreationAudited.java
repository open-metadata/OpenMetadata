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

package org.openmetadata.schema;

/**
 * Implemented by entities that record who first created them in OpenMetadata and when — the
 * creation-side counterpart to {@code updatedAt}/{@code updatedBy} on {@link EntityInterface}.
 *
 * <p>Entities opt in by listing this alongside {@code EntityInterface} in their schema's
 * {@code javaInterfaces}; the accessors below are then generated from the schema's
 * {@code createdAt}/{@code createdBy} properties.
 *
 * <p>These accessors deliberately live here rather than on {@code EntityInterface}: {@code Task}
 * already declares a required {@code createdBy} of type {@code EntityReference}, so a
 * {@code String getCreatedBy()} on the base interface would not compile. Keeping the contract
 * narrow lets entities adopt the audit fields without changing Task's published API.
 */
public interface CreationAudited {

  Long getCreatedAt();

  String getCreatedBy();

  void setCreatedAt(Long createdAt);

  void setCreatedBy(String createdBy);
}
