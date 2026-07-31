/*
 *  Copyright 2026 Collate.
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
import { isNil } from 'lodash';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { NO_DATA } from '../constants/constants';
import { FqnPart } from '../enums/entity.enum';
import type { Table } from '../generated/entity/data/table';
import type { EntityReference } from '../generated/entity/type';
import type { UsageDetails } from '../generated/type/usageDetails';
import { getEntityName } from './EntityNameUtils';
import { getPartialNameFromTableFQN } from './FqnUtils';
import { getTierTags, getUsagePercentile } from './TablePureUtils';

export interface ColumnSearchResult {
  dataType?: string;
  dataTypeDisplay?: string;
  constraint?: string;
  table?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  service?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
    type?: string;
  };
  database?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  databaseSchema?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  owners?: EntityReference[];
  domains?: EntityReference[];
}

export const getUsageData = (usageSummary: UsageDetails | undefined) =>
  isNil(usageSummary?.weeklyStats?.percentileRank)
    ? NO_DATA
    : getUsagePercentile(usageSummary?.weeklyStats?.percentileRank ?? 0);

export const getTableFieldsFromTableDetails = (tableDetails: Table) => {
  const {
    fullyQualifiedName,
    owners,
    tags,
    usageSummary,
    profile,
    columns,
    tableType,
    service,
    database,
    databaseSchema,
    domains,
  } = tableDetails;
  const [serviceName, databaseName, schemaName] = getPartialNameFromTableFQN(
    fullyQualifiedName ?? '',
    [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
    FQN_SEPARATOR_CHAR
  ).split(FQN_SEPARATOR_CHAR);

  const serviceDisplayName = getEntityName(service) || serviceName;
  const databaseDisplayName = getEntityName(database) || databaseName;
  const schemaDisplayName = getEntityName(databaseSchema) || schemaName;

  const tier = getTierTags(tags ?? []);

  return {
    fullyQualifiedName,
    owners,
    service: serviceDisplayName,
    database: databaseDisplayName,
    schema: schemaDisplayName,
    tier,
    usage: getUsageData(usageSummary),
    profile,
    columns,
    tableType,
    domains,
  };
};
