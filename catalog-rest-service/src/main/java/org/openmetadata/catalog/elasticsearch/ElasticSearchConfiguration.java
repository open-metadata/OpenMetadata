/// *
// *  Copyright 2021 Collate
// *  Licensed under the Apache License, Version 2.0 (the "License");
// *  you may not use this file except in compliance with the License.
// *  You may obtain a copy of the License at
// *  http://www.apache.org/licenses/LICENSE-2.0
// *  Unless required by applicable law or agreed to in writing, software
// *  distributed under the License is distributed on an "AS IS" BASIS,
// *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// *  See the License for the specific language governing permissions and
// *  limitations under the License.
// */
//
// package org.openmetadata.catalog.elasticsearch;
//
// import javax.validation.constraints.NotEmpty;
// import lombok.Getter;
// import lombok.Setter;
//
// public class ElasticSearchConfiguration {
//  @NotEmpty @Getter @Setter private String host;
//  @NotEmpty @Getter @Setter private Integer port;
//  @Getter @Setter private String username;
//  @Getter @Setter private String password;
//  @Getter @Setter private String scheme;
//  @Getter @Setter private String truststorePath;
//  @Getter @Setter private String truststorePassword;
//  @Getter @Setter private Integer connectionTimeoutSecs = 5;
//  @Getter @Setter private Integer socketTimeoutSecs = 60;
//  @Getter @Setter private Integer batchSize = 10;
//
//  @Override
//  public String toString() {
//    return "ElasticSearchConfiguration{"
//        + "host='"
//        + host
//        + '\''
//        + ", port="
//        + port
//        + ", username='"
//        + username
//        + '\''
//        + '}';
//  }
// }
