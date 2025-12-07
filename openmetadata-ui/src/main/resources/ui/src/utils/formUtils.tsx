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
import { Autocomplete, Switch as MUISwitch } from '@mui/material';
import { TooltipProps as MUITooltipProps } from '@mui/material/Tooltip';
import { ErrorTransformer } from '@rjsf/utils';
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
import { compact, startCase, toString } from 'lodash';
import React, { Fragment, ReactNode } from 'react';
import AsyncSelectList from '../components/common/AsyncSelectList/AsyncSelectList';
import { AsyncSelectListProps } from '../components/common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../components/common/AsyncSelectList/TreeAsyncSelectList';
import { MUIColorPicker } from '../components/common/ColorPicker';
import ColorPicker from '../components/common/ColorPicker/ColorPicker.component';
import { MUICoverImageUpload } from '../components/common/CoverImageUpload';
import DomainSelectableList from '../components/common/DomainSelectableList/DomainSelectableList.component';
import { DomainSelectableListProps } from '../components/common/DomainSelectableList/DomainSelectableList.interface';
import FilterPattern from '../components/common/FilterPattern/FilterPattern';
import { FilterPatternProps } from '../components/common/FilterPattern/filterPattern.interface';
import FormItemLabel from '../components/common/Form/FormItemLabel';
import { MUIIconPicker } from '../components/common/IconPicker';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import MUIDomainSelect from '../components/common/MUIDomainSelect/MUIDomainSelect';
import { MUIDomainSelectProps } from '../components/common/MUIDomainSelect/MUIDomainSelect.interface';
import MUIFormItemLabel from '../components/common/MUIFormItemLabel';
import MUIGlossaryTagSuggestion from '../components/common/MUIGlossaryTagSuggestion/MUIGlossaryTagSuggestion';
import MUISelect from '../components/common/MUISelect/MUISelect';
import MUITagSuggestion from '../components/common/MUITagSuggestion/MUITagSuggestion';
import MUITextField from '../components/common/MUITextField/MUITextField';
import MUIUserTeamSelect, {
  MUIUserTeamSelectProps,
} from '../components/common/MUIUserTeamSelect/MUIUserTeamSelect';
import RichTextEditor from '../components/common/RichTextEditor/RichTextEditor';
import { RichTextEditorProp } from '../components/common/RichTextEditor/RichTextEditor.interface';
import SanitizedInput from '../components/common/SanitizedInput/SanitizedInput';
import SliderWithInput from '../components/common/SliderWithInput/SliderWithInput';
import { SliderWithInputProps } from '../components/common/SliderWithInput/SliderWithInput.interface';
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
import TagSuggestion, {
  TagSuggestionProps,
} from '../pages/TasksPage/shared/TagSuggestion';
import { t } from './i18next/LocalUtil';
import { getErrorText } from './StringsUtils';

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
        <TagSuggestion {...(props as unknown as TagSuggestionProps)} newLook />
      );

      break;

    case FieldTypes.TAG_SUGGESTION_MUI: {
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      return (
        <Form.Item {...formProps}>
          <MUITagSuggestion
            {...(props as unknown as TagSuggestionProps)}
            label={muiLabel}
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
            {...(props as unknown as TagSuggestionProps)}
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
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      const AutocompleteWrapper = ({
        value,
        onChange,
      }: {
        value?: string[];
        onChange?: (value: string[]) => void;
      }) => {
        const handleChange = (_event: unknown, newValue: string[]) => {
          onChange?.(newValue);
        };

        const hasValue = value && value.length > 0;

        return (
          <Autocomplete
            freeSolo
            multiple
            options={[]}
            renderInput={(params) => (
              <MUITextField
                {...params}
                label={muiLabel}
                placeholder={hasValue ? undefined : placeholder}
                required={isRequired}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
              />
            )}
            value={value || []}
            onChange={handleChange}
            {...(props as Record<string, unknown>)}
          />
        );
      };

      return (
        <Form.Item {...formProps}>
          <AutocompleteWrapper />
        </Form.Item>
      );
    }

    case FieldTypes.SWITCH_MUI: {
      const isRequired = fieldRules.some(
        (rule) => (rule as RuleObject).required
      );

      const MUISwitchWrapper = ({
        checked = false,
        onChange,
      }: {
        checked?: boolean;
        onChange?: (checked: boolean) => void;
      }) => {
        const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
          onChange?.(event.target.checked);
        };

        return (
          <div className="d-flex gap-2 items-center">
            <MUISwitch
              checked={checked}
              required={isRequired}
              onChange={handleChange}
              {...(props as Record<string, unknown>)}
            />
            {muiLabel && (
              <Typography.Text className="font-medium">
                {muiLabel}
              </Typography.Text>
            )}
          </div>
        );
      };

      return (
        <Form.Item {...formProps} valuePropName="checked">
          <MUISwitchWrapper />
        </Form.Item>
      );
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
    const labelClass =
      typeof props.labelClassName === 'string' ? `${props.labelClassName}` : '';

    return (
      <div className="d-flex gap-2 form-switch-container items-center">
        <Form.Item className="m-b-0" {...formProps}>
          <Switch />
        </Form.Item>
        <Typography.Text className={`font-medium ${labelClass}`}>
          {labelValue}
        </Typography.Text>
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

export const transformErrors: ErrorTransformer = (errors) => {
  const errorRet = errors.map((error) => {
    const { property, params, name } = error;

    /**
     * For nested fields we have to check if it's property start with "."
     * else we will just prepend the root to property
     */
    const id = property?.startsWith('.')
      ? 'root' + property?.replaceAll('.', '/')
      : `root/${property}`;

    // If element is not present in DOM, ignore error
    if (document.getElementById(id)) {
      const fieldName = startCase(property?.split('/').pop() ?? '');

      const errorMessages = {
        required: () => ({
          message: t('message.field-text-is-required', {
            fieldText: startCase(params?.missingProperty),
          }),
        }),
        minimum: () => ({
          message: t('message.value-must-be-greater-than', {
            field: fieldName,
            minimum: params?.limit,
          }),
        }),
      };

      const errorHandler = errorMessages[name as keyof typeof errorMessages];
      if (errorHandler && params) {
        error.message = errorHandler().message;

        return error;
      }
    }

    return null;
  });

  return compact(errorRet);
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

export const getPopupContainer = (triggerNode: HTMLElement) =>
  triggerNode.parentElement || document.body;

/**
 * Configuration options for custom scroll-to-error behavior
 */
export interface ScrollToErrorOptions {
  /** CSS selector for the scrollable container. Defaults to '.drawer-form-content' for drawer layouts */
  scrollContainer?: string;
  /** CSS selector for form error elements. Defaults to '.ant-form-item-has-error' */
  errorSelector?: string;
  /** Offset from top in pixels for better visibility. Defaults to 100 */
  offsetTop?: number;
  /** Delay in milliseconds before scrolling. Defaults to 100 */
  delay?: number;
  /** Scroll behavior. Defaults to 'smooth' */
  behavior?: ScrollBehavior;
}

/**
 * Creates a reusable scroll-to-error handler for forms in complex layouts
 *
 * This utility is particularly useful when:
 * - Form is inside a drawer or modal with custom scroll containers
 * - Ant Design's built-in scrollToFirstError doesn't work due to layout complexity
 * - Form is nested within grid layouts or other complex structures
 *
 * @param options - Configuration options for scroll behavior
 * @returns Function to be used as onFinishFailed handler for Ant Design forms
 *
 * @example
 * ```tsx
 * // Basic usage for drawer forms
 * const scrollToError = createScrollToErrorHandler();
 *
 * <Form onFinishFailed={scrollToError}>
 *   // form content
 * </Form>
 *
 * // Custom configuration
 * const scrollToError = createScrollToErrorHandler({
 *   scrollContainer: '.my-custom-scroll-container',
 *   offsetTop: 150,
 *   delay: 50
 * });
 * ```
 */
export const createScrollToErrorHandler = (
  options: ScrollToErrorOptions = {}
) => {
  const {
    scrollContainer = '.drawer-form-content',
    errorSelector = '.ant-form-item-has-error',
    offsetTop = 100,
    delay = 100,
    behavior = 'smooth',
  } = options;

  return () => {
    setTimeout(() => {
      const firstError = document.querySelector(errorSelector);
      if (firstError) {
        const scrollableContainer = document.querySelector(scrollContainer);
        if (scrollableContainer) {
          const errorRect = firstError.getBoundingClientRect();
          const containerRect = scrollableContainer.getBoundingClientRect();
          const scrollTop =
            scrollableContainer.scrollTop +
            errorRect.top -
            containerRect.top -
            offsetTop;

          scrollableContainer.scrollTo({
            top: Math.max(0, scrollTop), // Ensure we don't scroll to negative values
            behavior,
          });
        } else {
          // Fallback to standard scrollIntoView if container not found
          firstError.scrollIntoView({
            behavior,
            block: 'center',
            inline: 'nearest',
          });
        }
      }
    }, delay);
  };
};
