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
  Badge,
  ButtonUtility,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, Edit05, Lock01, Trash01, XClose } from '@untitledui/icons';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  Category,
  Characteristic,
  PaletteKey,
  RelationshipType,
} from '../../generated/entity/data/relationshipType';
import {
  CardinalityPreset,
  deriveCardinalityPreset,
} from './RelationshipTypeForm.utils';

const CATEGORY_BADGE_COLORS: Record<Category, 'blue' | 'gray' | 'purple'> = {
  [Category.Core]: 'blue',
  [Category.Custom]: 'gray',
  [Category.OwlSkos]: 'purple',
};

const PALETTE_BADGE_COLORS: Record<
  PaletteKey,
  'blue' | 'gray' | 'indigo' | 'orange' | 'pink' | 'purple' | 'success'
> = {
  [PaletteKey.Amber]: 'orange',
  [PaletteKey.Blue]: 'blue',
  [PaletteKey.Gray]: 'gray',
  [PaletteKey.Green]: 'success',
  [PaletteKey.Indigo]: 'indigo',
  [PaletteKey.Pink]: 'pink',
  [PaletteKey.Purple]: 'purple',
  [PaletteKey.Rose]: 'pink',
  [PaletteKey.Teal]: 'success',
  [PaletteKey.Violet]: 'purple',
};

interface RelationshipTypeTableProps {
  isAdminUser: boolean;
  relationshipTypes: RelationshipType[];
  usageCounts: Record<string, number>;
  onDelete: (relationshipType: RelationshipType) => void;
  onEdit: (relationshipType: RelationshipType) => void;
}

