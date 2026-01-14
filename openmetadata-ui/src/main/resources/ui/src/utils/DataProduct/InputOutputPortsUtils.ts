/*
 *  Copyright 2025 Collate.
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

import { EntityReference } from '../../generated/type/entityReference';
import { getEntityFqnQueryFilter } from '../Assets/AssetsUtils';

/**
 * Extracts fully qualified names from an array of entity references.
 * Filters out any undefined or null values.
 */
const extractFqnsFromPorts = (ports: EntityReference[]): string[] => {
  return ports
    .map((port) => port.fullyQualifiedName)
    .filter((fqn): fqn is string => Boolean(fqn));
};

/**
 * Creates a query filter to fetch input ports by their FQNs.
 * Used by AssetsTabs to query Elasticsearch for port entities.
 *
 * @param inputPorts - Array of input port entity references
 * @returns Query filter object or undefined if no ports
 */
export const getInputPortsQueryFilter = (inputPorts: EntityReference[]) => {
  const fqns = extractFqnsFromPorts(inputPorts);

  return getEntityFqnQueryFilter(fqns);
};

/**
 * Creates a query filter to fetch output ports by their FQNs.
 * Used by AssetsTabs to query Elasticsearch for port entities.
 *
 * @param outputPorts - Array of output port entity references
 * @returns Query filter object or undefined if no ports
 */
export const getOutputPortsQueryFilter = (outputPorts: EntityReference[]) => {
  const fqns = extractFqnsFromPorts(outputPorts);

  return getEntityFqnQueryFilter(fqns);
};
