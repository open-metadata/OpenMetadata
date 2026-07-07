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
import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType, UiSchema } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { isUndefined, omit, omitBy } from 'lodash';
import {
  forwardRef,
  lazy,
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  EXCLUDE_INCREMENTAL_EXTRACTION_SUPPORT_UI_SCHEMA,
  INGESTION_ELASTIC_SEARCH_WORKFLOW_UI_SCHEMA,
  INGESTION_WORKFLOW_UI_SCHEMA,
} from '../../../../../constants/Services.constant';
import {
  DbtConfigType,
  PipelineType,
} from '../../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionWorkflowData,
  IngestionWorkflowFormHandle,
  IngestionWorkflowFormProps,
} from '../../../../../interface/service.interface';
import ProfilerConfigurationClassBase from '../../../../../pages/ProfilerConfigurationPage/ProfilerConfigurationClassBase';
import { transformErrors } from '../../../../../utils/formPureUtils';
import { getSchemaByWorkflowType } from '../../../../../utils/IngestionWorkflowUtils';
import CoreInputWidget from '../../../../common/FormBuilderV1/widgets/CoreInputWidget';
import CoreSelectWidget from '../../../../common/FormBuilderV1/widgets/CoreSelectWidget';
import Loader from '../../../../common/Loader/Loader';

const BooleanFieldTemplate = lazy(
  () =>
    import(
      '../../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate'
    )
);
const WorkflowArrayFieldTemplate = lazy(
  () =>
    import(
      '../../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate'
    )
);
const CodeWidget = lazy(
  () =>
    import(
      '../../../../common/Form/JSONSchema/JsonSchemaWidgets/CodeWidget/CodeWidget'
    )
);
const ManifestJsonWidget = lazy(
  () =>
    import(
      '../../../../common/Form/JSONSchema/JsonSchemaWidgets/ManifestJsonWidget/ManifestJsonWidget'
    )
);
const CoreOneOfField = lazy(
  () => import('../../../../common/FormBuilderV1/fields/CoreOneOfField')
);
const CoreArrayFieldTemplate = lazy(() =>
  import(
    '../../../../common/FormBuilderV1/templates/CoreArrayFieldTemplate'
  ).then((m) => ({ default: m.CoreArrayFieldTemplate }))
);
const CoreFieldErrorTemplate = lazy(() =>
  import(
    '../../../../common/FormBuilderV1/templates/CoreFieldErrorTemplate'
  ).then((m) => ({ default: m.CoreFieldErrorTemplate }))
);
const CoreFieldTemplate = lazy(() =>
  import('../../../../common/FormBuilderV1/templates/CoreFieldTemplate').then(
    (m) => ({ default: m.CoreFieldTemplate })
  )
);
const CoreWrapIfAdditionalTemplate = lazy(() =>
  import(
    '../../../../common/FormBuilderV1/templates/CoreWrapIfAdditionalTemplate'
  ).then((m) => ({ default: m.CoreWrapIfAdditionalTemplate }))
);
const CoreCheckboxWidget = lazy(
  () => import('../../../../common/FormBuilderV1/widgets/CoreCheckboxWidget')
);
const CorePasswordWidget = lazy(
  () => import('../../../../common/FormBuilderV1/widgets/CorePasswordWidget')
);
const CoreRadioWidget = lazy(
  () => import('../../../../common/FormBuilderV1/widgets/CoreRadioWidget')
);
const CoreTextAreaWidget = lazy(
  () => import('../../../../common/FormBuilderV1/widgets/CoreTextAreaWidget')
);
const IngestionObjectFieldTemplate = lazy(() =>
  import(
    '../../AddIngestion/IngestionObjectFieldTemplate/IngestionObjectFieldTemplate'
  ).then((m) => ({ default: m.IngestionObjectFieldTemplate }))
);
const FilterPatternField = lazy(() =>
  import('../../ServiceConfig/FilterPatternField').then((m) => ({
    default: m.FilterPatternField,
  }))
);
const ProfileSampleConfigField = lazy(
  () => import('./ProfileSampleConfigField')
);

const IngestionWorkflowForm = forwardRef<
  IngestionWorkflowFormHandle,
  IngestionWorkflowFormProps
