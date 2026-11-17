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
import { render, screen } from '@testing-library/react';
import { TargetEntityType } from '../../generated/governance/intakeForm';
import IntakeFormDesignerModal from './IntakeFormDesignerModal';

jest.mock('./IntakeFormDesignerBody', () => ({
  __esModule: true,
  default: () => <div data-testid="intake-form-designer-body" />,
}));

describe('IntakeFormDesignerModal', () => {
  it('marks intake forms as deprecated in the header', () => {
    render(
      <IntakeFormDesignerModal
        open
        entityType={TargetEntityType.Domain}
        initialValue={null}
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(screen.getByText('label.deprecated')).toBeInTheDocument();
  });
});
