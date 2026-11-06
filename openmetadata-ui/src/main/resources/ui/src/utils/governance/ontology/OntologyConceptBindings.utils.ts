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
import { TFunction } from 'i18next';
import { EntityType } from '../../../enums/entity.enum';
import { AssetType } from '../../../generated/api/data/updateOntologyConceptBinding';
import { Column } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import { AssetBinding } from '../../../generated/type/ontologyConceptBindingsResponse';
import { BindingWriteOutcome } from '../../../interface/governance/ontology/ontologyConceptBindings.types';
import Fqn from '../../Fqn';
import { getEntityDetailsPath } from '../../RouterUtils';

export const NATIVE_BINDING_ASSET_TYPES = Object.values(AssetType);

export const getOntologyBindingWriteMessage = (
  outcome: BindingWriteOutcome
) => {
  if (outcome.kind === 'confirmed') {
    return outcome.read.kind === 'ready'
      ? 'label.saved'
      : 'message.ontology-binding-saved-read-unavailable';
  }

  return `message.ontology-binding-${outcome.kind}` as const;
};

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

const UNLINK_COLUMN_NAMES_SHOWN = 5;

/** What an unlink also drops: the columns bound to the concept's properties on that asset. */
export const getUnlinkDescription = (
  binding: AssetBinding,
  t: TFunction
): string => {
  if (binding.columns.length === 0) {
    return t('message.ontology-unlink-asset-no-columns');
  }
  const names = binding.columns.map((column) => column.columnPath.join('.'));
  const shown = names.slice(0, UNLINK_COLUMN_NAMES_SHOWN).join(', ');
  const hidden = names.length - UNLINK_COLUMN_NAMES_SHOWN;

  return t('message.ontology-unlink-asset-columns', {
    count: binding.columns.length,
    columns:
      hidden > 0
        ? t('message.text-and-count-more', { count: hidden, text: shown })
        : shown,
  });
};
