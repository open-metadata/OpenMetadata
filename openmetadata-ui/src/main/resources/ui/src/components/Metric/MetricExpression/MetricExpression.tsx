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
import { Card } from 'antd';
import React from 'react';
import { CSMode } from '../../../enums/codemirror.enum';
import { Metric } from '../../../generated/entity/data/metric';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';

const MetricExpression = ({
  expression,
}: {
  expression: Metric['expression'];
}) => {
  if (!expression) {
    return null;
  }

  return (
    <Card
      className="m-b-md"
      data-testid="code-component"
      title={`${expression.language}`}>
      <SchemaEditor
        editorClass="custom-code-mirror-theme"
        mode={{ name: CSMode.SQL }}
        options={{
          styleActiveLine: false,
          readOnly: true,
        }}
        value={expression.code}
      />
    </Card>
  );
};

export default MetricExpression;
