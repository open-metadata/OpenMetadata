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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button } from 'antd';
import IconTimesCircle from '../../assets/svg/ic-times-circle.svg?react';

interface LineageNodeRemoveButtonProps {
  onRemove: () => void;
}

const LineageNodeRemoveButton = ({
  onRemove,
}: LineageNodeRemoveButtonProps) => {
  return (
    <Button
      className="lineage-node-remove-btn bg-body-hover"
      data-testid="lineage-node-remove-btn"
      icon={
        <Icon
          alt="times-circle"
          className="align-middle"
          component={IconTimesCircle}
          style={{ fontSize: '16px' }}
        />
      }
      type="link"
      onClick={onRemove}
    />
  );
};

export default LineageNodeRemoveButton;
