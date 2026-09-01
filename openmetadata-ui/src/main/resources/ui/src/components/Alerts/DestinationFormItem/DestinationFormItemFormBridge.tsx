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

import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import DestinationFormItem from './DestinationFormItem.component';
import { DestinationFormItemProps } from './DestinationFormItem.interface';

export type DestinationFormFields = Pick<
  ModifiedCreateEventSubscription,
  'destinations' | 'readTimeout' | 'resources' | 'timeout'
>;

export type DestinationFormValidator = () => Promise<void>;

interface DestinationFormItemFormBridgeProps extends DestinationFormItemProps {
  onChange: (values: Partial<DestinationFormFields>) => void;
  renderValidationField?: (validate: DestinationFormValidator) => ReactNode;
  values: Partial<DestinationFormFields>;
}

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

// Legacy form adapters need a mounted field to run the shared validator, while
// the visible control and its field-level errors stay in the core-UI form.
export function DestinationFormFieldRegistrar() {
  return <input readOnly aria-hidden="true" tabIndex={-1} type="hidden" />;
}

function DestinationFormItemFormBridge({
  isRequired = true,
  isViewMode = false,
  onChange,
  renderValidationField,
  values,
}: Readonly<DestinationFormItemFormBridgeProps>) {
  const { t } = useTranslation();
  const methods = useForm<DestinationFormFields>({
    defaultValues: getDestinationFormFields(values),
  });
  const { getValues, reset, setError, trigger, watch } = methods;
  const { destinations, readTimeout, resources, timeout } = values;
  const normalizedValues = useMemo(
    () =>
      getDestinationFormFields({
        destinations,
        readTimeout,
        resources,
        timeout,
      }),
    [destinations, readTimeout, resources, timeout]
  );
  // RHF mutates nested field-array objects, so synchronization snapshots must
  // not retain references to its live form state.
  const latestValues = useRef(cloneDeep(normalizedValues));
  const latestOnChange = useRef(onChange);

  // Legacy form boundaries create adapter callbacks inline. Keeping the latest
  // callback in a ref preserves one RHF subscription across parent renders.
  latestOnChange.current = onChange;

  useEffect(() => {
    // Ant Form does not expose programmatically managed timeout fields through
    // useWatch. Preserve the live RHF values when those legacy props are absent
    // so destination edits are not mistaken for external form resets.
    const synchronizedValues = {
      ...normalizedValues,
      readTimeout:
        normalizedValues.readTimeout ?? latestValues.current.readTimeout,
      timeout: normalizedValues.timeout ?? latestValues.current.timeout,
    };

    if (isEqual(latestValues.current, synchronizedValues)) {
      return;
    }

    latestValues.current = cloneDeep(synchronizedValues);

    if (!isEqual(getDestinationFormFields(getValues()), synchronizedValues)) {
      reset(synchronizedValues);
    }
  }, [getValues, normalizedValues, reset]);

  useEffect(() => {
    const subscription = watch(() => {
      const nextValues = getDestinationFormFields(getValues());

      if (!isEqual(latestValues.current, nextValues)) {
        // Advance the synchronized snapshot before notifying the legacy form
        // so its prop echo is not mistaken for an external reset.
        latestValues.current = cloneDeep(nextValues);
        latestOnChange.current(nextValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [getValues, watch]);

  const validate = useCallback(async () => {
    const coreFormIsValid = await trigger();
    const isDestinationMissing =
      isRequired && isEmpty(getValues('destinations'));
    const minimumDestinationError = t('message.minimum-count-error', {
      field: t('label.destination'),
      count: 1,
    });

    if (!isDestinationMissing && coreFormIsValid) {
      return;
    }

    if (isDestinationMissing) {
      // Controlled bridge resets can clear child errors before the parent
      // validates, so the submit boundary owns the final visible error.
      setError('destinations', {
        message: minimumDestinationError,
        type: 'manual',
      });
    }

    throw new Error(minimumDestinationError);
  }, [getValues, isRequired, setError, t, trigger]);

  return (
    <>
      {renderValidationField?.(validate)}
      <FormProvider {...methods}>
        <DestinationFormItem isRequired={isRequired} isViewMode={isViewMode} />
      </FormProvider>
    </>
  );
}

export default DestinationFormItemFormBridge;
