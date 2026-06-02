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
export {
  createScrollToErrorHandler,
  getPopupContainer,
  handleEntityCreationError,
  setInlineErrorValue,
  transformErrors,
} from './formPureUtils';
import { TooltipProps as MUITooltipProps } from '@mui/material/Tooltip';
import { Toggle, ToggleProps } from '@openmetadata/ui-core-components';
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
import classNames from 'classnames';
import { isString, startCase, toString } from 'lodash';
import React, { Fragment, lazy, ReactNode } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { AsyncSelectListProps } from '../components/common/AsyncSelectList/AsyncSelectList.interface';
import { DomainSelectableListProps } from '../components/common/DomainSelectableList/DomainSelectableList.interface';
import { FilterPatternProps } from '../components/common/FilterPattern/filterPattern.interface';
import FormItemLabel from '../components/common/Form/FormItemLabel';
import { MUIDomainSelectProps } from '../components/common/MUIDomainSelect/MUIDomainSelect.interface';
import MUIFormItemLabel from '../components/common/MUIFormItemLabel';
import type { MUIUserTeamSelectProps } from '../components/common/MUIUserTeamSelect/MUIUserTeamSelect';
import { RichTextEditorProp } from '../components/common/RichTextEditor/RichTextEditor.interface';
import { SliderWithInputProps } from '../components/common/SliderWithInput/SliderWithInput.interface';
import { TagSuggestionProps } from '../components/common/TagSuggestion/TagSuggestion';
import { UserSelectableListProps } from '../components/common/UserSelectableList/UserSelectableList.interface';
import { UserSelectDropdownProps } from '../components/common/UserTeamSelectableList/UserTeamSelectableList.interface';
import { MUIAutocompleteProps } from '../components/form/MUIAutocomplete/MUIAutocomplete.interface';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../interface/FormUtils.interface';
import { TagSuggestionProps as AntDTagSuggestionProps } from '../pages/TasksPage/shared/TagSuggestion';
import { t } from './i18next/LocalUtil';

const AsyncSelectList = withSuspenseFallback(
  lazy(() => import('../components/common/AsyncSelectList/AsyncSelectList'))
);

const TreeAsyncSelectList = withSuspenseFallback(
  lazy(() => import('../components/common/AsyncSelectList/TreeAsyncSelectList'))
);

const MUIColorPicker = withSuspenseFallback(
  lazy(() =>
    import('../components/common/ColorPicker').then((module) => ({
      default: module.MUIColorPicker,
    }))
  )
);

const ColorPicker = withSuspenseFallback(
  lazy(() => import('../components/common/ColorPicker/ColorPicker.component'))
);

const MUICoverImageUpload = withSuspenseFallback(
  lazy(() =>
    import('../components/common/CoverImageUpload').then((module) => ({
      default: module.MUICoverImageUpload,
    }))
  )
);

const DomainSelectableList = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/common/DomainSelectableList/DomainSelectableList.component'
      )
  )
);

const FilterPattern = withSuspenseFallback(
  lazy(() => import('../components/common/FilterPattern/FilterPattern'))
);

const MUIIconPicker = withSuspenseFallback(
  lazy(() =>
    import('../components/common/IconPicker').then((module) => ({
      default: module.MUIIconPicker,
    }))
  )
);

const MUIDomainSelect = withSuspenseFallback(
  lazy(() => import('../components/common/MUIDomainSelect/MUIDomainSelect'))
);

const MUIGlossaryTagSuggestion = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/common/MUIGlossaryTagSuggestion/MUIGlossaryTagSuggestion'
      )
  )
);

const MUISelect = withSuspenseFallback(
  lazy(() => import('../components/common/MUISelect/MUISelect'))
);

const MUITextField = withSuspenseFallback(
  lazy(() => import('../components/common/MUITextField/MUITextField'))
);

const MUIUserTeamSelect = withSuspenseFallback(
  lazy(() => import('../components/common/MUIUserTeamSelect/MUIUserTeamSelect'))
);

const RichTextEditor = withSuspenseFallback(
  lazy(() => import('../components/common/RichTextEditor/RichTextEditor'))
);

const SanitizedInput = withSuspenseFallback(
  lazy(() => import('../components/common/SanitizedInput/SanitizedInput'))
);

