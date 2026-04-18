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
