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
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../interface/FormUtils.interface';
import { getField } from './formUtils';

describe('getField', () => {
  it('Should render FormItem with Alert', async () => {
    const result = getField({
      name: 'mutuallyExclusive',
      label: 'label.mutually-exclusive',
      type: FieldTypes.SWITCH,
      required: false,
      helperText: 'message.mutually-exclusive-alert-entity',
      helperTextType: HelperTextType.ALERT,
      props: {
        'data-testid': 'mutually-exclusive-button',
      },
      id: 'root/mutuallyExclusive',
      formItemLayout: FormItemLayout.HORIZONTAL,
    });

    expect(JSON.stringify(result)).toContain('form-item-alert');
  });

  it('Should not render FormItem with Alert is showHelperText is false', async () => {
    const result = getField({
      name: 'mutuallyExclusive',
      label: 'label.mutually-exclusive',
      type: FieldTypes.SWITCH,
      required: false,
      helperText: 'message.mutually-exclusive-alert-entity',
      helperTextType: HelperTextType.ALERT,
      showHelperText: false,
      props: {
        'data-testid': 'mutually-exclusive-button',
      },
      id: 'root/mutuallyExclusive',
      formItemLayout: FormItemLayout.HORIZONTAL,
    });

    expect(JSON.stringify(result)).not.toContain('form-item-alert');
  });

  it('Should not render FormItem with Alert', async () => {
    const result = getField({
      name: 'mutuallyExclusive',
      label: 'label.mutually-exclusive',
      type: FieldTypes.SWITCH,
      required: false,
      helperText: 'message.mutually-exclusive-alert-entity',
      helperTextType: HelperTextType.Tooltip,
      props: {
        'data-testid': 'mutually-exclusive-button',
      },
      id: 'root/mutuallyExclusive',
      formItemLayout: FormItemLayout.HORIZONTAL,
    });

    expect(JSON.stringify(result)).not.toContain('form-item-alert');
  });
});
