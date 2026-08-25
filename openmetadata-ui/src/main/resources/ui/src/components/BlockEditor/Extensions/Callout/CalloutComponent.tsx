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
import { Button, Popover } from 'antd';
import { startCase } from 'lodash';
import { FC, useState } from 'react';
import { CALLOUT_CONTENT } from '../../../../constants/BlockEditor.constants';

const PopoverContent = ({
  onSelect,
}: {
  onSelect: (calloutType: string) => void;
}) => {
  return (
    <div className="callout-menu">
      {Object.entries(CALLOUT_CONTENT).map(([key, CalloutIcon]) => {
        return (
          <Button
            data-testid={`callout-${key}`}
            icon={
              <CalloutIcon style={{ verticalAlign: 'middle' }} width={20} />
            }
            key={key}
            type="text"
            onClick={() => onSelect(key)}>
            {startCase(key)}
          </Button>
        );
      })}
    </div>
  );
};

const CalloutComponent: FC<NodeViewProps> = ({
  node,
  extension,
  updateAttributes,
  editor,
}) => {
  const { calloutType } = node.attrs;
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(false);
  const CallOutIcon =
    CALLOUT_CONTENT[calloutType as keyof typeof CALLOUT_CONTENT];

  const handlePopoverVisibleChange = (visible: boolean) => {
    // Only show the popover when the editor is in editable mode
    setIsPopupVisible(visible && editor.isEditable);
  };

  return (
    <NodeViewWrapper as="div" className="om-react-node">
      <div
        className={`om-callout-node om-callout-node-${calloutType}`}
        data-testid="callout-node"
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
          placement="bottomRight"
          showArrow={false}
          trigger="click"
          onOpenChange={handlePopoverVisibleChange}>
          <Button
            className="callout-type-btn"
            data-testid={`callout-${calloutType}-btn`}
            type="text">
            <CallOutIcon width={28} />
          </Button>
        </Popover>
        <NodeViewContent
          className="om-callout-node-content"
          data-testid="callout-content"
        />
      </div>
    </NodeViewWrapper>
  );
};

export default CalloutComponent;
