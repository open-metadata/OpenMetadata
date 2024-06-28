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
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Button, Input, Space } from 'antd';
import { TextAreaRef } from 'antd/lib/input/TextArea';
import 'katex/dist/katex.min.css';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import Latex from 'react-latex-next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import './math-equation.less';

export const MathEquationComponent: FC<NodeViewProps> = ({
  node,
  updateAttributes,
}) => {
  const inputRef = React.useRef<TextAreaRef>(null);
  const { t } = useTranslation();
  const equation = node.attrs.math_equation;

  const [isEditing, setIsEditing] = React.useState(false);

  const handleSaveEquation = () => {
    updateAttributes({
      math_equation:
        inputRef.current?.resizableTextArea?.textArea.value ?? equation,
    });
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper className="block-math-equation">
      <div className="math-equation-wrapper">
        {isEditing ? (
          <div className="math-equation-edit-input-wrapper">
            <Input.TextArea
              autoFocus
              bordered={false}
              className="math-equation-input"
              defaultValue={equation}
              ref={inputRef}
              rows={3}
            />
            <Space direction="horizontal" size={8}>
              <Button
                size="small"
                type="default"
                onClick={() => setIsEditing(false)}>
                {t('label.cancel')}
              </Button>
              <Button size="small" type="primary" onClick={handleSaveEquation}>
                {t('label.save')}
              </Button>
            </Space>
          </div>
        ) : (
          <Latex>{equation}</Latex>
        )}
        {!isEditing && (
          <Button
            className="edit-button"
            icon={<EditIcon width={16} />}
            size="small"
            type="text"
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};
