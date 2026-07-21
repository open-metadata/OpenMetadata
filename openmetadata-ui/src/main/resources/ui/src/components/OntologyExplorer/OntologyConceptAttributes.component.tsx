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
  Button,
  Card,
  Checkbox,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  DataType,
  OntologyAttribute,
} from '../../generated/type/ontologyAttribute';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

export interface OntologyConceptAttributesProps {
  readonly termId: string;
  readonly attributes: OntologyAttribute[];
  readonly isEditMode: boolean;
  readonly showEditControls?: boolean;
  readonly variant?: 'default' | 'inspector';
  readonly onTermUpdate: (term: GlossaryTerm) => void;
}

const DATA_TYPE_BADGE_COLORS: Record<
  DataType,
  'blue' | 'success' | 'warning' | 'purple' | 'pink'
> = {
  [DataType.String]: 'blue',
  [DataType.Integer]: 'success',
  [DataType.Decimal]: 'success',
  [DataType.Boolean]: 'warning',
  [DataType.Date]: 'purple',
  [DataType.Enum]: 'pink',
};

export const OntologyConceptAttributes: React.FC<
  OntologyConceptAttributesProps
> = ({
  termId,
  attributes,
  isEditMode,
  showEditControls = isEditMode,
  variant = 'default',
  onTermUpdate,
}) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDataType, setDraftDataType] = useState<DataType>(DataType.String);
  const [draftEnumValues, setDraftEnumValues] = useState('');
  const [draftIsIdentifier, setDraftIsIdentifier] = useState(false);
  const isInspector = variant === 'inspector';

  const resetDraft = useCallback(() => {
    setDraftName('');
    setDraftDataType(DataType.String);
    setDraftEnumValues('');
    setDraftIsIdentifier(false);
    setIsAdding(false);
  }, []);

  const buildDraftAttribute = useCallback((): OntologyAttribute | null => {
    const name = draftName.trim();
    if (!name) {
      return null;
    }
    if (
      attributes.some(
        (attribute) => attribute.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      showErrorToast(t('message.attribute-name-already-exists'));

      return null;
    }
    const enumValues =
      draftDataType === DataType.Enum
        ? [
            ...new Set(
              draftEnumValues
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            ),
          ]
        : undefined;
    if (draftDataType === DataType.Enum && !enumValues?.length) {
      showErrorToast(
        t('message.field-text-is-required', {
          fieldText: t('label.enum-value-plural'),
        })
      );

      return null;
    }

    return {
      id: uuidv4(),
      name,
      dataType: draftDataType,
      isIdentifier: draftIsIdentifier,
      ...(enumValues ? { enumValues } : {}),
    };
  }, [
    attributes,
    draftDataType,
    draftEnumValues,
    draftIsIdentifier,
    draftName,
    t,
  ]);

  const persistAttributes = useCallback(
    async (operation: Operation, successEntityKey: string) => {
      setIsSaving(true);
      try {
        const updatedTerm = await patchGlossaryTerm(termId, [operation]);
        onTermUpdate(updatedTerm);
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t(successEntityKey),
          })
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', { entity: t(successEntityKey) })
        );
      } finally {
        setIsSaving(false);
      }
    },
    [onTermUpdate, t, termId]
  );

  const handleAddAttribute = useCallback(async () => {
    const attribute = buildDraftAttribute();
    if (!attribute) {
      return;
    }
    const operation: Operation = {
      op: 'add',
      path: '/attributes',
      value: [...attributes, attribute],
    };
    await persistAttributes(operation, 'label.property');
    resetDraft();
  }, [attributes, buildDraftAttribute, persistAttributes, resetDraft]);

  const handleRemoveAttribute = useCallback(
    async (attributeId: string) => {
      const remaining = attributes.filter(
        (attribute) => attribute.id !== attributeId
      );
      await persistAttributes(
        { op: 'add', path: '/attributes', value: remaining },
        'label.property'
      );
    },
    [attributes, persistAttributes]
  );

  const renderAttributeRow = (attribute: OntologyAttribute) => {
    if (isInspector) {
      return (
        <div
          className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-2.5 tw:py-2"
          data-testid={`ontology-attribute-${attribute.name}`}
          key={attribute.id}>
          <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-mono tw:text-xs tw:leading-normal tw:font-medium tw:text-primary">
            {attribute.name}
          </span>
          {attribute.isIdentifier ? (
            <span
              className={classNames(
                'tw:rounded tw:border tw:border-utility-warning-200 tw:bg-utility-warning-50 tw:px-1.5 tw:py-px',
                'tw:font-body tw:text-[8px] tw:leading-normal tw:font-bold tw:text-utility-warning-700'
              )}>
              {t('label.id')}
            </span>
          ) : null}
          {attribute.unit ? (
            <span className="tw:text-xs tw:leading-normal tw:text-tertiary">
              {attribute.unit}
            </span>
          ) : null}
          <span
            className={classNames(
              'tw:font-mono tw:text-[11px] tw:leading-normal tw:font-semibold',
              {
                'tw:text-brand-secondary':
                  attribute.dataType === DataType.String,
                'tw:text-success-primary':
                  attribute.dataType === DataType.Integer ||
                  attribute.dataType === DataType.Decimal,
                'tw:text-warning-primary':
                  attribute.dataType === DataType.Boolean,
                'tw:text-utility-pink-700':
                  attribute.dataType === DataType.Enum,
                'tw:text-utility-purple-700':
                  attribute.dataType === DataType.Date,
              }
            )}>
            {attribute.dataType.toLowerCase()}
          </span>
        </div>
      );
    }

    return (
      <Card
        className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:p-3 tw:ring-0 tw:shadow-sm"
        data-testid={`ontology-attribute-${attribute.name}`}
        key={attribute.id}>
        <Typography
          as="span"
          className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-mono tw:text-primary"
          size="text-sm">
          {attribute.name}
        </Typography>
        {attribute.isIdentifier ? (
          <Badge color="warning" size="sm" type="color">
            {t('label.identifier')}
          </Badge>
        ) : null}
        {attribute.unit ? (
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            {attribute.unit}
          </Typography>
        ) : null}
        <Badge
          color={DATA_TYPE_BADGE_COLORS[attribute.dataType]}
          size="sm"
          type="color">
          {attribute.dataType.toLowerCase()}
        </Badge>
        {isEditMode ? (
          <Button
            aria-label={t('label.remove')}
            color="tertiary"
            data-testid={`remove-attribute-${attribute.name}`}
            isDisabled={isSaving}
            size="sm"
            onClick={() => handleRemoveAttribute(attribute.id)}>
            ✕
          </Button>
        ) : null}
      </Card>
    );
  };

  const renderAddForm = () => (
    <Card
      className={classNames(
        'tw:flex tw:flex-col tw:gap-3 tw:border tw:border-dashed tw:ring-0 tw:shadow-none',
        isInspector
          ? 'tw:rounded-[9px] tw:border-primary tw:bg-secondary tw:p-[11px]'
          : 'tw:rounded-xl tw:border-utility-gray-blue-200 tw:p-3'
      )}>
      {isInspector ? (
        <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
          {t('label.property')} {t('label.name')}
        </span>
      ) : null}
      <Input
        aria-label={t('label.name')}
        data-testid="attribute-name-input"
        placeholder={t('label.name')}
        value={draftName}
        onChange={setDraftName}
      />
      {isInspector ? (
        <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
          {t('label.data-type')}
        </span>
      ) : null}
      <div
        className="tw:flex tw:flex-wrap tw:gap-1"
        data-testid="attribute-data-type-chips">
        {Object.values(DataType).map((dataType) => (
          <Button
            color={draftDataType === dataType ? 'primary' : 'secondary'}
            data-testid={`attribute-type-${dataType}`}
            key={dataType}
            size="sm"
            onClick={() => setDraftDataType(dataType)}>
            {dataType.toLowerCase()}
          </Button>
        ))}
      </div>
      {draftDataType === DataType.Enum ? (
        <Input
          aria-label={t('label.enum-value-plural')}
          data-testid="attribute-enum-values"
          placeholder={t('label.enum-value-plural')}
          value={draftEnumValues}
          onChange={setDraftEnumValues}
        />
      ) : null}
      <Checkbox
        data-testid="attribute-identifier-checkbox"
        isDisabled={!isEditMode}
        isSelected={draftIsIdentifier}
        onChange={setDraftIsIdentifier}>
        {t('label.identifier')} ({t('label.primary-key')})
      </Checkbox>
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button color="tertiary" size="sm" onClick={resetDraft}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-attribute"
          isDisabled={!isEditMode || isSaving || !draftName.trim()}
          size="sm"
          onClick={handleAddAttribute}>
          {t('label.add-entity', { entity: t('label.property') })}
        </Button>
      </div>
    </Card>
  );

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-col',
        isInspector ? 'tw:gap-1.5' : 'tw:gap-2'
      )}
      data-testid="ontology-attributes">
      <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2">
        {isInspector ? (
          <h3 className="tw:m-0 tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:text-primary">
            {t('label.properties')}
          </h3>
        ) : (
          <Typography as="h3" size="text-sm" weight="semibold">
            {t('label.properties')}
          </Typography>
        )}
        <span
          className={classNames(
            isInspector &&
              'tw:rounded-full tw:border tw:border-secondary tw:bg-tertiary tw:px-2 tw:py-px tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-secondary'
          )}>
          {isInspector ? (
            attributes.length
          ) : (
            <Badge color="gray" size="sm" type="color">
              {attributes.length}
            </Badge>
          )}
        </span>
      </div>
      {attributes.map(renderAttributeRow)}
      {showEditControls ? (
        isAdding ? (
          renderAddForm()
        ) : (
          <button
            className={classNames(
              'tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-1 tw:border tw:border-dashed tw:bg-primary tw:font-body tw:text-xs tw:leading-normal tw:font-semibold',
              isInspector
                ? 'tw:mt-0.5 tw:rounded-[9px] tw:border-primary tw:px-2.5 tw:py-[9px] tw:text-secondary'
                : 'tw:rounded-lg tw:border-primary tw:px-3 tw:py-2 tw:text-secondary',
              !isEditMode && 'tw:cursor-not-allowed tw:opacity-50'
            )}
            data-testid="add-attribute"
            disabled={!isEditMode}
            type="button"
            onClick={() => setIsAdding(true)}>
            <Plus aria-hidden="true" className="tw:size-3" />
            {t('label.add-entity', { entity: t('label.property') })}
          </button>
        )
      ) : null}
    </div>
  );
};
