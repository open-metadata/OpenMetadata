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
import { CaretRightOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Handle, Position } from 'reactflow';

const StartNode = () => {
  const { t } = useTranslation();

  return (
    <div className="start-node">
      <CaretRightOutlined />
      <Typography.Text className="text-white">
        {t('label.start')}
      </Typography.Text>
      <Handle isConnectable={false} position={Position.Bottom} type="source" />
    </div>
  );
};

export default StartNode;