const SliderWithInput = withSuspenseFallback(
  lazy(() => import('../components/common/SliderWithInput/SliderWithInput'))
);

const TagSuggestion = withSuspenseFallback(
  lazy(() => import('../components/common/TagSuggestion/TagSuggestion'))
);

const UserSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/common/UserSelectableList/UserSelectableList.component'
    ).then((module) => ({ default: module.UserSelectableList }))
  )
);

const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../components/common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((module) => ({ default: module.UserTeamSelectableList }))
  )
);

const UserTeamSelectableListSearchInput = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/common/UserTeamSelectableListSearchInput/UserTeamSelectableListSearchInput.component'
      )
  )
);

const MUIAutocomplete = withSuspenseFallback(
  lazy(() => import('../components/form/MUIAutocomplete'))
);

const AntDTagSuggestion = withSuspenseFallback(
  lazy(() => import('../pages/TasksPage/shared/TagSuggestion'))
);

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

  // Define MUI label for MUI field types
  const muiLabel = field.muiLabel || (
    <MUIFormItemLabel
      helperText={helperText}
      helperTextType={helperTextType}
      isBeta={isBeta}
      label={label}
      placement={props?.tooltipPlacement as MUITooltipProps['placement']}
      showHelperText={showHelperText}
      slotProps={props?.slotProps as Partial<MUITooltipProps>}
    />
  );

  switch (type) {
    case FieldTypes.TEXT:
      fieldElement = (
        <SanitizedInput {...props} id={id} placeholder={placeholder} />
      );

      break;

    case FieldTypes.TEXT_MUI: {
      const { error, ...muiProps } = props;
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUITextField
            error={Boolean(error)}
            helperText={
              helperTextType === HelperTextType.ALERT ? helperText : undefined
            }
            id={id}
            label={muiLabel}
            placeholder={placeholder}
            required={isRequired}
            {...muiProps}
          />
        </Form.Item>
      );
    }

    case FieldTypes.PASSWORD_MUI: {
      const { error, ...muiProps } = props;
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUITextField
            error={Boolean(error)}
            helperText={
              helperTextType === HelperTextType.ALERT ? helperText : undefined
            }
            id={id}
            label={muiLabel}
            placeholder={placeholder}
            required={isRequired}
            type="password"
            {...muiProps}
          />
        </Form.Item>
      );
    }

    case FieldTypes.PASSWORD:
      fieldElement = (
        <Input.Password
          {...props}
          autoComplete="off"
          id={id}
          placeholder={placeholder}
        />
      );

      break;
    case FieldTypes.NUMBER:
      fieldElement = (
        <InputNumber
          id={id}
          placeholder={placeholder}
          size="small"
          {...props}
        />
      );

      break;

    case FieldTypes.FILTER_PATTERN:
      fieldElement = (
        <FilterPattern {...(props as unknown as FilterPatternProps)} />
      );

      break;

    case FieldTypes.SWITCH:
      fieldElement = <Switch {...props} id={id} />;
      formProps.valuePropName = 'checked';

      break;
    case FieldTypes.CHECK_BOX:
      fieldElement = <Checkbox {...props} id={id} />;
      formProps.valuePropName = 'checked';

      break;
    case FieldTypes.SELECT:
      fieldElement = <Select {...props} id={id} />;

      break;

    case FieldTypes.SELECT_MUI: {
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUISelect
            {...props}
            helperText={
              helperTextType === HelperTextType.ALERT ? helperText : undefined
            }
            id={id}
            label={muiLabel}
            placeholder={placeholder}
            required={isRequired}
          />
        </Form.Item>
      );
    }
    case FieldTypes.SLIDER_INPUT:
      fieldElement = (
        <SliderWithInput {...(props as unknown as SliderWithInputProps)} />
      );

      break;
    case FieldTypes.DESCRIPTION:
      fieldElement = (
        <RichTextEditor {...(props as unknown as RichTextEditorProp)} />
      );
      formProps.trigger = 'onTextChange';
      formProps.initialValue = props?.initialValue ?? '';

      break;
    case FieldTypes.TAG_SUGGESTION:
      fieldElement = (
        <AntDTagSuggestion
          {...(props as unknown as AntDTagSuggestionProps)}
          newLook
        />
      );

      break;

    case FieldTypes.UT_TAG_SUGGESTION: {
      const isRequired = fieldRules.some(
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
    }

    case FieldTypes.GLOSSARY_TAG_SUGGESTION_MUI: {
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUIGlossaryTagSuggestion
            {...(props as unknown as AntDTagSuggestionProps)}
            label={muiLabel}
            placeholder={placeholder}
            required={isRequired}
          />
        </Form.Item>
      );
    }

    case FieldTypes.TREE_ASYNC_SELECT_LIST:
      fieldElement = (
        <TreeAsyncSelectList
          {...(props as unknown as Omit<AsyncSelectListProps, 'fetchOptions'>)}
        />
      );

      break;

    case FieldTypes.ASYNC_SELECT_LIST:
      fieldElement = (
        <AsyncSelectList {...(props as unknown as AsyncSelectListProps)} />
      );

      break;
    case FieldTypes.DOMAIN_SELECT:
      {
        const { children, ...rest } = props;

        fieldElement = (
          <DomainSelectableList
            {...(rest as unknown as DomainSelectableListProps)}>
            {children}
          </DomainSelectableList>
        );
      }

      break;
    case FieldTypes.DOMAIN_SELECT_MUI: {
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUIDomainSelect
            {...(props as unknown as MUIDomainSelectProps)}
            label={muiLabel as string}
            placeholder={placeholder}
            required={isRequired}
          />
        </Form.Item>
      );
    }
    case FieldTypes.USER_TEAM_SELECT:
      {
        const { children, ...rest } = props;

        fieldElement = (
          <UserTeamSelectableList
            {...(rest as unknown as UserSelectDropdownProps)}>
            {children}
          </UserTeamSelectableList>
        );
      }

      break;

    case FieldTypes.USER_TEAM_SELECT_INPUT:
      fieldElement = (
        <UserTeamSelectableListSearchInput
          {...(props as unknown as UserSelectDropdownProps)}
        />
      );

      break;

    case FieldTypes.USER_MULTI_SELECT:
      {
        const { children, ...rest } = props;

        fieldElement = (
          <UserSelectableList {...(rest as unknown as UserSelectableListProps)}>
            {children}
          </UserSelectableList>
        );
      }

      break;
    case FieldTypes.COLOR_PICKER:
      fieldElement = <ColorPicker {...props} />;

      break;

    case FieldTypes.COLOR_PICKER_MUI: {
      return (
        <Form.Item {...formProps}>
          <MUIColorPicker
            {...(props as Record<string, unknown>)}
            label={muiLabel as string}
          />
        </Form.Item>
      );
    }

    case FieldTypes.USER_TEAM_SELECT_MUI: {
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUIUserTeamSelect
            {...(props as unknown as MUIUserTeamSelectProps)}
            label={muiLabel}
            placeholder={placeholder}
            required={isRequired}
          />
        </Form.Item>
      );
    }

    case FieldTypes.ICON_PICKER_MUI: {
      return (
        <Form.Item {...formProps}>
          <MUIIconPicker
            {...(props as Record<string, unknown>)}
            label={muiLabel as string}
            toolTip={helperText}
          />
        </Form.Item>
      );
    }

    case FieldTypes.COVER_IMAGE_UPLOAD_MUI: {
      return (
        <Form.Item {...formProps}>
          <MUICoverImageUpload
            {...(props as Record<string, unknown>)}
            label={muiLabel as string}
          />
        </Form.Item>
      );
    }

    case FieldTypes.AUTOCOMPLETE_MUI: {
      return (
        <Form.Item {...formProps}>
          <MUIAutocomplete
            label={muiLabel as string}
            placeholder={placeholder}
            {...(props as MUIAutocompleteProps)}
          />
        </Form.Item>
      );
    }

    case FieldTypes.UT_SWITCH: {
      const { isDisabled, onChange, size, ...switchRest } =
        props as ToggleProps;

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
    }

    case FieldTypes.COMPONENT: {
      fieldElement = props.children;

      break;
    }

    default:
      break;
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

      {helperTextType === HelperTextType.ALERT &&
        helperText &&
        showHelperText && (
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