>(function IngestionWorkflowForm(
  {
    pipeLineType,
    className,
    okText,
    cancelText,
    hideFooter = false,
    serviceCategory,
    workflowData,
    operationType,
    onCancel,
    onFocus,
    onSubmit,
    onChange,
    serviceData,
  }: Readonly<IngestionWorkflowFormProps>,
  ref
) {
  const formRef = useRef<Form<IngestionWorkflowData>>(null);
  const [internalData, setInternalData] =
    useState<IngestionWorkflowData>(workflowData);
  const { t } = useTranslation();

  const schema = useMemo(
    () => getSchemaByWorkflowType(pipeLineType, serviceCategory),

    [pipeLineType, serviceCategory]
  );

  const validator = useMemo(
    () => customizeValidator<IngestionWorkflowData>(),
    []
  );

  const isElasticSearchPipeline =
    pipeLineType === PipelineType.ElasticSearchReindex;

  const isDbtPipeline = pipeLineType === PipelineType.Dbt;

  const isIncrementalExtractionSupported =
    serviceData?.connection?.config?.supportsIncrementalMetadataExtraction;

  const uiSchema = useMemo(() => {
    let commonSchema: UiSchema = { ...INGESTION_WORKFLOW_UI_SCHEMA };
    if (isElasticSearchPipeline) {
      commonSchema = {
        ...commonSchema,
        ...INGESTION_ELASTIC_SEARCH_WORKFLOW_UI_SCHEMA,
      };
    }

    if (!isIncrementalExtractionSupported) {
      commonSchema = {
        ...commonSchema,
        ...EXCLUDE_INCREMENTAL_EXTRACTION_SUPPORT_UI_SCHEMA,
      };
    }

    if (pipeLineType === PipelineType.Profiler) {
      commonSchema = {
        ...commonSchema,
        profileSampleConfig: {
          'ui:field': 'ProfileSampleConfigField',
        },
      };
    }

    return commonSchema;
  }, [pipeLineType, operationType]);

  const handleOnChange = (e: IChangeEvent<IngestionWorkflowData>) => {
    if (e.formData) {
      setInternalData(e.formData);

      let formData = { ...e.formData };
      if (isElasticSearchPipeline) {
        formData = {
          ...omit(formData, [
            'useSSL',
            'verifyCerts',
            'timeout',
            'caCerts',
            'useAwsCredentials',
            'regionName',
          ]),
        };
      }
      if (isDbtPipeline) {
        formData = {
          ...formData,
          dbtConfigSource: {
            ...omitBy(formData.dbtConfigSource ?? {}, isUndefined),
            dbtConfigType: formData.dbtConfigSource
              ?.dbtConfigType as DbtConfigType,
          },
        };
      }
      onChange?.(formData);
    }
  };

  const customFields = useMemo(() => {
    const fields: RegistryFieldsType = {
      AnyOfField: CoreOneOfField,
      ArrayField: WorkflowArrayFieldTemplate,
      BooleanField: BooleanFieldTemplate,
      FilterPatternField,
      OneOfField: CoreOneOfField,
    };

    const SparkAgentField = ProfilerConfigurationClassBase.getSparkAgentField();

    if (
      !isUndefined(SparkAgentField) &&
      pipeLineType === PipelineType.Profiler
    ) {
      fields['/schemas/rootProcessingEngine'] = SparkAgentField;
    }

    if (pipeLineType === PipelineType.Profiler) {
      fields['ProfileSampleConfigField'] = ProfileSampleConfigField;
    }

    return fields;
  }, [pipeLineType]);

  // Exposes submit to the parent card footer, which triggers the form when hideFooter is true.
  useImperativeHandle(
    ref,
    () => ({ submit: () => formRef.current?.submit() }),
    []
  );

  const handleSubmit = (e: IChangeEvent<IngestionWorkflowData>) => {
    if (e.formData) {
      let formData = { ...e.formData };
      if (isElasticSearchPipeline) {
        formData = {
          ...omit(formData, [
            'useSSL',
            'verifyCerts',
            'timeout',
            'caCerts',
            'useAwsCredentials',
            'regionName',
          ]),
        };
      }
      if (isDbtPipeline) {
        formData = {
          ...formData,
          dbtConfigSource: {
            ...omitBy(formData.dbtConfigSource ?? {}, isUndefined),
            dbtConfigType: formData.dbtConfigSource
              ?.dbtConfigType as DbtConfigType,
          },
        };
      }

      onSubmit(formData);
    }
  };

  return (
    <Suspense fallback={<Loader />}>
      <Form
        focusOnFirstError
        noHtml5Validate
        className={classNames('rjsf no-header', className)}
        fields={customFields}
        formContext={{ handleFocus: onFocus }}
        formData={internalData}
        idSeparator="/"
        ref={formRef}
        schema={schema}
        showErrorList={false}
        templates={{
          ArrayFieldTemplate: CoreArrayFieldTemplate,
          FieldErrorTemplate: CoreFieldErrorTemplate,
          FieldTemplate: CoreFieldTemplate,
          ObjectFieldTemplate: IngestionObjectFieldTemplate,
          WrapIfAdditionalTemplate: CoreWrapIfAdditionalTemplate,
        }}
        transformErrors={transformErrors}
        uiSchema={uiSchema}
        validator={validator}
        widgets={{
          CheckboxWidget: CoreCheckboxWidget,
          EmailWidget: CoreInputWidget,
          PasswordWidget: CorePasswordWidget,
          RadioWidget: CoreRadioWidget,
          SelectWidget: CoreSelectWidget,
          TextWidget: CoreInputWidget,
          TextareaWidget: CoreTextAreaWidget,
          URLWidget: CoreInputWidget,
          UpDownWidget: CoreInputWidget,
          code: CodeWidget,
          manifestJson: ManifestJsonWidget,
        }}
        onChange={handleOnChange}
        onFocus={onFocus}
        onSubmit={handleSubmit}>
        {/* When hideFooter is true, the parent card renders the footer to span full width
         * and keep the card's bottom border-radius visible during scroll. */}
        {!hideFooter && (
          <div className="d-flex w-full justify-end">
            <Space>
              <Button type="link" onClick={onCancel}>
                {cancelText ?? t('label.cancel')}
              </Button>

              <Button data-testid="submit-btn" htmlType="submit" type="primary">
                {okText ?? t('label.save')}
              </Button>
            </Space>
          </div>
        )}
      </Form>
    </Suspense>
  );
});

IngestionWorkflowForm.displayName = 'IngestionWorkflowForm';

export default IngestionWorkflowForm;
