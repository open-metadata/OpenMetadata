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

/**
 * This enum captures all the relationships between Catalog entities
 * Note that the relationship from is a Strong entity and to is Weak entity
 * when possible.
 */
public enum Relationship {

  /**
   * Rules for changing enums since the ordinal position is stored in the database.
   * - Don't remove an enum, since the database might have stored the enum ordinal number
   * - When adding a new enum, add it as the last enum to preserve the ordinal positions of the existing enums
   */
  // Database --- contains --> Table
  // Organization --- contains --> Team
  // Team --- contains --> User
  // Service --- contains --> Database
  CONTAINS("contains"),

  // User/Bot --- created ---> Thread
  CREATED("createdBy"),

  // User/Bot --- repliedTo ---> Thread
  REPLIED_TO("repliedTo"),

  // Thread --- isAbout ---> Entity
  IS_ABOUT("isAbout"),

  // Thread --- addressedTo ---> User/Team
  ADDRESSED_TO("addressedTo"),

  // User, Team, Data assets --- mentionedIn ---> Thread
  MENTIONED_IN("mentionedIn"),

  // Entity --- testedBy ---> Test
  TESTED_BY("testedBy"),

  // {Dashboard|Pipeline|Query} --- uses ---> Table
  // {User} --- uses ---> {Table|Dashboard|Query}
  // {MlModel} --- uses ---> {Dashboard}
  USES("uses"),

  // {User|Team|Org} --- owns ---> {Table|Dashboard|Query}
  OWNS("owns"),

  // {Role} --- parentOf ---> {Role}
  PARENT_OF("parentOf"),

  // {User} --- has ---> {Role}
  // {Table} --- has ---> {Location}
  // {Database} --- has ---> {Location}
  HAS("has"),

  // {User} --- follows ----> {Table, Database, Metrics...}
  FOLLOWS("follows"),

  // {Table.Column...} --- joinedWith ---> {Table.Column}
  JOINED_WITH("joinedWith"),

  // Lineage relationship
  // {Table1} --- upstream ---> {Table2} (Table1 is used for creating Table2}
  // {Pipeline} --- upstream ---> {Table2} (Pipeline creates Table2)
  // {Table} --- upstream ---> {Dashboard} (Table was used to  create Dashboard)
  UPSTREAM("upstream");
  /*** Add new enums to the end of the list **/

  private final String value;

  Relationship(String value) {
    this.value = value;
  }

  public String value() {
    return value;
  }
}
