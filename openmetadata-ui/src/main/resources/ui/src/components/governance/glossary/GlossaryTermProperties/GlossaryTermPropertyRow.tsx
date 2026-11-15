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
  Box,
  ButtonUtility,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ClockRewind,
  Edit01,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { EffectiveGlossaryTermProperty } from '../../../../generated/entity/data/glossaryTerm';
import { PROPERTY_DATATYPE_LABEL_KEYS } from '../../../../utils/governance/glossary/GlossaryTermProperties.constants';
import { GlossaryTermPropertyMode } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import {
  getPropertyLabel,
  getPropertySource,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';
import GlossaryTermPropertySourceCell from './GlossaryTermPropertySourceCell';
import GlossaryTermPropertyTypeTile from './GlossaryTermPropertyTypeTile';
import GlossaryTermPropertyValueCell from './GlossaryTermPropertyValueCell';

interface GlossaryTermPropertyRowProps {
  entry: EffectiveGlossaryTermProperty;
  termId: string;
  canEdit: boolean;
  onEdit: (name: string, mode: GlossaryTermPropertyMode) => void;
  onReset: (name: string) => void;
  onDelete: (name: string) => void;
}

const GlossaryTermPropertyRow = ({
  entry,
  termId,
  canEdit,
  onEdit,
  onReset,
  onDelete,
}: GlossaryTermPropertyRowProps) => {
  const { t } = useTranslation();
  const { property } = entry;
  const label = getPropertyLabel(property);
  const source = getPropertySource(entry, termId);
  const isOverridden = source.kind === 'overriddenHere';

  return (
    <Table.Row
      data-testid={`glossary-term-property-${property.name}`}
      id={property.name}>
      <Table.Cell>
        <Box align="center" gap={3}>
          <GlossaryTermPropertyTypeTile datatype={property.datatype} />
          <Box direction="col">
            <Typography size="text-sm" weight="medium">
              {label}
            </Typography>
            {property.description && (
              <Typography color="secondary" size="text-xs">
                {property.description}
              </Typography>
            )}
          </Box>
        </Box>
      </Table.Cell>
      <Table.Cell>
        <Typography color="secondary" size="text-sm">
          {t(PROPERTY_DATATYPE_LABEL_KEYS[property.datatype])}
        </Typography>
      </Table.Cell>
      <Table.Cell>
        <GlossaryTermPropertyValueCell entry={entry} />
      </Table.Cell>
      <Table.Cell>
        <GlossaryTermPropertySourceCell source={source} />
      </Table.Cell>
      <Table.Cell>
        {canEdit && (
          <Box align="center" gap={1} justify="end">
            <ButtonUtility
              data-testid={`edit-property-${property.name}`}
              icon={Edit01}
              size="sm"
              tooltip={
                entry.inherited
                  ? t('label.override-value-for-this-term')
                  : t('label.edit-property')
              }
              onClick={() =>
                onEdit(property.name, entry.inherited ? 'override' : 'edit')
              }
            />
            {isOverridden && (
              <ButtonUtility
                data-testid={`reset-property-${property.name}`}
                icon={ClockRewind}
                size="sm"
                tooltip={t('label.reset-to-inherited-value')}
                onClick={() => onReset(property.name)}
              />
            )}
            {!entry.inherited && (
              <ButtonUtility
                data-testid={`delete-property-${property.name}`}
                icon={Trash01}
                size="sm"
                tooltip={t('label.delete-entity', { entity: label })}
                onClick={() => onDelete(property.name)}
              />
            )}
          </Box>
        )}
      </Table.Cell>
    </Table.Row>
  );
};

export default GlossaryTermPropertyRow;
