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

package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.CreateSqlObject;

public interface UsageRepository3 {
  @CreateSqlObject
  UsageDAO3 usageDAO();

  @CreateSqlObject
  TableDAO3 tableDAO();

  @CreateSqlObject
  DatabaseDAO3 databaseDAO();

  @CreateSqlObject
  MetricsDAO3 metricsDAO();

  @CreateSqlObject
  DashboardDAO3 dashboardDAO();

  @CreateSqlObject
  ReportDAO3 reportDAO();

  @CreateSqlObject
  TopicDAO3 topicDAO();

  @CreateSqlObject
  ChartDAO3 chartDAO();

  @CreateSqlObject
  TaskDAO3 taskDAO();

  @CreateSqlObject
  PipelineDAO3 pipelineDAO();

  @CreateSqlObject
  ModelDAO3 modelDAO();

  @CreateSqlObject
  EntityRelationshipDAO3 relationshipDAO();
}