const RelationshipTypeTable = ({
  isAdminUser,
  relationshipTypes,
  usageCounts,
  onDelete,
  onEdit,
}: RelationshipTypeTableProps) => {
  const { t } = useTranslation();

  return (
    <TableCard.Root size="sm">
      <Table
        aria-label={t('label.glossary-term-relation-plural')}
        data-testid="relation-types-table">
        <Table.Header>
          {getColumnLabels(t).map((label) => (
            <Table.Head id={label} key={label}>
              <Typography as="span" className="tw:text-tertiary" size="text-sm">
                {label}
              </Typography>
            </Table.Head>
          ))}
        </Table.Header>
        <Table.Body items={relationshipTypes}>
          {(relationshipType: RelationshipType) => (
            <RelationshipTypeRow
              isAdminUser={isAdminUser}
              key={relationshipType.id}
              relationshipType={relationshipType}
              usageCount={usageCounts[relationshipType.name] ?? 0}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          )}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
};

interface RelationshipTypeRowProps {
  isAdminUser: boolean;
  relationshipType: RelationshipType;
  usageCount: number;
  onDelete: (relationshipType: RelationshipType) => void;
  onEdit: (relationshipType: RelationshipType) => void;
}

const RelationshipTypeRow = ({
  isAdminUser,
  relationshipType,
  usageCount,
  onDelete,
  onEdit,
}: RelationshipTypeRowProps) => {
  const { t } = useTranslation();
  const canDelete =
    isAdminUser && !relationshipType.systemDefined && usageCount === 0;

  return (
    <Table.Row id={relationshipType.id}>
      <Table.Cell>
        <div className="tw:flex tw:items-center tw:gap-2">
          {relationshipType.systemDefined ? (
            <Lock01 className="tw:size-4 tw:text-fg-quaternary" />
          ) : null}
          <Typography
            as="span"
            className="tw:font-semibold tw:text-primary"
            data-testid={`relation-name-${relationshipType.name}`}>
            {relationshipType.name}
          </Typography>
        </div>
      </Table.Cell>
      <Table.Cell>{relationshipType.displayName}</Table.Cell>
      <Table.Cell>
        <Badge
          color={CATEGORY_BADGE_COLORS[relationshipType.category]}
          type="color">
          {getCategoryLabel(relationshipType.category, t)}
        </Badge>
      </Table.Cell>
      <Table.Cell>
        <div className="tw:flex tw:flex-wrap tw:gap-1">
          {relationshipType.characteristics.map((characteristic) => (
            <Badge color="gray" key={characteristic} type="color">
              {getCharacteristicLabel(characteristic, t)}
            </Badge>
          ))}
        </div>
      </Table.Cell>
      <Table.Cell>
        {relationshipType.crossGlossaryAllowed ? (
          <Check className="tw:size-4 tw:text-fg-success-primary" />
        ) : (
          <XClose className="tw:size-4 tw:text-fg-error-primary" />
        )}
      </Table.Cell>
      <Table.Cell>
        <CardinalityBadge relationshipType={relationshipType} />
      </Table.Cell>
      <Table.Cell>
        <Badge
          color={PALETTE_BADGE_COLORS[relationshipType.paletteKey]}
          type="color">
          {getPaletteLabel(relationshipType.paletteKey, t)}
        </Badge>
      </Table.Cell>
      <Table.Cell>
        <div className="tw:flex tw:gap-2">
          <ButtonUtility
            color="tertiary"
            data-testid={`edit-${relationshipType.name}-btn`}
            icon={Edit05}
            isDisabled={!isAdminUser || relationshipType.systemDefined}
            size="sm"
            tooltip={
              relationshipType.systemDefined
                ? t('label.system-defined')
                : t('label.edit')
            }
            onClick={() => onEdit(relationshipType)}
          />
          <ButtonUtility
            color="tertiary"
            data-testid={`delete-${relationshipType.name}-btn`}
            icon={Trash01}
            isDisabled={!canDelete}
            size="sm"
            tooltip={getDeleteTooltip(usageCount, t)}
            onClick={() => onDelete(relationshipType)}
          />
        </div>
      </Table.Cell>
    </Table.Row>
  );
};

const CardinalityBadge = ({
  relationshipType,
}: {
  relationshipType: RelationshipType;
}) => {
  const { t } = useTranslation();
  const preset = deriveCardinalityPreset(relationshipType.cardinality);
  const labels: Record<CardinalityPreset, string> = {
    [CardinalityPreset.Custom]: t('label.custom'),
    [CardinalityPreset.ManyToMany]: t('label.many-to-many'),
    [CardinalityPreset.ManyToOne]: t('label.many-to-one'),
    [CardinalityPreset.OneToMany]: t('label.one-to-many'),
    [CardinalityPreset.OneToOne]: t('label.one-to-one'),
  };

  return (
    <Badge color="gray" type="color">
      {labels[preset]}
    </Badge>
  );
};

const getColumnLabels = (t: TFunction): string[] => [
  t('label.name'),
  t('label.display-name'),
  t('label.category'),
  t('label.characteristic-plural'),
  t('label.cross-glossary'),
  t('label.cardinality'),
  t('label.color'),
  t('label.action-plural'),
];

const getCategoryLabel = (category: Category, t: TFunction): string => {
  const label = (() => {
    switch (category) {
      case Category.Core:
        return t('label.core');
      case Category.OwlSkos:
        return t('label.owl-skos');
      case Category.Custom:
        return t('label.custom-admin-defined');
    }
  })();

  return label;
};

const getCharacteristicLabel = (
  characteristic: Characteristic,
  t: TFunction
): string => {
  const label = (() => {
    switch (characteristic) {
      case Characteristic.Asymmetric:
        return t('label.asymmetric');
      case Characteristic.Functional:
        return t('label.functional');
      case Characteristic.InverseFunctional:
        return t('label.inverse-functional');
      case Characteristic.Irreflexive:
        return t('label.irreflexive');
      case Characteristic.Reflexive:
        return t('label.reflexive');
      case Characteristic.Symmetric:
        return t('label.symmetric');
      case Characteristic.Transitive:
        return t('label.transitive');
    }
  })();

  return label;
};

const getPaletteLabel = (palette: PaletteKey, t: TFunction): string => {
  const label = (() => {
    switch (palette) {
      case PaletteKey.Amber:
        return t('label.color-yellow');
      case PaletteKey.Blue:
        return t('label.color-blue');
      case PaletteKey.Gray:
        return t('label.color-gray');
      case PaletteKey.Green:
        return t('label.color-green');
      case PaletteKey.Indigo:
        return t('label.color-dark-blue');
      case PaletteKey.Pink:
        return t('label.color-pink');
      case PaletteKey.Purple:
        return t('label.color-purple');
      case PaletteKey.Rose:
        return t('label.color-rose');
      case PaletteKey.Teal:
        return t('label.color-teal');
      case PaletteKey.Violet:
        return t('label.color-violet');
    }
  })();

  return label;
};

const getDeleteTooltip = (usageCount: number, t: TFunction): string => {
  const tooltip =
    usageCount > 0
      ? t('message.cannot-delete-relation-type-in-use', {
          count: usageCount,
        })
      : t('label.delete');

  return tooltip;
};

export default RelationshipTypeTable;
