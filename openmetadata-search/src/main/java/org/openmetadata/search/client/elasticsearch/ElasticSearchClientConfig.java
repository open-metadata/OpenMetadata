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

package org.openmetadata.search.client.elasticsearch;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ElasticSearchClientConfig {
  private List<String> hosts;
  private String username;
  private String password;
  private String clusterAlias;
  private boolean useSsl;
  private TrustStoreConfig trustStoreConfig;

  @Builder.Default private long connectionTimeoutMillis = 30000L;

  @Builder.Default private long socketTimeoutMillis = 60000L;

  @Builder.Default private int batchSize = 100;

  @Data
  @Builder
  public static class TrustStoreConfig {
    private String trustStorePath;
    private String trustStorePassword;
    private String trustStoreType;
  }
}
