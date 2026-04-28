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

import { Collapse, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { McpToolCall } from '../../../rest/mcpClientAPI';

const { Panel } = Collapse;
const { Text } = Typography;

interface ToolCallBlockProps {
  toolCall: McpToolCall;
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ toolCall }) => {
  const { t } = useTranslation();

  return (
    <div className="mcp-tool-call-block" data-testid="tool-call-block">
      <Collapse defaultActiveKey={[toolCall.id]}>
        <Panel
          header={
            <Text data-testid="tool-call-name" type="secondary">
              🔧 {t('label.tool-call')}: {toolCall.name}
            </Text>
          }
          key={toolCall.id}>
          <div>
            <Text strong>{t('label.input')}:</Text>
            <pre data-testid="tool-call-input">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {toolCall.result !== undefined && (
            <div className="m-t-sm">
              <Text strong>{t('label.result')}:</Text>
              <pre data-testid="tool-call-result">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};
