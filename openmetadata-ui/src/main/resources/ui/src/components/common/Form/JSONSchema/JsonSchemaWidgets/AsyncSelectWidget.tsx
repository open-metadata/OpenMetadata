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
import { WidgetProps } from '@rjsf/utils';
import { SearchIndex } from '../../../../../enums/search.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import DataAssetAsyncSelectList from '../../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';

const AsyncSelectWidget = ({ onChange, schema, value }: WidgetProps) => {
  const reference = value as EntityReference | undefined;
  const fqn = reference?.fullyQualifiedName;
  const initialOptions: DataAssetOption[] | undefined =
    reference && fqn
      ? [
          {
            label: getEntityName(reference),
            value: fqn,
            reference,
            displayName: getEntityName(reference),
          },
        ]
      : undefined;

  const handleChange = (option?: DataAssetOption | DataAssetOption[]) => {
    if (Array.isArray(option)) {
      onChange(option.map((item) => item.reference));
    } else {
      onChange(option?.reference);
    }
  };

  return (
    <DataAssetAsyncSelectList
      initialOptions={initialOptions}
      placeholder={schema.placeholder ?? ''}
      searchIndex={schema?.autoCompleteType ?? SearchIndex.TABLE}
      value={fqn}
      onChange={handleChange}
    />
  );
};

export default AsyncSelectWidget;
