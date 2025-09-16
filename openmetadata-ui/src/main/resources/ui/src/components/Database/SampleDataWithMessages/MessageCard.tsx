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

import { Collapse, Tag, Typography } from 'antd';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SchemaEditor from '../SchemaEditor/SchemaEditor';
import './message-card.less';

const { Panel } = Collapse;

const MessageCard = ({ message }: { message: string }) => {
  const { t } = useTranslation();
  const [header, setHeader] = useState<ReactNode>(
    <Typography.Text ellipsis className="text-primary">
      {message}
    </Typography.Text>
  );
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => setIsExpanded((value) => !value);

  useEffect(() => {
    if (isExpanded) {
      setHeader(
        <Tag data-testid="expanded-header" id="sampleData-value">
          {t('label.value')}
        </Tag>
      );
    } else {
      setHeader(
        <Typography.Text
          ellipsis
          className="text-primary"
          data-testid="collapsed-header">
          {message}
        </Typography.Text>
      );
    }
  }, [isExpanded]);

  return (
    <Collapse className="message-card-collapse" onChange={toggleExpanded}>
      <Panel data-testid="message-card" header={header} key="1">
        <SchemaEditor
          className="m-t-xs"
          editorClass="topic-sample-data"
          options={{
            styleActiveLine: false,
          }}
          value={message.replace(/'/g, '"')}
        />
      </Panel>
    </Collapse>
  );
};

export default MessageCard;
