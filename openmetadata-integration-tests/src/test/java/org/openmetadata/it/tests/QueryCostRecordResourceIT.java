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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * {@code GET /v1/queryCostRecord/{id}} resolves the record and then dereferences it to scope its
 * authorization check at {@code costRecord.getQueryReference().getId()}. Because
 * {@code EntityTimeSeriesRepository.getById} answers a missing row with {@code null}, an id with no
 * row used to raise a NullPointerException that the exception mapper rendered as a 500.
 */
@Execution(ExecutionMode.CONCURRENT)
public class QueryCostRecordResourceIT {

  @Test
  void byIdEndpointReturnsNotFoundForUnknownId() {
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.GET,
                        "/v1/queryCostRecord/" + UUID.randomUUID(),
                        null,
                        RequestOptions.builder().build()));
    assertEquals(
        404, error.getStatusCode(), "an id with no row must be a 404, not a NullPointerException");
  }
}
