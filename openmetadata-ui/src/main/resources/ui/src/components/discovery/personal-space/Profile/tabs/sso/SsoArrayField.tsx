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

import { FieldProps } from '@rjsf/utils';
import CoreArrayField from '../../../../../common/FormBuilderV1/fields/CoreArrayField';

/**
 * OIDC `scope` is a space-separated string on the server but edited as tags
 * (`'ui:field': 'ArrayField'`); real array fields pass straight through.
 */
const SsoArrayField = (props: FieldProps) => {
  if (props.schema.type !== 'string') {
    return <CoreArrayField {...props} />;
  }

  const scopes =
    typeof props.formData === 'string'
      ? props.formData.split(' ').filter(Boolean)
      : [];

  return (
    <CoreArrayField
      {...props}
      formData={scopes}
      onChange={(values: string[]) => props.onChange(values.join(' '))}
    />
  );
};

export default SsoArrayField;
