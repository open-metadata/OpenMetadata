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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Environment } from '../../../../generated/entity/services/serviceAttributes';
import ServiceAttributesCard from './ServiceAttributesCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const onSave = jest.fn().mockResolvedValue(undefined);

describe('ServiceAttributesCard', () => {
  beforeEach(() => {
    onSave.mockClear();
  });

  it('should show the configured attributes', () => {
    render(
      <ServiceAttributesCard
        hasEditPermission
        serviceAttributes={{
          environment: Environment.Development,
          region: 'us-east-1',
          deployment: 'prod-cluster-01',
        }}
        onSave={onSave}
      />
    );

    expect(screen.getByTestId('service-environment-value')).toHaveTextContent(
      'Development'
    );
    expect(screen.getByTestId('service-region-value')).toHaveTextContent(
      'us-east-1'
    );
    expect(screen.getByTestId('service-deployment-value')).toHaveTextContent(
      'prod-cluster-01'
    );
  });

  it('should say so when nothing is set, rather than rendering empty rows', () => {
    render(<ServiceAttributesCard hasEditPermission onSave={onSave} />);

    expect(screen.getByTestId('no-service-attributes')).toBeInTheDocument();
  });

  it('should hide the edit action without permission', () => {
    render(
      <ServiceAttributesCard
        hasEditPermission={false}
        serviceAttributes={{ region: 'us-east-1' }}
        onSave={onSave}
      />
    );

    expect(screen.queryByTestId('edit-service-attributes')).toBeNull();
  });

  it('should save trimmed values and drop blanks', async () => {
    render(
      <ServiceAttributesCard
        hasEditPermission
        serviceAttributes={{ region: '  ' }}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTestId('edit-service-attributes'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-service-attributes'));
    });

    expect(onSave).toHaveBeenCalledWith({
      environment: undefined,
      region: undefined,
      deployment: undefined,
    });
  });

  /** A failed save must not discard what the user typed. */
  it('should stay in edit mode when saving fails', async () => {
    onSave.mockRejectedValueOnce(new Error('boom'));
    render(
      <ServiceAttributesCard
        hasEditPermission
        serviceAttributes={{ region: 'us-east-1' }}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTestId('edit-service-attributes'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-service-attributes'));
    });

    expect(screen.getByTestId('save-service-attributes')).toBeInTheDocument();
  });
});
