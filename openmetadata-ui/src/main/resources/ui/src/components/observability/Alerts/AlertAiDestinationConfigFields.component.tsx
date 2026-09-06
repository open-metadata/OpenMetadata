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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  BadgeWithButton,
  Button,
  Checkbox,
  Input,
  PasswordInput,
  Select,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Settings01 } from '@untitledui/icons';
import classNames from 'classnames';
import { debounce, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DESTINATION_TYPE_BASED_PLACEHOLDERS } from '../../../constants/Alerts.constants';
import { EMAIL_REG_EX } from '../../../constants/regex.constants';
import {
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../generated/events/eventSubscription';
import {
  ALERT_AI_FORM_CLASS_NAMES,
  ALERT_AI_OAUTH_TOKEN_URL_PLACEHOLDER,
} from './AlertAiFormFields.constants';
import { AlertAiDestinationItemProps } from './AlertAiFormFields.interface';
import {
  getStringArrayValue,
  getValidationPath,
  isWebhookDestination,
  updateAlertAiValue,
} from './AlertAiFormFieldsPureUtils';
import {
  AlertAiSearchOption,
  getAlertAiTeamOptions,
  getAlertAiUserOptions,
} from './AlertAiFormFieldsSearchUtils';
import {
  getAuthTypeItems,
  renderSelectItem,
} from './AlertAiFormFieldsSelectUtils';

interface EmailTagInputProps {
  hint?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  name: number;
  onChange: (receivers: string[]) => void;
  value: string[];
}

/** Controlled tag-based email input — mirrors OSS EmailTagInput without RHF. */
const EmailTagInput = ({
  hint,
  isDisabled,
  isInvalid,
  name,
  onChange,
  value: receivers,
}: EmailTagInputProps) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [emailError, setEmailError] = useState('');

  const addEmail = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    if (!EMAIL_REG_EX.test(trimmed)) {
      setEmailError(
        t('message.field-text-is-invalid', { fieldText: t('label.email') })
      );

      return;
    }
    if (receivers.includes(trimmed)) {
      setInputValue('');
      setEmailError('');

      return;
    }
    onChange([...receivers, trimmed]);
    setInputValue('');
    setEmailError('');
  }, [inputValue, receivers, onChange, t]);

  const removeEmail = useCallback(
    (email: string) => onChange(receivers.filter((r) => r !== email)),
    [receivers, onChange]
  );

  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-2">
      <Input
        data-testid={`email-input-${name}`}
        hint={emailError || hint}
        isDisabled={isDisabled}
        isInvalid={Boolean(emailError) || isInvalid}
        placeholder={
          DESTINATION_TYPE_BASED_PLACEHOLDERS[SubscriptionType.Email] ?? ''
        }
        size="sm"
        value={inputValue}
        onBlur={addEmail}
        onChange={(val) => {
          setInputValue(val);
          if (emailError) {
            setEmailError('');
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addEmail();
          }
        }}
      />
      {!isEmpty(receivers) && (
        <div
          className="tw:flex tw:w-full tw:flex-wrap tw:gap-1.5"
          data-testid={`email-tags-${name}`}>
          {receivers.map((email) => (
            <BadgeWithButton
              buttonLabel={t('label.remove')}
              color="gray"
              data-testid={`email-tag-${email}`}
              key={email}
              type="pill-color"
              onButtonClick={() => removeEmail(email)}>
              {email}
            </BadgeWithButton>
          ))}
        </div>
      )}
    </div>
  );
};

interface TeamUserSelectInputProps {
  destinationNumber: number;
  entityType: string;
  hint?: string;
  isDisabled?: boolean;
  onChange: (values: string[]) => void;
  onSearch: (text: string) => Promise<AlertAiSearchOption[]>;
  value: string[];
}

