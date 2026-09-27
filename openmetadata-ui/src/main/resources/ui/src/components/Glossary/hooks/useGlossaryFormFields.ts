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
import { FieldProp, FieldTypes } from '@openmetadata/ui-core-components';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { DataAssetRuleValidation } from '../../../context/RuleEnforcementProvider/RuleEnforcementProvider.interface';
import { EntityReferenceOption } from '../AddGlossary/AddGlossary.interface';
import { hasOwnerRuleViolation } from '../AddGlossary/AddGlossary.utils';
import { EntityReferencePicker } from './useEntityReferenceOptions';

const NAME_MAX_LENGTH = 128;

interface UseGlossaryFormFieldsParams {
  entityRules: Pick<
    DataAssetRuleValidation,
    'canAddMultipleUserOwners' | 'canAddMultipleTeamOwner'
  >;
  ownersPicker: EntityReferencePicker;
  reviewersPicker: EntityReferencePicker;
}

const toPickerProps = ({
  options,
  onFocus,
  onSearchChange,
}: EntityReferencePicker) => ({
  // The server already filtered the options by the search text.
  filterOption: () => true,
  multiple: true,
  onFocus,
  onSearchChange,
  options,
});

/**
 * Field configs shared by the glossary and glossary term forms, so both
 * drawers validate names and owners identically.
 */
export const useGlossaryFormFields = ({
  entityRules,
  ownersPicker,
  reviewersPicker,
}: UseGlossaryFormFieldsParams) => {
  const { t } = useTranslation();

  const nameField = useMemo<FieldProp>(() => {
    const sizeMessage = t('message.entity-size-in-between', {
      entity: t('label.name'),
      max: NAME_MAX_LENGTH,
      min: 1,
    });

    return {
      id: 'root/name',
      label: t('label.name'),
      name: 'name',
      placeholder: t('label.name'),
      props: { 'data-testid': 'name' },
      required: true,
      rules: {
        required: t('label.field-required', { field: t('label.name') }),
        maxLength: { message: sizeMessage, value: NAME_MAX_LENGTH },
        pattern: {
          message: t('message.entity-name-validation'),
          value: ENTITY_NAME_REGEX,
        },
      },
      type: FieldTypes.TEXT,
    };
  }, [t]);

  const displayNameField = useMemo<FieldProp>(
    () => ({
      id: 'root/displayName',
      label: t('label.display-name'),
      name: 'displayName',
      placeholder: t('label.display-name'),
      props: { 'data-testid': 'display-name' },
      rules: {
        maxLength: {
          message: t('message.entity-size-in-between', {
            entity: t('label.display-name'),
            max: NAME_MAX_LENGTH,
            min: 1,
          }),
          value: NAME_MAX_LENGTH,
        },
      },
      type: FieldTypes.TEXT,
    }),
    [t]
  );

  const getMutuallyExclusiveField = useCallback(
    (isEnabled: boolean, entity: string): FieldProp => ({
      id: 'root/mutuallyExclusive',
      label: t('label.mutually-exclusive'),
      name: 'mutuallyExclusive',
      props: { 'data-testid': 'mutually-exclusive-button' },
      // Only warn once the irreversible option is actually switched on.
      helperText: isEnabled
        ? t('message.mutually-exclusive-alert', {
            entity,
            'child-entity': t('label.glossary-term'),
          })
        : undefined,
      type: FieldTypes.SWITCH,
    }),
    [t]
  );

  const ownersField = useMemo<FieldProp>(
    () => ({
      id: 'root/owners',
      label: t('label.owner-plural'),
      name: 'owners',
      placeholder: t('label.select-field', { field: t('label.owner-plural') }),
      props: { 'data-testid': 'owners', ...toPickerProps(ownersPicker) },
      rules: {
        validate: (owners: EntityReferenceOption[]) =>
          hasOwnerRuleViolation(owners, entityRules)
            ? t('message.owner-multiple-users-or-single-team')
            : true,
      },
      type: FieldTypes.USER_TEAM_SELECT_INPUT,
    }),
    [entityRules, ownersPicker, t]
  );

  const reviewersField = useMemo<FieldProp>(
    () => ({
      id: 'root/reviewers',
      label: t('label.reviewer-plural'),
      name: 'reviewers',
      placeholder: t('label.select-field', {
        field: t('label.reviewer-plural'),
      }),
      props: { 'data-testid': 'reviewers', ...toPickerProps(reviewersPicker) },
      type: FieldTypes.USER_TEAM_SELECT_INPUT,
    }),
    [reviewersPicker, t]
  );

  return {
    nameField,
    displayNameField,
    getMutuallyExclusiveField,
    ownersField,
    reviewersField,
  };
};
