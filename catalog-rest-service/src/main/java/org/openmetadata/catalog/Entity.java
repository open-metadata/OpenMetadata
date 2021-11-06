/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog;

public final class Entity {
  // Entity names

  // Services
  public static final String DATABASE_SERVICE = "databaseService";
  public static final String MESSAGING_SERVICE = "messagingService";
  public static final String DASHBOARD_SERVICE = "dashboardService";
  public static final String PIPELINE_SERVICE = "pipelineService";
  public static final String STORAGE_SERVICE = "storageService";

  // Data assets
  public static final String TABLE = "table";
  public static final String DATABASE = "database";
  public static final String METRICS = "metrics";
  public static final String DASHBOARD = "dashboard";
  public static final String PIPELINE = "pipeline";
  public static final String CHART = "chart";
  public static final String REPORT = "report";
  public static final String TOPIC = "topic";
  public static final String MODEL = "model";
  public static final String BOTS = "bots";
  public static final String LOCATION = "location";

  // Policies
  public static final String POLICY = "policy";

  // Team/user
  public static final String USER = "user";
  public static final String TEAM = "team";

  // Operations
  public static final String INGESTION = "ingestion";

  private Entity() {

  }
}

