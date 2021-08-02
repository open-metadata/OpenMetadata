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

package org.openmetadata.common.module;

import java.util.Map;


/**
 * Used to define start() and stop() methods for a guice module that expects to start and stop services
 * with creation and destruction of a injector
 */
public interface StartableModule {

  /**
   * Starts up required services before tests are invoked for a test class
   *
   * @param props properties that were defined as a part of CatalogTest
   */
  void start(Map<String, Object> props);

  /**
   * Stops services that were invoked with start() after all the tests for a class
   *
   * @param props properties that were defined as a part of CatalogTest
   */
  void stop(Map<String, Object> props);
}