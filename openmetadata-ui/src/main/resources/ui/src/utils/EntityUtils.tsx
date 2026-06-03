/*
 *  Copyright 2022 Collate.
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

import { Popover } from 'antd';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityType, FqnPart } from '../enums/entity.enum';
import type { ColumnJoins } from '../generated/entity/data/table';
import {
  checkIfJoinsAvailable,
  getFrequentlyJoinedWithColumns,
} from './EntityPureUtils';
import {
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
} from './FqnUtils';
import { getEntityDetailsPath } from './RouterUtils';

// Re-exports from EntityNameUtils (backward compat)
// Re-export EntityLabel component as getEntityLabel (backward compat)
export { default as getEntityLabel } from '../components/Entity/EntityLabel/EntityLabel.component';
// Re-exports from EntityBreadcrumbUtils (backward compat)
export {
  getBreadCrumbForAPICollection,
  getBreadCrumbForAPIEndpoint,
  getBreadcrumbForChart,
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForEntityWithParent,
  getBreadCrumbForKpi,
  getBreadcrumbForTable,
  getBreadcrumbForTestCase,
  getBreadcrumbForTestSuite,
  getEntityBreadcrumbs,
  getEntityLinkFromType,
} from './EntityBreadcrumbUtils';
export {
  EntityTypeName,
  getDomainDisplayName,
  getEntityName,
  getEntityNameLabel,
  getPluralizeEntityName,
} from './EntityNameUtils';
// Re-exports from EntityPureUtils (backward compat)
export {
  checkIfJoinsAvailable,
  columnSorter,
  DRAWER_NAVIGATION_OPTIONS,
  ENTITY_LINK_SEPARATOR,
  getBreadcrumbsFromFqn,
  getColumnNameFromEntityLink,
  getColumnSorter,
  getEntityBulkEditPath,
  getEntityFeedLink,
  getEntityImportPath,
  getEntityReferenceFromEntity,
  getEntityReferenceListFromEntities,
  getEntityTags,
  getEntityUserLink,
  getEntityVoteStatus,
  getFrequentlyJoinedWithColumns,
  hasCustomPropertiesTab,
  hasEditAccess,
  hasLineageTab,
  hasSchemaTab,
  highlightEntityNameAndDescription,
  highlightSearchText,
  searchInColumns,
  updateNodeType,
} from './EntityPureUtils';

export const getFrequentlyJoinedColumns = (
  columnName: string,
  joins: Array<ColumnJoins>,
  columnLabel: string
) => {
  const frequentlyJoinedWithColumns = getFrequentlyJoinedWithColumns(
    columnName,
    joins
  );

  return checkIfJoinsAvailable(columnName, joins) ? (
    <div className="m-t-sm" data-testid="frequently-joined-columns">
      <span className="text-grey-muted m-r-xss">{columnLabel}:</span>
      <span>
        {frequentlyJoinedWithColumns.slice(0, 3).map((columnJoin, index) => (
          <Fragment key={columnJoin.fullyQualifiedName}>
            {index > 0 && <span className="m-r-xss">,</span>}
            <Link
              className="link-text"
              to={getEntityDetailsPath(
                EntityType.TABLE,
                columnJoin.fullyQualifiedName
              )}>
              {getPartialNameFromTableFQN(
                columnJoin.fullyQualifiedName,
                [
                  FqnPart.Database,
                  FqnPart.Table,
                  FqnPart.Schema,
                  FqnPart.Column,
                ],
                FQN_SEPARATOR_CHAR
              )}
            </Link>
          </Fragment>
        ))}

        {frequentlyJoinedWithColumns.length > 3 && (
          <Popover
            content={
              <div className="text-left">
                {frequentlyJoinedWithColumns?.slice(3).map((columnJoin) => (
                  <Fragment key={columnJoin.fullyQualifiedName}>
                    <a
                      className="link-text d-block p-y-xss"
                      href={getEntityDetailsPath(
                        EntityType.TABLE,
                        getTableFQNFromColumnFQN(
                          columnJoin?.fullyQualifiedName
                        ),
                        getPartialNameFromTableFQN(
                          columnJoin?.fullyQualifiedName,
                          [FqnPart.Column]
                        )
                      )}>
                      {getPartialNameFromTableFQN(
                        columnJoin?.fullyQualifiedName,
                        [FqnPart.Database, FqnPart.Table, FqnPart.Column]
                      )}
                    </a>
                  </Fragment>
                ))}
              </div>
            }
            placement="bottom"
            trigger="click">
            <span className="show-more m-l-xss text-underline">...</span>
          </Popover>
        )}
      </span>
    </div>
  ) : null;
};

/**
 * It searches for a given text in a given string and returns an array that contains the string parts that have
 * highlighted element if match found.
 * @param text - The text to search in.
 * @param searchText - The text to search for.
 * @returns An Array of string or JSX.Element which contains highlighted element.
 */
export const highlightSearchArrayElement = (
  text?: string,
  searchText?: string
): string | (string | JSX.Element)[] => {
  if (!searchText || !text) {
    return text ?? '';
  }
  const stringParts = text.split(new RegExp(`(${searchText})`, 'gi'));

  return stringParts.map((part, index) =>
    part.toLowerCase() === (searchText ?? '').toLowerCase() ? (
      <span className="text-highlighter" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      part
    )
  );
};
