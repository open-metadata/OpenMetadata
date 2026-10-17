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
  Box,
  Button,
  ButtonUtility,
  Card,
  Checkbox,
  Input,
  Select,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, XClose } from '@openmetadata/ui-core-components/icons';
import { useControlledState } from '@react-stately/utils';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  DataType,
  OntologyAttribute,
} from '../../generated/type/ontologyAttribute';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  InspectorForm,
  InspectorList,
  InspectorRemoveButton,
  InspectorRow,
  InspectorSection,
  InspectorSectionHeading,
} from './OntologyInspectorSection';

interface OntologyConceptAttributesBaseProps {
  readonly attributes: OntologyAttribute[];
  /**
   * Attributes the concept declares plus those its ancestors contribute through subsumption.
   * Inherited entries render read-only, since they are edited on the concept that declares them.
   */
  readonly effectiveAttributes?: OntologyAttribute[];
  readonly isEditMode: boolean;
  readonly showEditControls?: boolean;
  readonly variant?: 'default' | 'inspector';
  /** Lets the parent drawer open the add form, e.g. from its "Add more details" chips. */
  readonly isAdding?: boolean;
  readonly onAddingChange?: (isAdding: boolean) => void;
}

interface PersistedOntologyConceptAttributesProps {
  readonly termId: string;
  readonly onTermUpdate: (term: GlossaryTerm) => void;
  readonly onAttributesChange?: never;
}

interface DraftOntologyConceptAttributesProps {
  readonly termId?: never;
  readonly onTermUpdate?: never;
  readonly onAttributesChange: (attributes: OntologyAttribute[]) => void;
}

