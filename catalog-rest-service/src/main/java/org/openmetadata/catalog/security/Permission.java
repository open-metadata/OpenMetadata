/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.catalog.security;

/**
 * Different operations a client may perform on resources.
 */
public enum Permission {
  DESCRIBE("Describe"),
  READ("Read"),
  WRITE("Write"),
  CREATE("Create"),
  DELETE("Delete"),
  ALTER("Alter"),
  CLUSTER_ACTION("ClusterAction");

  private final String name;

  Permission(String name) {
    this.name = name;
  }

  public String getName() {
    return name;
  }
}
