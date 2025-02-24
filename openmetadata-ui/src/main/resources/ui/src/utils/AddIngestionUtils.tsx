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
import { Form, Input } from 'antd';
import { t } from 'i18next';
import React from 'react';

export const getIngestionFormItems = (
  retries: number,
  onFocus: (path: string) => void
) => (
  <Form.Item
    colon={false}
    initialValue={retries}
    label={t('label.number-of-retries')}
    name="retries">
    <Input min={0} type="number" onFocus={() => onFocus('root/retries')} />
  </Form.Item>
);
