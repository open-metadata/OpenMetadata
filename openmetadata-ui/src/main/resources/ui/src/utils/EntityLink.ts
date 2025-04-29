/*
 *  Copyright 2023 Collate.
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
import antlr4 from 'antlr4';
import { ParseTreeWalker } from 'antlr4/src/antlr4/tree';
import EntityLinkSplitListener from '../antlr/EntityLinkSplitListener';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { FqnPart } from '../enums/entity.enum';
import EntityLinkLexer from '../generated/antlr/EntityLinkLexer';
import EntityLinkParser from '../generated/antlr/EntityLinkParser';
import { getPartialNameFromTableFQN } from './CommonUtils';
import { ENTITY_LINK_SEPARATOR } from './EntityUtils';

export default class EntityLink {
  /**
   *
   * @param string entityLink
   * @returns list of entity link parts
   */
  static split(entityLink: string) {
    if (entityLink) {
      const chars = new antlr4.InputStream(entityLink);
      const lexer = new EntityLinkLexer(chars);
      const tokens = new antlr4.CommonTokenStream(lexer);
      const parser = new EntityLinkParser(tokens);
      const tree = parser.entitylink();
      const splitter = new EntityLinkSplitListener();
      ParseTreeWalker.DEFAULT.walk(splitter, tree);

      return splitter.split();
    }

    return [];
  }

  /**
   *
   * @param string entityLink
   * @returns entity type
   */
  static getEntityType(entityLink: string) {
    return this.split(entityLink)[0];
  }

  /**
   *
   * @param string entityLink
   * @returns entity fqn
   */
  static getEntityFqn(entityLink: string) {
    return this.split(entityLink)[1];
  }

  /**
   *
   * @param string entityLink column
   * @returns entityColumn fqn
   */
  static getEntityColumnFqn(entityLink: string) {
    const parts = this.split(entityLink);

    return `${parts[1]}${parts[3] ? '.' + parts[3] : ''}`;
  }

  /**
   *
   * @param string entityLink
   * @returns entity field
   */
  static getEntityField(entityLink: string) {
    return this.split(entityLink).pop();
  }

  /**
   *
   * @param string entityLink
   * @returns column name for table entity
   */
  static getTableColumnName(entityLink: string) {
    return this.split(entityLink)[3];
  }

  /**
   *
   * @param string columnFqn
   * @param boolean withQuotes for the column name if nested column name is present
   * @returns column name for table entity
   */
  static getTableColumnNameFromColumnFqn(columnFqn: string, withQuotes = true) {
    const columnName = getPartialNameFromTableFQN(columnFqn, [
      FqnPart.NestedColumn,
    ]);

    if (!withQuotes) {
      return columnName;
    }

    return columnName.includes(FQN_SEPARATOR_CHAR)
      ? `"${columnName}"`
      : columnName;
  }

  /**
   *
   * @param string entityLink
   * @returns column field for table entity
   */
  static getTableColumnField(entityLink: string) {
    return this.split(entityLink)[4];
  }

  /**
   *
   * @param string tableFqn
   * @param string | undefined columnName
   * @returns entity link for table
   */
  static getTableEntityLink(tableFqn: string, columnName?: string) {
    if (columnName) {
      return `<#E${ENTITY_LINK_SEPARATOR}table${ENTITY_LINK_SEPARATOR}${tableFqn}${ENTITY_LINK_SEPARATOR}columns${ENTITY_LINK_SEPARATOR}${columnName}>`;
    } else {
      return `<#E${ENTITY_LINK_SEPARATOR}table${ENTITY_LINK_SEPARATOR}${tableFqn}>`;
    }
  }

  /**
   *
   * @param string entityType
   * @param string entityFqn
   * @returns entityLink
   */
  static getEntityLink(entityType: string, entityFqn: string, field?: string) {
    if (field) {
      return `<#E${ENTITY_LINK_SEPARATOR}${entityType}${ENTITY_LINK_SEPARATOR}${entityFqn}${ENTITY_LINK_SEPARATOR}${field}>`;
    }

    return `<#E${ENTITY_LINK_SEPARATOR}${entityType}${ENTITY_LINK_SEPARATOR}${entityFqn}>`;
  }
}
