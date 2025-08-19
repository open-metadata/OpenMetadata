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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Button, Input, Space } from 'antd';
import { TextAreaRef } from 'antd/lib/input/TextArea';
import classNames from 'classnames';
import 'katex/dist/katex.min.css';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Latex from 'react-latex-next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { Tooltip } from '../../../common/AntdCompat';
import './math-equation.less';
;

export const MathEquationComponent: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  editor,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<TextAreaRef>(null);
  const equation = node.attrs.math_equation;

  const [isEditing, setIsEditing] = useState(Boolean(node.attrs.isEditing));

  const handleSaveEquation = () => {
    updateAttributes({
      math_equation:
        inputRef.current?.resizableTextArea?.textArea.value ?? equation,
      isEditing: false,
    });
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper className="block-math-equation">
      <div
        className={classNames('math-equation-wrapper', {
          isediting: isEditing,
        })}>
        {isEditing ? (
          <div className="math-equation-edit-input-wrapper">
            <Input.TextArea
              autoFocus
              bordered={false}
              className="math-equation-input"
              defaultValue={equation}
              placeholder='Enter your equation here. For example: "x^2 + y^2 = z^2"'
              ref={inputRef}
              rows={2}
            />
            <Space direction="horizontal" size={8}>
              <Button
                icon={<CloseOutlined />}
                size="small"
                type="default"
                onClick={() => setIsEditing(false)}
              />
              <Button
                icon={<CheckOutlined />}
                size="small"
                type="primary"
                onClick={handleSaveEquation}
              />
            </Space>
          </div>
        ) : (
          <Latex>{equation}</Latex>
        )}
        {/* Show edit button only when the editor is editable */}
        {!isEditing && editor.isEditable && (
          <Tooltip
            title={t('label.edit-entity', { entity: t('label.equation') })}>
            <Button
              className="edit-button"
              icon={<EditIcon width={16} />}
              size="small"
              type="text"
              onClick={() => setIsEditing(true)}
            />
          </Tooltip>
        )}
      </div>
    </NodeViewWrapper>
  );
};
