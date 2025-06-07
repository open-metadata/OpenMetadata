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
import { FieldErrorProps } from '@rjsf/utils';
import { isEmpty } from 'lodash';
import { FC } from 'react';

export const FieldErrorTemplate: FC<FieldErrorProps> = (props) => {
  const errorList = [...new Set(props.errors ?? [])];

  if (isEmpty(errorList)) {
    return null;
  }

  return (
    <div>
      <ul>
        {errorList.map((error) => (
          <li
            className="ant-form-item-explain-error"
            key={`${props.schema.$id}-${props.idSchema.$id}`}>
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
};
