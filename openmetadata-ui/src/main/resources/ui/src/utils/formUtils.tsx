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
import { Fragment, ReactNode } from 'react';
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
import { UserSelectableList } from '../components/common/UserSelectableList/UserSelectableList.component';
import { UserSelectableListProps } from '../components/common/UserSelectableList/UserSelectableList.interface';
import { UserTeamSelectSimple } from '../components/common/UserTeamSelect/UserTeamSelectSimple.component';
import { UserTeamSelectableList } from '../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { UserSelectDropdownProps } from '../components/common/UserTeamSelectableList/UserTeamSelectableList.interface';
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

  let internalFormItemProps: FormItemProps = {};
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

  switch (type) {
    case FieldTypes.TEXT:
      fieldElement = (
        <SanitizedInput {...props} id={id} placeholder={placeholder} />
      );

      break;
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

    case FieldTypes.TEXTAREA:
      fieldElement = (
        <Input.TextArea id={id} placeholder={placeholder} {...props} />
      );

      break;

    case FieldTypes.FILTER_PATTERN:
      fieldElement = (
        <FilterPattern {...(props as unknown as FilterPatternProps)} />
      );

      break;

    case FieldTypes.SWITCH:
      fieldElement = <Switch {...props} id={id} />;
      internalFormItemProps = {
        ...internalFormItemProps,
        valuePropName: 'checked',
      };

      break;
    case FieldTypes.CHECK_BOX:
      fieldElement = <Checkbox {...props} id={id} />;
      internalFormItemProps = {
        ...internalFormItemProps,
        valuePropName: 'checked',
      };

      break;
    case FieldTypes.SELECT:
      fieldElement = <Select {...props} id={id} />;

      break;
    case FieldTypes.SLIDER_INPUT:
      fieldElement = (
        <SliderWithInput {...(props as unknown as SliderWithInputProps)} />
      );

      break;
    case FieldTypes.DESCRIPTION:
      fieldElement = (
        <RichTextEditor {...(props as unknown as RichTextEditorProp)} />
      );
      internalFormItemProps = {
        ...internalFormItemProps,
        trigger: 'onTextChange',
        initialValue: props?.initialValue ?? '',
      };

      break;
    case FieldTypes.TAG_SUGGESTION:
      fieldElement = (
        <TagSuggestion {...(props as unknown as TagSuggestionProps)} newLook />
      );

      break;

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

    case FieldTypes.USER_TEAM_SELECT_SIMPLE:
      {
        const { children, ...rest } = props;

        fieldElement = (
          <UserTeamSelectSimple
            {...(rest as unknown as UserSelectDropdownProps)}>
            {children}
          </UserTeamSelectSimple>
        );
      }

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

    default:
      break;
  }

  const formProps = {
    id: id,
    key: id,
    name: name,
    rules: fieldRules,
    ...internalFormItemProps,
    ...formItemProps,
  };

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
  return <>{fields.map((field) => getField(field))}</>;
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
