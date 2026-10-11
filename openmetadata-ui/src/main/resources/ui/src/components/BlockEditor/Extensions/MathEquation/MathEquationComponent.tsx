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
import {
  Box,
  Button,
  ButtonUtility,
  TextArea,
} from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import classNames from 'classnames';
import 'katex/dist/katex.min.css';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Latex from 'react-latex-next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import './math-equation.less';

export const MathEquationComponent: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  editor,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const equation = node.attrs.math_equation;

  const [isEditing, setIsEditing] = useState(() =>
    Boolean(node.attrs.isEditing)
  );

  const handleSaveEquation = () => {
    updateAttributes({
      math_equation: inputRef.current?.value ?? equation,
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
            <TextArea
              // eslint-disable-next-line jsx-a11y/no-autofocus -- focus required to edit equation inline
              autoFocus
              aria-label={t('label.equation')}
              defaultValue={equation}
              placeholder='Enter your equation here. For example: "x^2 + y^2 = z^2"'
              rows={2}
              size="sm"
              textAreaClassName={({ isFocused }) =>
                classNames(
                  'math-equation-input tw:bg-transparent tw:shadow-none',
                  { 'tw:outline-transparent': !isFocused }
                )
              }
              textAreaRef={inputRef}
            />
            <Box align="center" gap={2}>
              <Button
                aria-label={t('label.cancel')}
                color="secondary"
                iconLeading={XClose}
                size="xs"
                onPress={() => setIsEditing(false)}
              />
              <Button
                aria-label={t('label.save')}
                color="primary"
                iconLeading={Check}
                size="xs"
                onPress={handleSaveEquation}
              />
            </Box>
          </div>
        ) : (
          <Latex>{equation}</Latex>
        )}
        {/* Show edit button only when the editor is editable */}
        {!isEditing && editor.isEditable && (
          <ButtonUtility
            className="edit-button"
            color="tertiary"
            icon={<EditIcon width={16} />}
            size="xs"
            tooltip={t('label.edit-entity', { entity: t('label.equation') })}
            onClick={() => setIsEditing(true)}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};
