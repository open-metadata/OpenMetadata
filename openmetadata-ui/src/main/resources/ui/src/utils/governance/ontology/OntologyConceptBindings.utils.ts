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
import { OntologyGraphData } from '../../../components/OntologyExplorer/OntologyExplorer.interface';
import { EntityType } from '../../../enums/entity.enum';
import { AssetType } from '../../../generated/api/data/updateOntologyConceptBinding';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import { Column } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import { OntologyConceptBindingsResponse } from '../../../generated/type/ontologyConceptBindingsResponse';
import { getEntityName } from '../../EntityNameUtils';
import Fqn from '../../Fqn';
import { getEntityDetailsPath } from '../../RouterUtils';
import {
  getPropertyLabel,
  OntologyStudioModel,
} from './OntologyStudioModel.utils';

export const NATIVE_BINDING_ASSET_TYPES = Object.values(AssetType);

export const getOntologyAssetPath = (asset: EntityReference) => {
  const type = Object.values(EntityType).find((value) => value === asset.type);

  return type && asset.fullyQualifiedName
    ? getEntityDetailsPath(type, asset.fullyQualifiedName)
    : undefined;
};

export const getOntologyColumnOptions = (
  columns: Column[],
  tableFqn: string
) => {
  const tablePath = Fqn.split(tableFqn).map((segment) =>
    Fqn.unquoteName(segment)
  );
  const options: {
    id: string;
    label: string;
    path: string[];
    datatype: string;
  }[] = [];
  const visit = (items: Column[], parent: string[]) => {
    for (const column of items) {
      const fullPath = column.fullyQualifiedName
        ? Fqn.split(column.fullyQualifiedName).map((segment) =>
            Fqn.unquoteName(segment)
          )
        : [...tablePath, ...parent, column.name];
      const path = fullPath.slice(tablePath.length);
      options.push({
        id: JSON.stringify(path),
        label: path.join(' › '),
        path,
        datatype: column.dataTypeDisplay ?? column.dataType,
      });
      if (column.children?.length) {
        visit(column.children, path);
      }
    }
  };
  visit(columns, []);

  return options;
};

export const buildOntologyBindingGraph = (
  model: OntologyStudioModel,
  concept: OntologyConcept,
  bindings: OntologyConceptBindingsResponse,
  assetLabel: string,
  unavailableLabel: string
): OntologyGraphData => {
  const graph: OntologyGraphData = {
    nodes: [
      {
        id: concept.id,
        label: getEntityName(concept),
        type: 'ontologyConcept',
        isDataModeSeed: true,
      },
    ],
    edges: [],
  };
  const properties = new Map(
    model.properties.map((property) => [property.id, property])
  );
  for (const asset of bindings.assets) {
    const assetNodeId = `asset:${asset.assetType}:${asset.assetId}`;
    graph.nodes.push({
      id: assetNodeId,
      label: getEntityName(asset.asset),
      type: asset.assetType,
      entityRef: asset.asset,
      fullyQualifiedName: asset.asset.fullyQualifiedName,
      columnCount: asset.columns.length,
    });
    graph.edges.push({
      id: `link:${assetNodeId}`,
      from: concept.id,
      to: assetNodeId,
      label: assetLabel,
      relationType: 'assetBinding',
      edgeKind: 'assetBinding',
    });
    const columns = new Set<string>();
    for (const binding of asset.columns) {
      const columnId = `${assetNodeId}:${JSON.stringify(binding.columnPath)}`;
      if (!columns.has(columnId)) {
        columns.add(columnId);
        graph.nodes.push({
          id: columnId,
          label: `${binding.columnPath.join(' › ')}${
            binding.state === 'unresolved' ? ` · ${unavailableLabel}` : ''
          }`,
          type: 'column',
          entityRef: asset.asset,
          fullyQualifiedName: binding.column?.fullyQualifiedName,
        });
        graph.edges.push({
          id: `column:${columnId}`,
          from: assetNodeId,
          to: columnId,
          label: '',
          relationType: 'containsColumn',
          edgeKind: 'assetBinding',
        });
      }
      const property = properties.get(binding.propertyId);
      graph.edges.push({
        id: `binding:${binding.propertyId}:${columnId}`,
        from: concept.id,
        to: columnId,
        label: property
          ? getPropertyLabel(property)
          : getEntityName(binding.property) || binding.propertyId,
        relationType: 'columnBinding',
        edgeKind: 'assetBinding',
      });
    }
  }

  return graph;
};
