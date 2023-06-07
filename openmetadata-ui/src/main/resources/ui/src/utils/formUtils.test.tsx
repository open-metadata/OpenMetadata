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
import { FormValidation } from '@rjsf/utils';
import { customValidate } from './formUtils';

describe('customValidate', () => {
  it('should add error message when connectionArguments have invalid object keys', () => {
    const formData = {
      connectionArguments: {
        validKey: 'value',
        '"invalidKey"': 'value',
      },
      connectionOptions: {
        option1: 'value',
      },
    };
    const errors = {
      addError: jest.fn(),
      connectionOptions: {
        addError: jest.fn(),
      },
      connectionArguments: {
        addError: jest.fn(),
      },
    };

    customValidate?.(formData, errors as unknown as FormValidation);

    expect(errors.connectionArguments.addError).toHaveBeenCalledWith(
      'message.invalid-object-key'
    );
    expect(errors.connectionOptions.addError).not.toHaveBeenCalled();
  });

  it('should add error message when connectionOptions have invalid object keys', () => {
    const formData = {
      connectionArguments: {
        validKey: 'value',
      },
      connectionOptions: {
        option1: 'value',
        'invalid Key': 'value',
      },
    };
    const errors = {
      addError: jest.fn(),
      connectionOptions: {
        addError: jest.fn(),
      },
      connectionArguments: {
        addError: jest.fn(),
      },
    };

    customValidate?.(formData, errors as unknown as FormValidation);

    expect(errors.connectionArguments.addError).not.toHaveBeenCalled();
    expect(errors.connectionOptions.addError).toHaveBeenCalledWith(
      'message.invalid-object-key'
    );
  });

  it('should not add error message when all object keys are valid', () => {
    const formData = {
      connectionArguments: {
        validKey1: 'value',
        validKey2: 'value',
      },
      connectionOptions: {
        option1: 'value',
        option2: 'value',
      },
    };
    const errors = {
      connectionArguments: {
        addError: jest.fn(),
      },
      connectionOptions: {
        addError: jest.fn(),
      },
    };

    customValidate?.(formData, errors as unknown as FormValidation);

    expect(errors.connectionArguments.addError).not.toHaveBeenCalled();
    expect(errors.connectionOptions.addError).not.toHaveBeenCalled();
  });
});
