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
import { ChangeEvent, FC, KeyboardEvent, useRef, useState } from 'react';
import i18n from '../../../utils/i18next/LocalUtil';
import './title-component.less';

interface Props {
  value: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

export const TitleComponent: FC<Props> = ({
  value,
  onChange,
  onKeyDown,
  autoFocus = true,
  readOnly = false,
}) => {
  const [titleValue, setTitleValue] = useState<string>(value);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleOnChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    setTitleValue(value);
    onChange(value);
  };

  return (
    <textarea
      autoFocus={autoFocus}
      className="knowledge-page-title-input"
      data-testid="entity-header-display-name"
      id="title-input"
      placeholder={i18n.t('label.untitled')}
      readOnly={readOnly}
      ref={textAreaRef}
      rows={1}
      spellCheck={false}
      value={titleValue}
      onChange={handleOnChange}
      onKeyDown={onKeyDown}
    />
  );
};
