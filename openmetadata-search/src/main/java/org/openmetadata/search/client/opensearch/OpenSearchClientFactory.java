/*
 *  Copyright 2021 Collate
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

package org.openmetadata.search.client.opensearch;

import java.io.IOException;
import java.util.Arrays;
import lombok.experimental.UtilityClass;
import org.openmetadata.search.client.SearchClient;

@UtilityClass
public class OpenSearchClientFactory {

  public static SearchClient create(
      String hosts, String username, String password, String clusterAlias, boolean useSsl)
      throws IOException {

    OpenSearchClientConfig config =
        OpenSearchClientConfig.builder()
            .hosts(Arrays.asList(hosts.split(",")))
            .username(username)
            .password(password)
            .clusterAlias(clusterAlias)
            .useSsl(useSsl)
            .build();

    OpenSearchClient client = new OpenSearchClient(config);
    client.initialize();

    return client;
  }

  public static SearchClient create(OpenSearchClientConfig config) throws IOException {
    OpenSearchClient client = new OpenSearchClient(config);
    client.initialize();

    return client;
  }
}
