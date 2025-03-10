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
import { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import { Popover, Tabs, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconFormatImage } from '../../../../assets/svg/ic-format-image.svg';
import Loader from '../../../common/Loader/Loader';
import imageClassBase from './ImageClassBase';
import { ImagePopoverContentProps } from './ImageComponent.interface';

const PopoverContent: FC<ImagePopoverContentProps> = (props) => {
  const tabs = useMemo(() => {
    return imageClassBase.getImageComponentPopoverTab().map((tab) => {
      const TabComponent = tab.children;

      return {
        ...tab,
        children: <TabComponent {...props} />,
      };
    });
  }, [imageClassBase]);

  return <Tabs defaultActiveKey="embed" items={tabs} />;
};

const ImageComponent: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
}) => {
  const { t } = useTranslation();
  const { src, alt } = node.attrs;
  const isValidSource = !isEmpty(src);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(!isValidSource);

  const handlePopoverVisibleChange = (visible: boolean) => {
    // Only show the popover when the editor is in editable mode
    setIsPopupVisible(visible && editor.isEditable);
  };

  return (
    <NodeViewWrapper as="div" className="om-react-node">
      <div className={classNames({ 'om-image-node-wrapper': isPopupVisible })}>
        <Popover
          align={{ targetOffset: [0, 16] }}
          content={
            <PopoverContent
              deleteNode={deleteNode}
              isUploading={isUploading}
              isValidSource={isValidSource}
              src={src}
              updateAttributes={updateAttributes}
              onPopupVisibleChange={(value) => setIsPopupVisible(value)}
              onUploadingChange={(value) => setIsUploading(value)}
            />
          }
          destroyTooltipOnHide={{ keepParent: false }}
          open={isPopupVisible}
          overlayClassName="om-image-node-popover"
          placement="bottom"
          showArrow={false}
          trigger="click"
          onOpenChange={handlePopoverVisibleChange}>
          {isValidSource ? (
            <div className="om-image-node-uploaded">
              <img
                alt={alt ?? ''}
                data-testid="uploaded-image-node"
                src={src}
              />
            </div>
          ) : (
            <div
              className="image-placeholder"
              contentEditable={false}
              data-testid="image-placeholder">
              {isUploading ? (
                <Loader />
              ) : (
                <>
                  <IconFormatImage
                    style={{ verticalAlign: 'middle' }}
                    width={40}
                  />
                  <Typography>{t('label.add-an-image')}</Typography>
                </>
              )}
            </div>
          )}
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};

ImageComponent.displayName = 'ImageComponent';

export default ImageComponent;
