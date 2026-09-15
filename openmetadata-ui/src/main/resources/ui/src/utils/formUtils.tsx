/*
 *  Copyright 2023 Collate.
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
  Input as UTInput,
  Select as UTSelect,
  SelectItemType,
  Toggle,
  ToggleProps,
} from '@openmetadata/ui-core-components';
import {
  Alert,
  Checkbox,
  Divider,
  Form,
  FormItemProps,
  Input,
  InputNumber,
  Select,
  Switch,
  TooltipProps,
  Typography,
} from 'antd';
import { RuleObject } from 'antd/lib/form';
import { TooltipPlacement } from 'antd/lib/tooltip';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isString, startCase, toString } from 'lodash';
import React, { ComponentProps, Fragment, ReactNode } from 'react';
import AsyncSelectList from '../components/common/AsyncSelectList/AsyncSelectList';
import { AsyncSelectListProps } from '../components/common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../components/common/AsyncSelectList/TreeAsyncSelectList';
import ColorPicker from '../components/common/ColorPicker/ColorPicker.component';
import DomainSelectableList from '../components/common/DomainSelectableList/DomainSelectableList.component';
import { DomainSelectableListProps } from '../components/common/DomainSelectableList/DomainSelectableList.interface';
import FilterPattern from '../components/common/FilterPattern/FilterPattern';
import { FilterPatternProps } from '../components/common/FilterPattern/filterPattern.interface';
import FormItemLabel from '../components/common/Form/FormItemLabel';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import RichTextEditor from '../components/common/RichTextEditor/RichTextEditor';
import { RichTextEditorProp } from '../components/common/RichTextEditor/RichTextEditor.interface';
import SanitizedInput from '../components/common/SanitizedInput/SanitizedInput';
import SliderWithInput from '../components/common/SliderWithInput/SliderWithInput';
import { SliderWithInputProps } from '../components/common/SliderWithInput/SliderWithInput.interface';
import TagSuggestion, {
  TagSuggestionProps,
} from '../components/common/TagSuggestion/TagSuggestion';
import { UserSelectableList } from '../components/common/UserSelectableList/UserSelectableList.component';
import { UserSelectableListProps } from '../components/common/UserSelectableList/UserSelectableList.interface';
import { UserTeamSelectableList } from '../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { UserSelectDropdownProps } from '../components/common/UserTeamSelectableList/UserTeamSelectableList.interface';
import UserTeamSelectableListSearchInput from '../components/common/UserTeamSelectableListSearchInput/UserTeamSelectableListSearchInput.component';
import { HTTP_STATUS_CODE } from '../constants/Auth.constants';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../interface/FormUtils.interface';
import AntDTagSuggestion, {
  TagSuggestionProps as AntDTagSuggestionProps,
} from '../pages/TasksPage/shared/TagSuggestion';
import { t } from './i18next/LocalUtil';
import { getErrorText } from './StringUtils';

type FieldPropsBag = Record<string, unknown> & { children?: ReactNode };

interface FieldRenderContext {
  props: FieldPropsBag;
  id: string;
  placeholder?: string;
  label: ReactNode;
  formProps: FormItemProps;
  fieldRules: FieldProp['rules'];
}

interface FieldElementResult {
  element: ReactNode;
  formPropsPatch?: Partial<FormItemProps>;
}

// Maps a field type to the element it renders, keeping getField's own
// complexity independent of how many field types exist.
const FIELD_ELEMENT_RENDERERS: Partial<
  Record<FieldTypes, (ctx: FieldRenderContext) => FieldElementResult>
> = {
  [FieldTypes.TEXT]: ({ props, id, placeholder }) => ({
    element: <SanitizedInput {...props} id={id} placeholder={placeholder} />,
  }),
  [FieldTypes.PASSWORD]: ({ props, id, placeholder }) => ({
    element: (
      <Input.Password
        {...props}
        autoComplete="off"
        id={id}
        placeholder={placeholder}
      />
    ),
  }),
  [FieldTypes.NUMBER]: ({ props, id, placeholder }) => ({
    element: (
      <InputNumber id={id} placeholder={placeholder} size="small" {...props} />
    ),
  }),
  [FieldTypes.FILTER_PATTERN]: ({ props }) => ({
    element: <FilterPattern {...(props as unknown as FilterPatternProps)} />,
  }),
  [FieldTypes.SWITCH]: ({ props, id }) => ({
    element: <Switch {...props} id={id} />,
    formPropsPatch: { valuePropName: 'checked' },
  }),
  [FieldTypes.CHECK_BOX]: ({ props, id }) => ({
    element: <Checkbox {...props} id={id} />,
    formPropsPatch: { valuePropName: 'checked' },
  }),
  [FieldTypes.SELECT]: ({ props, id }) => ({
    element: <Select {...props} id={id} />,
  }),
  [FieldTypes.SLIDER_INPUT]: ({ props }) => ({
    element: (
      <SliderWithInput {...(props as unknown as SliderWithInputProps)} />
    ),
  }),
  [FieldTypes.DESCRIPTION]: ({ props }) => ({
    element: <RichTextEditor {...(props as unknown as RichTextEditorProp)} />,
    formPropsPatch: {
      trigger: 'onTextChange',
      initialValue: props?.initialValue ?? '',
    },
  }),
  [FieldTypes.TAG_SUGGESTION]: ({ props }) => ({
    element: (
      <AntDTagSuggestion
        {...(props as unknown as AntDTagSuggestionProps)}
        newLook
      />
    ),
  }),
  [FieldTypes.TREE_ASYNC_SELECT_LIST]: ({ props }) => ({
    element: (
      <TreeAsyncSelectList
        {...(props as unknown as Omit<AsyncSelectListProps, 'fetchOptions'>)}
      />
    ),
  }),
  [FieldTypes.ASYNC_SELECT_LIST]: ({ props }) => ({
    element: (
      <AsyncSelectList {...(props as unknown as AsyncSelectListProps)} />
    ),
  }),
  [FieldTypes.DOMAIN_SELECT]: ({ props }) => {
    const { children, ...rest } = props;

    return {
      element: (
        <DomainSelectableList
          {...(rest as unknown as DomainSelectableListProps)}>
          {children}
        </DomainSelectableList>
      ),
    };
  },
  [FieldTypes.USER_TEAM_SELECT]: ({ props }) => {
    const { children, ...rest } = props;

    return {
      element: (
        <UserTeamSelectableList
          {...(rest as unknown as UserSelectDropdownProps)}>
          {children}
        </UserTeamSelectableList>
      ),
    };
  },
  [FieldTypes.USER_TEAM_SELECT_INPUT]: ({ props }) => ({
    element: (
      <UserTeamSelectableListSearchInput
        {...(props as unknown as UserSelectDropdownProps)}
      />
    ),
  }),
  [FieldTypes.USER_MULTI_SELECT]: ({ props }) => {
    const { children, ...rest } = props;

    return {
      element: (
        <UserSelectableList {...(rest as unknown as UserSelectableListProps)}>
          {children}
        </UserSelectableList>
      ),
    };
  },
  [FieldTypes.COLOR_PICKER]: ({ props }) => ({
    element: <ColorPicker {...props} />,
  }),
  [FieldTypes.COMPONENT]: ({ props }) => ({
    element: props.children,
  }),
};

const renderUtTextField = ({
  formProps,
  props,
  id,
  placeholder,
  label,
  fieldRules,
}: FieldRenderContext) => {
  const isRequired = (fieldRules ?? []).some(
    (rule) => (rule as RuleObject).required
  );
  const { 'data-testid': dataTestId, ...inputRest } = props;

  return (
    <Form.Item
      {...formProps}
      getValueProps={(value) => ({ value: (value as string) ?? '' })}>
      <UTInput
        {...(inputRest as Partial<ComponentProps<typeof UTInput>>)}
        id={id}
        inputDataTestId={dataTestId as string}
        isRequired={isRequired}
        label={isString(label) ? label : undefined}
        placeholder={placeholder}
      />
    </Form.Item>
  );
};

const renderUtSelectField = ({
  formProps,
  props,
  id,
  placeholder,
  label,
  fieldRules,
}: FieldRenderContext) => {
  const isRequired = (fieldRules ?? []).some(
    (rule) => (rule as RuleObject).required
  );
  const { items = [], ...selectRest } = props as {
    items?: SelectItemType[];
  } & Record<string, unknown>;

  return (
    <Form.Item
      {...formProps}
      getValueProps={(value) => ({ selectedKey: value ?? null })}
      trigger="onSelectionChange"
      validateTrigger="onSelectionChange"
      valuePropName="selectedKey">
      <UTSelect
        {...(selectRest as Partial<ComponentProps<typeof UTSelect>>)}
        id={id}
        isRequired={isRequired}
        items={items}
        label={isString(label) ? label : undefined}
        placeholder={placeholder}>
        {(item: SelectItemType) => <UTSelect.Item {...item} />}
      </UTSelect>
    </Form.Item>
  );
};

const renderUtTagSuggestionField = ({
  formProps,
  props,
  placeholder,
  label,
  fieldRules,
}: FieldRenderContext) => {
  const isRequired = (fieldRules ?? []).some(
    (rule) => (rule as RuleObject).required
  );

  return (
    <Form.Item {...formProps}>
      <TagSuggestion
        {...(props as unknown as TagSuggestionProps)}
        label={typeof label === 'string' ? label : undefined}
        placeholder={placeholder}
        required={isRequired}
      />
    </Form.Item>
  );
};

const renderUtSwitchField = ({
  formProps,
  props,
  label,
}: FieldRenderContext) => {
  const { isDisabled, onChange, size, ...switchRest } = props as ToggleProps;

  return (
    <Form.Item {...formProps} valuePropName="isSelected">
      <Toggle
        isDisabled={isDisabled}
        label={isString(label) ? label : undefined}
        size={size}
        onChange={onChange}
        {...switchRest}
      />
    </Form.Item>
  );
};

// These field types render their own complete Form.Item (a different shape
// than the common wrapper below) and return immediately, matching the
// original switch-case early returns.
const CUSTOM_FIELD_RENDERERS: Partial<
  Record<FieldTypes, (ctx: FieldRenderContext) => ReactNode>
> = {
  [FieldTypes.UT_TEXT]: renderUtTextField,
  [FieldTypes.UT_SELECT]: renderUtSelectField,
  [FieldTypes.UT_TAG_SUGGESTION]: renderUtTagSuggestionField,
  [FieldTypes.UT_SWITCH]: renderUtSwitchField,
};

const shouldShowHelperAlert = (
  helperTextType: HelperTextType | undefined,
  helperText: ReactNode,
  showHelperText: boolean
): boolean =>
  helperTextType === HelperTextType.ALERT &&
  Boolean(helperText) &&
  showHelperText;

export const getField = (field: FieldProp) => {
  const {
    label,
    name,
    type,
    helperText,
    helperTextType,
    showHelperText = true,
    required,
    props = {},
    rules = [],
    placeholder,
    id,
    formItemProps,
    hasSeparator = false,
    formItemLayout = FormItemLayout.VERTICAL,
    isBeta = false,
    newLook = false,
  } = field;

  let fieldElement: ReactNode = null;
  let fieldRules = [...rules];
  // Check if required rule is already present to avoid rule duplication
  const isRequiredRulePresent = rules.some(
    (rule) => (rule as RuleObject).required ?? false
  );

  if (required && !isRequiredRulePresent) {
    fieldRules = [
      ...fieldRules,
      {
        required,
        message: t('label.field-required', {
          field: startCase(toString(name)),
        }),
      },
    ];
  }

  const formProps: FormItemProps = {
    id: id,
    name: name,
    rules: fieldRules,
    ...formItemProps,
  };

  const renderContext: FieldRenderContext = {
    props,
    id,
    placeholder,
    label,
    formProps,
    fieldRules,
  };

  const customRenderer = CUSTOM_FIELD_RENDERERS[type];
  if (customRenderer) {
    return customRenderer(renderContext);
  }

  const elementRenderer = FIELD_ELEMENT_RENDERERS[type];
  if (elementRenderer) {
    const { element, formPropsPatch } = elementRenderer(renderContext);
    fieldElement = element;
    Object.assign(formProps, formPropsPatch);
  }

  const labelValue = (
    <FormItemLabel
      align={props.tooltipAlign as TooltipProps['align']}
      helperText={helperText}
      helperTextType={helperTextType}
      isBeta={isBeta}
      label={label}
      overlayClassName={props.overlayClassName as string}
      overlayInnerStyle={props.overlayInnerStyle as React.CSSProperties}
      placement={props.tooltipPlacement as TooltipPlacement}
      showHelperText={showHelperText}
    />
  );

  if (type === FieldTypes.SWITCH && newLook) {
    return (
      <div className="d-flex gap-2 form-switch-container">
        <Form.Item className="m-b-0" {...formProps}>
          <Switch />
        </Form.Item>
        <Typography.Text className="font-medium">{labelValue}</Typography.Text>
      </div>
    );
  }

  return (
    <Fragment key={id}>
      <Form.Item
        className={classNames({
          'form-item-horizontal': formItemLayout === FormItemLayout.HORIZONTAL,
          'form-item-vertical': formItemLayout === FormItemLayout.VERTICAL,
          'm-b-xss': helperTextType === HelperTextType.ALERT,
        })}
        {...formProps}
        label={labelValue}>
        {fieldElement}
      </Form.Item>

      {shouldShowHelperAlert(helperTextType, helperText, showHelperText) && (
        <Alert
          showIcon
          className="m-b-lg alert-icon"
          data-testid="form-item-alert"
          message={helperText}
          type="warning"
        />
      )}

      {hasSeparator && <Divider />}
    </Fragment>
  );
};

export const generateFormFields = (fields: FieldProp[]) => {
  return (
    <>
      {fields.map((field, index) => (
        <Fragment key={field.id || index}>{getField(field)}</Fragment>
      ))}
    </>
  );
};

export const setInlineErrorValue = (
  description: string,
  serverAPIError: string,
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void
) => {
  setInlineAlertDetails({
    type: 'error',
    heading: t('label.error'),
    description,
    subDescription: serverAPIError,
    onClose: () => setInlineAlertDetails(undefined),
  });
};

export const handleEntityCreationError = ({
  error,
  setInlineAlertDetails,
  entity,
  entityLowercase,
  entityLowercasePlural,
  name,
  defaultErrorType,
}: {
  error: AxiosError;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void;
  entity: string;
  entityLowercase?: string;
  entityLowercasePlural?: string;
  name: string;
  defaultErrorType?: 'create';
}) => {
  if (error.response?.status === HTTP_STATUS_CODE.CONFLICT) {
    setInlineErrorValue(
      t('server.entity-already-exist', {
        entity,
        entityPlural: entityLowercasePlural ?? entity,
        name: name,
      }),
      getErrorText(error, t('server.unexpected-error')),
      setInlineAlertDetails
    );

    return;
  }

  if (error.response?.status === HTTP_STATUS_CODE.LIMIT_REACHED) {
    setInlineErrorValue(
      t('server.entity-limit-reached', {
        entity,
      }),
      getErrorText(error, t('server.unexpected-error')),
      setInlineAlertDetails
    );

    return;
  }

  setInlineErrorValue(
    defaultErrorType === 'create'
      ? t(`server.entity-creation-error`, {
          entity: entityLowercase ?? entity,
        })
      : getErrorText(error, t('server.unexpected-error')),
    getErrorText(error, t('server.unexpected-error')),
    setInlineAlertDetails
  );
};
