/*
 *  Copyright 2024 Collate.
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

import { Form } from 'antd';
import { isEmpty, isEqual } from 'lodash';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import DestinationFormItem from './DestinationFormItem.component';
import { DestinationFormItemProps } from './DestinationFormItem.interface';

type DestinationFormFields = Pick<
  ModifiedCreateEventSubscription,
  'destinations' | 'readTimeout' | 'resources' | 'timeout'
>;

const DESTINATION_FIELD_NAMES: (keyof DestinationFormFields)[] = [
  'resources',
  'destinations',
  'timeout',
  'readTimeout',
];

function getDestinationFormFields(
  values: Partial<DestinationFormFields>
): Partial<DestinationFormFields> {
  return {
    resources: values.resources,
    destinations: values.destinations,
    timeout: values.timeout,
    readTimeout: values.readTimeout,
  };
}

// Ant Form needs a mounted field to run the bridge validator, but the actual
// control and errors are rendered by the core-UI destination component.
function FieldRegistrar() {
  return <input readOnly aria-hidden="true" tabIndex={-1} type="hidden" />;
}

function DestinationFormItemFormBridge({
  isRequired = true,
  isViewMode = false,
}: Readonly<DestinationFormItemProps>) {
  const { t } = useTranslation();
  const antForm = Form.useFormInstance<ModifiedCreateEventSubscription>();
  const resources = Form.useWatch('resources', antForm);
  const destinations = Form.useWatch('destinations', antForm);
  const timeout = Form.useWatch('timeout', antForm);
  const readTimeout = Form.useWatch('readTimeout', antForm);
  const methods = useForm<DestinationFormFields>({
    defaultValues: getDestinationFormFields(
      antForm.getFieldsValue(DESTINATION_FIELD_NAMES)
    ),
  });
  const { getValues, reset, trigger, watch } = methods;

  useEffect(() => {
    const nextValues = getDestinationFormFields({
      resources,
      destinations,
      timeout,
      readTimeout,
    });

    if (!isEqual(getDestinationFormFields(getValues()), nextValues)) {
      reset(nextValues);
    }
  }, [destinations, getValues, readTimeout, reset, resources, timeout]);

  useEffect(() => {
    const subscription = watch(() => {
      const nextValues = getDestinationFormFields(getValues());
      const currentValues = getDestinationFormFields(
        antForm.getFieldsValue(DESTINATION_FIELD_NAMES)
      );

      if (!isEqual(currentValues, nextValues)) {
        antForm.setFieldsValue(nextValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [antForm, getValues, watch]);

  return (
    <>
      <Form.Item
        hidden
        name="destinations"
        rules={[
          {
            validator: async (_, value) => {
              const coreFormIsValid = await trigger();
              if ((!isRequired || !isEmpty(value)) && coreFormIsValid) {
                return;
              }

              throw new Error(
                t('message.minimum-count-error', {
                  field: t('label.destination'),
                  count: 1,
                })
              );
            },
          },
        ]}>
        <FieldRegistrar />
      </Form.Item>
      <FormProvider {...methods}>
        <DestinationFormItem isRequired={isRequired} isViewMode={isViewMode} />
      </FormProvider>
    </>
  );
}

export default DestinationFormItemFormBridge;
