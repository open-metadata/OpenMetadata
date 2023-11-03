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
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Button, Popover, Space } from 'antd';
import { startCase } from 'lodash';
import React, { FC, useState } from 'react';
import { CALLOUT_CONTENT } from '../../../../constants/BlockEditor.constants';

const PopoverContent = ({
  onSelect,
}: {
  onSelect: (calloutType: string) => void;
}) => {
  return (
    <Space direction="vertical">
      {Object.entries(CALLOUT_CONTENT).map((calloutContent) => {
        return (
          <span
            className="callout-type-btn"
            key={calloutContent[0]}
            onClick={() => onSelect(calloutContent[0])}>
            <span className="m-r-xs">{calloutContent[1]}</span>
            {startCase(calloutContent[0])}
          </span>
        );
      })}
    </Space>
  );
};

const CalloutComponent: FC<NodeViewProps> = ({
  node,
  extension,
  updateAttributes,
}) => {
  const { calloutType } = node.attrs;
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);

  return (
    <NodeViewWrapper as="div" className="om-react-node">
      <div
        className={`om-callout-node om-callout-node-${calloutType}`}
        data-type={extension.name}>
        <Popover
          align={{ targetOffset: [0, 16] }}
          content={
            <PopoverContent
              onSelect={(value) => {
                updateAttributes({ calloutType: value });
                setIsPopupVisible(false);
              }}
            />
          }
          destroyTooltipOnHide={{ keepParent: false }}
          open={isPopupVisible}
          overlayClassName="om-callout-node-popover"
          placement="bottom"
          showArrow={false}
          trigger="click"
          onOpenChange={setIsPopupVisible}>
          <Button className="callout-type-btn" type="text">
            {CALLOUT_CONTENT[calloutType as keyof typeof CALLOUT_CONTENT]}
          </Button>
        </Popover>
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
};

export default CalloutComponent;
