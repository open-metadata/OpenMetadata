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
import {
  AssetType,
  Edge,
  LoadedPrefix,
  NativeOntologyAssetCluster,
  NativeOntologyDataGraphPage,
  State,
} from '../../../generated/api/data/nativeOntologyDataGraphPage';

interface AssetSeed {
  id: string;
  name: string;
  columns?: number;
  serviceType?: string;
}

interface ClusterSeed {
  id: string;
  name: string;
  count: number;
  assets: AssetSeed[];
  after?: string;
}

interface PageSeed {
  bindings?: { assets: AssetSeed[]; after?: string; revision?: number };
  clusters?: ClusterSeed[];
  contextFull?: boolean;
  conceptEdges?: { from: string; to: string; label: string }[];
  lineageEdges?: { from: string; to: string }[];
  loaded?: LoadedPrefix[];
  nextClusterOffset?: number;
  topologyAfter?: string;
}

const assetReference = ({ id, name }: AssetSeed) => ({
  id,
  name,
  type: 'table',
  fullyQualifiedName: `svc.db.schema.${name}`,
});

export const clusterFixture = (
  seed: ClusterSeed
): NativeOntologyAssetCluster => ({
  concept: { id: seed.id, name: seed.name, type: 'ontologyConcept' },
  assetCount: seed.count,
  after: seed.after,
  assets: seed.assets.map((asset) => ({
    asset: assetReference(asset),
    columnCount: asset.columns ?? 0,
    serviceType: asset.serviceType,
  })),
});

export const prefixFixture = (
  conceptId: string,
  throughAssetId?: string
): LoadedPrefix => ({ conceptId, bindingRevision: 1, throughAssetId });

export const pageFixture = (
  seed: PageSeed = {}
): NativeOntologyDataGraphPage => ({
  clusters: seed.clusters?.map(clusterFixture),
  bindings: seed.bindings && {
    revision: seed.bindings.revision ?? 1,
    after: seed.bindings.after,
    assets: seed.bindings.assets.map((asset) => ({
      assetId: asset.id,
      assetType: AssetType.Table,
      asset: assetReference(asset),
      serviceType: asset.serviceType,
      columns: Array.from({ length: asset.columns ?? 0 }, (_, index) => ({
        columnPath: [`column_${index}`],
        propertyId: 'property',
        state: State.Resolved,
      })),
    })),
  },
  contextFull: seed.contextFull ?? false,
  loaded: seed.loaded ?? [],
  nextClusterOffset: seed.nextClusterOffset,
  topology: {
    contextDigest: 'digest',
    after: seed.topologyAfter,
    edges: (seed.conceptEdges ?? []).map((edge) => ({
      fromConceptId: edge.from,
      toConceptId: edge.to,
      label: edge.label,
      propertyIri: `urn:property:${edge.label}`,
    })),
    lineageEdges: (seed.lineageEdges ?? []).map(
      (edge): Edge => ({ fromEntity: edge.from, toEntity: edge.to })
    ),
  },
});
