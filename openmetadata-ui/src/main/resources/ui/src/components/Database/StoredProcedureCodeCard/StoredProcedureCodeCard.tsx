/*
 *  Copyright 2025 Collate.
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
import { Card } from 'antd';
import { useMemo } from 'react';
import { CSMode } from '../../../enums/codemirror.enum';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../../../generated/entity/data/storedProcedure';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import SchemaEditor from '../SchemaEditor/SchemaEditor';

export const StoredProcedureCodeCard = () => {
  const { data } = useGenericContext<StoredProcedure>();

  const { code } = useMemo(() => {
    return {
      code:
        (data?.storedProcedureCode as StoredProcedureCodeObject)?.code ?? '',
    };
  }, [data]);

  return (
    <Card className="m-b-md" data-testid="code-component">
      <SchemaEditor
        editorClass="custom-code-mirror-theme full-screen-editor-height"
        mode={{ name: CSMode.SQL }}
        options={{
          styleActiveLine: false,
          readOnly: true,
        }}
        value={code}
      />
    </Card>
  );
};