/** Controlled searchable multi-select for teams/users — mirrors OSS TeamAndUserSelectItemV2 without RHF. */
const TeamUserSelectInput = ({
  destinationNumber,
  entityType,
  hint,
  isDisabled,
  onChange,
  onSearch,
  value: selectedOptions,
}: TeamUserSelectInputProps) => {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<AlertAiSearchOption[]>([]);

  const handleSearch = useCallback(
    async (value: string) => {
      try {
        setIsLoadingOptions(true);
        const results = await onSearch(value);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [onSearch]
  );

  const debouncedSearch = useMemo(
    () => debounce(handleSearch, 500),
    [handleSearch]
  );

  const handleOptionClick = useCallback(
    (val: string) => {
      const updated = selectedOptions.includes(val)
        ? selectedOptions.filter((o) => o !== val)
        : [...selectedOptions, val];
      onChange(updated);
    },
    [selectedOptions, onChange]
  );

  const handleTagClose = useCallback(
    (val: string) => onChange(selectedOptions.filter((o) => o !== val)),
    [selectedOptions, onChange]
  );

  useEffect(() => {
    debouncedSearch(searchText);
  }, [searchText, debouncedSearch]);

  // Move focus to the search field when the dropdown opens (replaces autoFocus).
  useEffect(() => {
    if (isDropdownOpen) {
      searchInputRef.current?.focus();
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const clickedOutsideDropdown = !dropdownRef.current?.contains(
        e.target as Node
      );
      const clickedInsideTrigger = triggerRef.current?.contains(
        e.target as Node
      );
      if (clickedOutsideDropdown && !clickedInsideTrigger) {
        setIsDropdownOpen(false);
        setSearchText('');
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const optionsContent = isEmpty(options) ? (
    <Typography
      as="p"
      className={ALERT_AI_FORM_CLASS_NAMES.teamUserSelectEmptyText}
      size="text-sm">
      {t('label.no-teams-or-users')}
    </Typography>
  ) : (
    options.map(({ label, value }) => (
      <Button
        noTextPadding
        className={ALERT_AI_FORM_CLASS_NAMES.teamUserSelectOptionButton}
        color="tertiary"
        data-testid={`team-user-option-${value}`}
        key={value}
        onPress={() => handleOptionClick(value)}>
        <Checkbox
          data-testid={`${label}-option-checkbox`}
          isSelected={selectedOptions.includes(value)}
        />
        <Typography
          as="span"
          className={ALERT_AI_FORM_CLASS_NAMES.teamUserSelectOptionLabel}
          data-testid={`${label}-option-label`}>
          {label}
        </Typography>
      </Button>
    ))
  );

  return (
    <div className={ALERT_AI_FORM_CLASS_NAMES.teamUserSelectRoot}>
      <div
        className={classNames(
          ALERT_AI_FORM_CLASS_NAMES.teamUserSelectTrigger,
          isDisabled && ALERT_AI_FORM_CLASS_NAMES.teamUserSelectTriggerDisabled
        )}
        data-testid={`team-user-select-trigger-${destinationNumber}`}
        ref={triggerRef}
        onClick={isDisabled ? undefined : () => setIsDropdownOpen((p) => !p)}
        onKeyDown={
          isDisabled
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsDropdownOpen((p) => !p);
                }
              }
        }>
        {isEmpty(selectedOptions) ? (
          <Typography
            as="span"
            className="tw:text-placeholder"
            data-testid="placeholder-text">
            {t('label.please-select-entity', { entity: entityType })}
          </Typography>
        ) : (
          selectedOptions.map((option) => (
            <BadgeWithButton
              buttonLabel={t('label.remove')}
              color="gray"
              data-testid={`selected-tag-${option}`}
              key={option}
              type="pill-color"
              onButtonClick={(e) => {
                e.stopPropagation();
                handleTagClose(option);
              }}>
              {option}
            </BadgeWithButton>
          ))
        )}
      </div>

      {isDropdownOpen && (
        <div
          className={ALERT_AI_FORM_CLASS_NAMES.teamUserSelectDropdown}
          data-testid={`team-user-select-dropdown-${destinationNumber}`}
          ref={dropdownRef}>
          <Input
            data-testid={`team-user-search-input-${destinationNumber}`}
            placeholder={t('label.search-by-type', { type: entityType })}
            ref={searchInputRef}
            size="sm"
            value={searchText}
            onChange={(val) => setSearchText(val)}
          />
          <div className={ALERT_AI_FORM_CLASS_NAMES.teamUserSelectOptions}>
            {isLoadingOptions ? (
              <div
                className={
                  ALERT_AI_FORM_CLASS_NAMES.teamUserSelectSkeletonWrapper
                }>
                <Skeleton height={24} variant="rounded" />
                <Skeleton height={24} variant="rounded" />
                <Skeleton height={24} variant="rounded" />
              </div>
            ) : (
              optionsContent
            )}
          </div>
        </div>
      )}
      {hint && (
        <Typography
          as="p"
          className={ALERT_AI_FORM_CLASS_NAMES.teamUserHint}
          size="text-sm">
          {hint}
        </Typography>
      )}
    </div>
  );
};

/** Renders destination-specific configuration fields based on the selected destination type. */
const AlertAiDestinationConfigFields = ({
  destination,
  isViewOnly,
  name,
  onChange,
  validationErrors,
  value,
}: Pick<
  AlertAiDestinationItemProps,
  | 'destination'
  | 'isViewOnly'
  | 'name'
  | 'onChange'
  | 'validationErrors'
  | 'value'
>) => {
  const { t } = useTranslation();
  const destinationType = destination?.destinationType;
  const authType = destination?.config?.authType?.type;
  const getConfigError = (...path: (string | number)[]) =>
    validationErrors?.[
      getValidationPath('destinations', name, 'config', ...path)
    ];

  /** Applies nested config updates under the current destination item. */
  const updateDestinationConfig = (
    path: (string | number)[],
    nextValue: unknown
  ) => {
    updateAlertAiValue(
      value,
      onChange,
      ['destinations', name, 'config', ...path],
      nextValue
    );
  };

  if (destinationType === SubscriptionType.Email) {
    const receivers = getStringArrayValue(destination?.config?.receivers);
    const receiversError = getConfigError('receivers');

    return (
      <div
        className={classNames(
          ALERT_AI_FORM_CLASS_NAMES.field,
          ALERT_AI_FORM_CLASS_NAMES.columnSpanFull
        )}>
        <EmailTagInput
          hint={receiversError}
          isDisabled={isViewOnly}
          isInvalid={Boolean(receiversError)}
          name={name}
          value={receivers}
          onChange={(nextReceivers) =>
            updateDestinationConfig(['receivers'], nextReceivers)
          }
        />
      </div>
    );
  }

  if (
    destinationType === SubscriptionCategory.Teams ||
    destinationType === SubscriptionCategory.Users
  ) {
    const receivers = getStringArrayValue(destination?.config?.receivers);
    const receiversError = getConfigError('receivers');
    const isTeams = destinationType === SubscriptionCategory.Teams;

    return (
      <div
        className={classNames(
          ALERT_AI_FORM_CLASS_NAMES.field,
          ALERT_AI_FORM_CLASS_NAMES.columnSpanFull
        )}>
        <TeamUserSelectInput
          destinationNumber={name}
          entityType={
            isTeams ? t('label.team-lowercase') : t('label.user-lowercase')
          }
          hint={receiversError}
          isDisabled={isViewOnly}
          value={receivers}
          onChange={(nextReceivers) =>
            updateDestinationConfig(['receivers'], nextReceivers)
          }
          onSearch={isTeams ? getAlertAiTeamOptions : getAlertAiUserOptions}
        />
      </div>
    );
  }

  if (!isWebhookDestination(destinationType)) {
    return null;
  }

  return (
    <>
      <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
        <Input
          data-testid={`endpoint-input-${name}`}
          hint={getConfigError('endpoint')}
          isDisabled={isViewOnly}
          isInvalid={Boolean(getConfigError('endpoint'))}
          label={t('label.endpoint-url')}
          placeholder={DESTINATION_TYPE_BASED_PLACEHOLDERS[destinationType]}
          size="sm"
          value={destination?.config?.endpoint ?? ''}
          onChange={(nextValue) =>
            updateDestinationConfig(['endpoint'], nextValue)
          }
        />
      </div>
      <div
        className={classNames(
          ALERT_AI_FORM_CLASS_NAMES.field,
          ALERT_AI_FORM_CLASS_NAMES.columnSpanFull
        )}>
        <Accordion>
          <AccordionItem id={`advanced-config-${name}`}>
            <AccordionHeader>
              <Typography
                as="span"
                className={ALERT_AI_FORM_CLASS_NAMES.advancedConfigHeader}>
                <Settings01 className="tw:size-4" />
                {t('label.advanced-configuration')}
              </Typography>
            </AccordionHeader>
            <AccordionPanel>
              <div className="tw:flex tw:flex-col tw:gap-3 tw:pt-3">
                <Select
                  data-testid={`auth-type-select-${name}`}
                  fontSize="sm"
                  isDisabled={isViewOnly}
                  items={getAuthTypeItems(t)}
                  label={t('label.authentication-type')}
                  placeholder={t('label.authentication-type')}
                  selectedKey={authType ?? Type.None}
                  size="sm"
                  onSelectionChange={(key) =>
                    updateDestinationConfig(
                      ['authType', 'type'],
                      key ? String(key) : Type.None
                    )
                  }>
                  {renderSelectItem}
                </Select>
                {authType === Type.Bearer && (
                  <PasswordInput
                    data-testid={`secret-key-input-${name}`}
                    hint={getConfigError('authType', 'secretKey')}
                    isDisabled={isViewOnly}
                    isInvalid={Boolean(getConfigError('authType', 'secretKey'))}
                    label={t('label.secret-key')}
                    placeholder={t('label.secret-key')}
                    size="sm"
                    value={destination?.config?.authType?.secretKey ?? ''}
                    onChange={(nextValue) =>
                      updateDestinationConfig(
                        ['authType', 'secretKey'],
                        nextValue
                      )
                    }
                  />
                )}
                {authType === Type.Oauth2 && (
                  <>
                    <Input
                      data-testid={`token-url-input-${name}`}
                      hint={getConfigError('authType', 'tokenUrl')}
                      isDisabled={isViewOnly}
                      isInvalid={Boolean(
                        getConfigError('authType', 'tokenUrl')
                      )}
                      label={t('label.token-url')}
                      placeholder={ALERT_AI_OAUTH_TOKEN_URL_PLACEHOLDER}
                      size="sm"
                      value={destination?.config?.authType?.tokenUrl ?? ''}
                      onChange={(nextValue) =>
                        updateDestinationConfig(
                          ['authType', 'tokenUrl'],
                          nextValue
                        )
                      }
                    />
                    <PasswordInput
                      data-testid={`client-id-input-${name}`}
                      hint={getConfigError('authType', 'clientId')}
                      isDisabled={isViewOnly}
                      isInvalid={Boolean(
                        getConfigError('authType', 'clientId')
                      )}
                      label={t('label.client-id')}
                      placeholder={t('label.client-id')}
                      size="sm"
                      value={destination?.config?.authType?.clientId ?? ''}
                      onChange={(nextValue) =>
                        updateDestinationConfig(
                          ['authType', 'clientId'],
                          nextValue
                        )
                      }
                    />
                    <PasswordInput
                      data-testid={`client-secret-input-${name}`}
                      hint={getConfigError('authType', 'clientSecret')}
                      isDisabled={isViewOnly}
                      isInvalid={Boolean(
                        getConfigError('authType', 'clientSecret')
                      )}
                      label={t('label.client-secret')}
                      placeholder={t('label.client-secret')}
                      size="sm"
                      value={destination?.config?.authType?.clientSecret ?? ''}
                      onChange={(nextValue) =>
                        updateDestinationConfig(
                          ['authType', 'clientSecret'],
                          nextValue
                        )
                      }
                    />
                    <Input
                      data-testid={`scope-input-${name}`}
                      isDisabled={isViewOnly}
                      label={t('label.scope')}
                      placeholder={`${t('label.scope')} (${t(
                        'label.optional'
                      )})`}
                      size="sm"
                      value={destination?.config?.authType?.scope ?? ''}
                      onChange={(nextValue) =>
                        updateDestinationConfig(
                          ['authType', 'scope'],
                          nextValue
                        )
                      }
                    />
                  </>
                )}
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
};

export default AlertAiDestinationConfigFields;
