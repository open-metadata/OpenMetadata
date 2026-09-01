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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import DestinationFormItemFormBridge, {
  DestinationFormFields,
} from './DestinationFormItemFormBridge';

interface ValidationHarnessProps {
  isRequired?: boolean;
  onFinish: jest.Mock;
}

function ValidationHarness({ isRequired, onFinish }: ValidationHarnessProps) {
  const [values, setValues] = useState<Partial<DestinationFormFields>>({});
  const [isBlocked, setIsBlocked] = useState(false);

  return (
    <>
      <DestinationFormItemFormBridge
        isRequired={isRequired}
        renderValidationField={(validate) => (
          <button
            type="button"
            onClick={async () => {
              try {
                await validate();
                onFinish();
              } catch {
                setIsBlocked(true);
              }
            }}>
            Save
          </button>
        )}
        values={values}
        onChange={(nextValues) => setValues(nextValues)}
      />
      {isBlocked && <span>parent-form-blocked</span>}
    </>
  );
}

describe('DestinationFormItem validation', () => {
  it('shows the minimum destination error when required submission is blocked', async () => {
    const onFinish = jest.fn();
    render(<ValidationHarness onFinish={onFinish} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('parent-form-blocked');

    expect(screen.getByText('message.minimum-count-error')).toHaveClass(
      'tw:text-error-primary'
    );
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('allows submission without a destination when optional', async () => {
    const onFinish = jest.fn();
    render(<ValidationHarness isRequired={false} onFinish={onFinish} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));

    expect(
      screen.queryByText('message.minimum-count-error')
    ).not.toBeInTheDocument();
  });
});
