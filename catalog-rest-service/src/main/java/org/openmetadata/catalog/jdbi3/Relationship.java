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

package org.openmetadata.catalog.jdbi3;

/**
 * This enum captures all the relationships between Catalog entities Note that the relationship from is a Strong entity
 * and to is Weak entity when possible.
 */
public enum Relationship {

  /**
   * Rules for changing enums since the ordinal position is stored in the database. - Don't remove an enum, since the
   * database might have stored the enum ordinal number - When adding a new enum, add it as the last enum to preserve
   * the ordinal positions of the existing enums
   */

  /**
   * CONTAINS relationship is a stronger relationship than HAS. The entity that contains other entities can't be deleted
   * until all the entities that it contains are also deleted. Some examples of these relationships:
   *
   * <ul>
   *   <li>Database --- contains --> Table
   *   <li>Organization --- contains --> Team
   *   <li>Team --- contains --> User
   *   <li>Service --- contains --> Database
   * </ul>
   */
  CONTAINS("contains"), // 0

  // User/Bot --- created ---> Thread
  CREATED("createdBy"), // 1

  // User/Bot --- repliedTo ---> Thread
  REPLIED_TO("repliedTo"), // 2

  // Thread --- isAbout ---> Entity
  IS_ABOUT("isAbout"), // 3

  // Thread --- addressedTo ---> User/Team
  ADDRESSED_TO("addressedTo"), // 4

  // User, Team, Data assets --- mentionedIn ---> Thread
  MENTIONED_IN("mentionedIn"), // 5

  // Entity --- testedBy ---> Test
  TESTED_BY("testedBy"), // 6

  // {Dashboard|Pipeline|Query} --- uses ---> Table
  // {User} --- uses ---> {Table|Dashboard|Query}
  // {MlModel} --- uses ---> {Dashboard}
  USES("uses"), // 7

  // {User|Team|Org} --- owns ---> {Table|Dashboard|Query}
  OWNS("owns"), // 8

  // {Role} --- parentOf ---> {Role}
  PARENT_OF("parentOf"), // 9

  /**
   * HAS relationship is a weaker relationship compared to CONTAINS relationship. The entity that has HAS another entity
   * can be deleted. During deletion, the HAS relationship is simply deleted. Examples of HAS relationship:
   *
   * <ul>
   *   <li>{User} --- has ---> {Role}
   *   <li>{Table} --- has ---> {Location}
   *   <li>{Database} --- has ---> {Location}
   * </ul>
   */
  HAS("has"), // 10

  // {User} --- follows ----> {Table, Database, Metrics...}
  FOLLOWS("follows"), // 11

  // {Table.Column...} --- joinedWith ---> {Table.Column}
  JOINED_WITH("joinedWith"), // 12

  // Lineage relationship
  // {Table1} --- upstream ---> {Table2} (Table1 is used for creating Table2}
  // {Pipeline} --- upstream ---> {Table2} (Pipeline creates Table2)
  // {Table} --- upstream ---> {Dashboard} (Table was used to  create Dashboard)
  UPSTREAM("upstream"), // 13

  // Policy relationship
  // {Policy1} -- appliedTo --> {Location1} (Policy1 is applied to Location1)
  APPLIED_TO("appliedTo"); // 14

  /** * Add new enums to the end of the list * */
  private final String value;

  Relationship(String value) {
    this.value = value;
  }

  public String value() {
    return value;
  }
}
