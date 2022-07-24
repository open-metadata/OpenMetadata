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

package org.openmetadata.core.jdbi3.locator;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.google.common.collect.ImmutableMap;
import java.util.Map;

@JsonFormat(shape = JsonFormat.Shape.OBJECT)
public enum ConnectionType {
  MYSQL("com.mysql.cj.jdbc.Driver"),
  POSTGRES("org.postgresql.Driver");

  public final String label;

  ConnectionType(String label) {
    this.label = label;
  }

  private static final Map<String, ConnectionType> labelMap;

  static {
    ImmutableMap.Builder<String, ConnectionType> builder = ImmutableMap.builder();
    for (ConnectionType t : ConnectionType.values()) {
      builder.put(t.label, t);
    }
    labelMap = builder.build();
  }

  @JsonCreator
  public static ConnectionType from(String value) {
    try {
      return labelMap.get(value);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          String.format("Cannot create %s from value [%s]", ConnectionType.class.getName(), value), e);
    }
  }

  @Override
  public String toString() {
    return "ConnectionType{" + "name='" + name() + '\'' + "driver='" + label + '\'' + '}';
  }
}
