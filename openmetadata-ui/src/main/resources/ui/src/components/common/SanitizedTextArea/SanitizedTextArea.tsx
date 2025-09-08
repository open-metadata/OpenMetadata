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
import TextArea, { TextAreaProps } from 'antd/lib/input/TextArea';
import { ChangeEvent, FC, memo, useCallback } from 'react';
import { getSanitizeContent } from '../../../utils/sanitize.utils';

const SanitizedTextArea: FC<TextAreaProps> = ({
  value,
  onChange,
  ...props
}) => {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const sanitizedValue = getSanitizeContent(e.target.value);
      if (onChange) {
        onChange({ ...e, target: { ...e.target, value: sanitizedValue } });
      }
    },
    [onChange]
  );

  return <TextArea rows={4} value={value} onChange={handleChange} {...props} />;
};

export default memo(SanitizedTextArea);
