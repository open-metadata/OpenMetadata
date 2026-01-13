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
import { Input, InputProps } from 'antd';
import { useTranslation } from 'react-i18next';
import './color-picker.style.less';

const ColorPicker = (props: InputProps) => {
  const { t } = useTranslation();
  const { id, ...rest } = props;

  return (
    <Input.Group compact>
      <Input
        {...rest}
        className="style-color-picker"
        data-testid={id ? `${id}-color-picker` : 'color-picker'}
        type="color"
      />
      <Input
        {...rest}
        className="style-color-input"
        data-testid={id ? `${id}-color-input` : 'color-input'}
        id={id}
        placeholder={t('message.hex-code-placeholder')}
      />
    </Input.Group>
  );
};

export default ColorPicker;
