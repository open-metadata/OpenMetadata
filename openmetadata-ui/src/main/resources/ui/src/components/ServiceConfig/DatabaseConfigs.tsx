/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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

import { ConfigFormFields, LoadingState } from 'Models';
import React, { FunctionComponent } from 'react';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { getDatabaseConfig } from '../../utils/DatabaseServiceUtils';
import FormBuilder from '../common/FormBuilder/FormBuilder';

interface Props {
  data: DatabaseService;
  status: LoadingState;
  onChange?: (
    e: React.ChangeEvent<{ value: ConfigFormFields['value'] }>,
    field: ConfigFormFields
  ) => void;
}

const DatabaseConfigs: FunctionComponent<Props> = ({ data, status }: Props) => {
  const { config } = data.connection;
  const getDatabaseFields = () => {
    const { schema, uiSchema } = getDatabaseConfig(config);

    return (
      <FormBuilder
        formData={config as Record<string, any>}
        schema={schema}
        status={status}
        uiSchema={uiSchema}
      />
    );
  };

  return <>{getDatabaseFields()}</>;
};

export default DatabaseConfigs;