export type OntologyConceptAttributesProps =
  OntologyConceptAttributesBaseProps &
    (
      | PersistedOntologyConceptAttributesProps
      | DraftOntologyConceptAttributesProps
    );

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
  effectiveAttributes,
  isEditMode,
  showEditControls = isEditMode,
  variant = 'default',
  isAdding: controlledIsAdding,
  onAddingChange,
  onTermUpdate,
  onAttributesChange,
}) => {
  const { t } = useTranslation();
  const inheritedAttributes = useMemo(
    () =>
      (effectiveAttributes ?? []).filter((attribute) => attribute.inherited),
    [effectiveAttributes]
  );
  const [isAdding, setIsAdding] = useControlledState(
    controlledIsAdding,
    false,
    onAddingChange
  );
  const [isSaving, setIsSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDataType, setDraftDataType] = useState<DataType>(DataType.String);
  const [draftEnumValues, setDraftEnumValues] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [draftIsIdentifier, setDraftIsIdentifier] = useState(false);
  const isInspector = variant === 'inspector';

  const resetDraft = useCallback(() => {
    setDraftName('');
    setDraftDataType(DataType.String);
    setDraftEnumValues('');
    setDraftDescription('');
    setDraftUnit('');
    setDraftIsIdentifier(false);
    setIsAdding(false);
  }, [setIsAdding]);

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
      ...(draftDescription.trim()
        ? { description: draftDescription.trim() }
        : {}),
      ...(enumValues ? { enumValues } : {}),
      ...(draftUnit.trim() ? { unit: draftUnit.trim() } : {}),
    };
  }, [
    attributes,
    draftDataType,
    draftDescription,
    draftEnumValues,
    draftIsIdentifier,
    draftName,
    draftUnit,
    t,
  ]);

  const persistAttributes = useCallback(
    async (nextAttributes: OntologyAttribute[], successEntityKey: string) => {
      if (!termId || !onTermUpdate) {
        return;
      }

      setIsSaving(true);
      try {
        const operation: Operation = {
          op: 'add',
          path: '/attributes',
          value: nextAttributes,
        };
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
    const nextAttributes = [...attributes, attribute];
    if (onAttributesChange) {
      onAttributesChange(nextAttributes);
      resetDraft();

      return;
    }
    await persistAttributes(nextAttributes, 'label.property');
    resetDraft();
  }, [
    attributes,
    buildDraftAttribute,
    onAttributesChange,
    persistAttributes,
    resetDraft,
  ]);

  const handleRemoveAttribute = useCallback(
    async (attributeId: string) => {
      const remaining = attributes.filter(
        (attribute) => attribute.id !== attributeId
      );
      if (onAttributesChange) {
        onAttributesChange(remaining);

        return;
      }
      await persistAttributes(remaining, 'label.property');
    },
    [attributes, onAttributesChange, persistAttributes]
  );

  // A draft concept edits its local list; a saved one needs the edit lease.
  const canRemove =
    Boolean(onAttributesChange) || (showEditControls && isEditMode);

  const renderAttributeRow = (attribute: OntologyAttribute) => {
    if (isInspector) {
      return (
        <InspectorRow
          key={attribute.id}
          testId={`ontology-attribute-${attribute.name}`}>
          <Box className="tw:min-w-0 tw:flex-1" direction="col">
            <Typography
              ellipsis
              className="tw:text-primary"
              size="text-sm"
              weight="medium">
              {attribute.name}
            </Typography>
            {attribute.unit || attribute.description ? (
              <Typography ellipsis className="tw:text-tertiary" size="text-xs">
                {[attribute.unit, attribute.description]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            ) : null}
          </Box>
          {attribute.isIdentifier ? (
            <Badge color="warning" size="sm" type="pill-color">
              {t('label.id')}
            </Badge>
          ) : null}
          <Badge
            color={DATA_TYPE_BADGE_COLORS[attribute.dataType]}
            size="sm"
            type="pill-color">
            {attribute.dataType.toLowerCase()}
          </Badge>
          {canRemove ? (
            <InspectorRemoveButton
              isDisabled={isSaving}
              label={t('label.remove-entity', { entity: attribute.name })}
              testId={`remove-attribute-${attribute.name}`}
              onRemove={() => handleRemoveAttribute(attribute.id)}
            />
          ) : null}
        </InspectorRow>
      );
    }

    return (
      <Card
        className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:p-3 tw:shadow-sm"
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
          <ButtonUtility
            data-testid={`remove-attribute-${attribute.name}`}
            icon={XClose}
            isDisabled={isSaving}
            size="xs"
            tooltip={t('label.remove')}
            onClick={() => handleRemoveAttribute(attribute.id)}
          />
        ) : null}
      </Card>
    );
  };

  const renderInheritedAttributeRow = (attribute: OntologyAttribute) =>
    isInspector ? (
      <InspectorRow
        key={`${attribute.declaringTerm?.id}-${attribute.id}`}
        testId={`inherited-attribute-${attribute.name}`}>
        <Typography
          ellipsis
          className="tw:min-w-0 tw:flex-1 tw:text-secondary"
          size="text-sm"
          weight="medium">
          {attribute.name}
        </Typography>
        <Badge color="gray" size="sm" type="pill-color">
          {t('label.inherited-from')}{' '}
          {attribute.declaringTerm?.displayName ??
            attribute.declaringTerm?.name}
        </Badge>
        <Badge
          color={DATA_TYPE_BADGE_COLORS[attribute.dataType]}
          size="sm"
          type="pill-color">
          {attribute.dataType.toLowerCase()}
        </Badge>
      </InspectorRow>
    ) : (
      <div
        className={classNames(
          'tw:flex tw:items-center tw:gap-2 tw:border tw:border-dashed tw:border-secondary tw:bg-secondary',
          isInspector
            ? 'tw:rounded-lg tw:px-2.5 tw:py-2'
            : 'tw:rounded-lg tw:p-3'
        )}
        data-testid={`inherited-attribute-${attribute.name}`}
        key={`${attribute.declaringTerm?.id}-${attribute.id}`}>
        <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-mono tw:text-xs tw:leading-normal tw:font-medium tw:text-secondary">
          {attribute.name}
        </span>
        <Badge color="gray" size="sm" type="color">
          {t('label.inherited-from')}{' '}
          {attribute.declaringTerm?.displayName ??
            attribute.declaringTerm?.name}
        </Badge>
        <span className="tw:font-mono tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-tertiary">
          {attribute.dataType.toLowerCase()}
        </span>
      </div>
    );

  const dataTypeItems = Object.values(DataType).map((dataType) => ({
    id: dataType,
    label: dataType.toLowerCase(),
  }));

  const renderInspectorForm = () => (
    <InspectorForm
      isSubmitDisabled={!isEditMode || isSaving || !draftName.trim()}
      submitLabel={t('label.add-entity', { entity: t('label.property') })}
      submitTestId="save-attribute"
      title={t('label.new-entity', { entity: t('label.property') })}
      onCancel={resetDraft}
      onSubmit={handleAddAttribute}>
      <Input
        isRequired
        data-testid="attribute-name-input"
        label={t('label.name')}
        placeholder={t('message.property-name-placeholder')}
        value={draftName}
        onChange={setDraftName}
      />
      <Box gap={3} itemClassName="tw:min-w-0 tw:flex-1">
        <Select
          data-testid="attribute-data-type-select"
          fontSize="sm"
          items={dataTypeItems}
          label={t('label.data-type')}
          value={draftDataType}
          onChange={(key) => setDraftDataType(key as DataType)}>
          {(item) => (
            <Select.Item
              data-testid={`attribute-type-${item.id}`}
              id={item.id}
              key={item.id}
              label={item.label}
            />
          )}
        </Select>
        <Input
          data-testid="attribute-unit-input"
          label={t('label.unit')}
          placeholder={t('message.unit-placeholder')}
          value={draftUnit}
          onChange={setDraftUnit}
        />
      </Box>
      {draftDataType === DataType.Enum ? (
        <Input
          isRequired
          data-testid="attribute-enum-values"
          label={t('label.enum-value-plural')}
          placeholder={t('label.enum-value-plural')}
          value={draftEnumValues}
          onChange={setDraftEnumValues}
        />
      ) : null}
      <TextArea
        data-testid="attribute-description-input"
        label={t('label.description')}
        placeholder={t('message.property-description-placeholder')}
        rows={3}
        value={draftDescription}
        onChange={setDraftDescription}
      />
      <Toggle
        data-testid="attribute-identifier-toggle"
        hint={t('message.attribute-identifier-hint')}
        isDisabled={!isEditMode}
        isSelected={draftIsIdentifier}
        label={t('label.identifier')}
        onChange={setDraftIsIdentifier}
      />
    </InspectorForm>
  );

  const renderAddForm = () => (
    <Card
      className={classNames(
        'tw:flex tw:flex-col tw:gap-3 tw:border tw:border-dashed tw:shadow-none',
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
        isRequired
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
            type="button"
            onClick={() => setDraftDataType(dataType)}>
            {dataType.toLowerCase()}
          </Button>
        ))}
      </div>
      {draftDataType === DataType.Enum ? (
        <Input
          isRequired
          aria-label={t('label.enum-value-plural')}
          data-testid="attribute-enum-values"
          placeholder={t('label.enum-value-plural')}
          value={draftEnumValues}
          onChange={setDraftEnumValues}
        />
      ) : null}
      <Input
        aria-label={t('label.unit')}
        data-testid="attribute-unit-input"
        label={t('label.unit')}
        placeholder={t('label.unit-of-measurement')}
        value={draftUnit}
        onChange={setDraftUnit}
      />
      <TextArea
        aria-label={t('label.description')}
        data-testid="attribute-description-input"
        label={t('label.description')}
        rows={2}
        value={draftDescription}
        onChange={setDraftDescription}
      />
      <Checkbox
        data-testid="attribute-identifier-checkbox"
        isDisabled={!isEditMode}
        isSelected={draftIsIdentifier}
        onChange={setDraftIsIdentifier}>
        {t('label.identifier')} ({t('label.primary-key')})
      </Checkbox>
      <div className="tw:flex tw:justify-end tw:gap-2">
        <Button color="tertiary" size="sm" type="button" onClick={resetDraft}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="save-attribute"
          isDisabled={!isEditMode || isSaving || !draftName.trim()}
          size="sm"
          type="button"
          onClick={handleAddAttribute}>
          {t('label.add-entity', { entity: t('label.property') })}
        </Button>
      </div>
    </Card>
  );

  const renderEditControls = () => {
    if (!showEditControls) {
      return null;
    }

    if (isAdding) {
      return renderAddForm();
    }

    return (
      <Button
        noTextPadding
        className={classNames(
          'tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-1 tw:border tw:border-dashed tw:bg-primary tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:*:data-icon:size-3',
          isInspector
            ? 'tw:mt-0.5 tw:rounded-[9px] tw:border-primary tw:px-2.5 tw:py-[9px] tw:text-secondary'
            : 'tw:rounded-lg tw:border-primary tw:px-3 tw:py-2 tw:text-secondary',
          !isEditMode && 'tw:cursor-not-allowed tw:opacity-50'
        )}
        color="tertiary"
        data-testid="add-attribute"
        iconLeading={Plus}
        isDisabled={!isEditMode}
        onClick={() => setIsAdding(true)}>
        {t('label.add-entity', { entity: t('label.property') })}
      </Button>
    );
  };

  const propertyCount = attributes.length + inheritedAttributes.length;

  const renderInspectorSection = () => {
    const canAdd = showEditControls && isEditMode && !isAdding;

    return (
      <InspectorSection testId="ontology-attributes">
        <InspectorSectionHeading
          addTestId="add-attribute"
          count={propertyCount}
          label={t('label.properties')}
          onAdd={canAdd ? () => setIsAdding(true) : undefined}
        />
        {propertyCount > 0 ? (
          <InspectorList>
            {attributes.map(renderAttributeRow)}
            {inheritedAttributes.map(renderInheritedAttributeRow)}
          </InspectorList>
        ) : null}
        {showEditControls && isAdding ? renderInspectorForm() : null}
      </InspectorSection>
    );
  };

  if (isInspector) {
    return renderInspectorSection();
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="ontology-attributes">
      <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2">
        <Typography as="h3" size="text-sm" weight="semibold">
          {t('label.properties')}
        </Typography>
        <Badge color="gray" size="sm" type="color">
          {propertyCount}
        </Badge>
      </div>
      {attributes.map(renderAttributeRow)}
      {inheritedAttributes.map(renderInheritedAttributeRow)}
      {renderEditControls()}
    </div>
  );
};
