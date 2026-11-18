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

import { renderHook, waitFor } from '@testing-library/react';
import { AlertType as CapabilitiesAlertType } from '../../../generated/events/api/alertCapabilitiesRequest';
import { AlertType } from '../../../generated/events/eventSubscription';
import { getAlertCapabilities } from '../../../rest/alertsAPI';
import { useAlertResources } from './useAlertResources';

jest.mock('../../../rest/alertsAPI', () => ({
  getAlertCapabilities: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: { getSourceNameSearch: jest.fn().mockReturnValue({}) },
}));

const mockGetAlertCapabilities = getAlertCapabilities as jest.Mock;

// One array, as a form hands the same sources back on every render.
const TABLE = ['table'];
const SAVED_RULES = {
  filters: [{ name: 'filterByFqn' }],
  actions: [{ name: 'GetTableSchemaChanges' }],
};

const answer = ({ sources }: { sources: string[] }) =>
  Promise.resolve({
    alertType: CapabilitiesAlertType.Observability,
    sources: [{ name: 'table', kind: 'entity', selected: true }],
    filters: sources.length
      ? [{ condition: { name: 'filterByFqn' }, sources }]
      : [],
    triggers: [],
  });

const renderResources = (
  alertType?: AlertType,
  sources?: string[],
  chosenSoFar?: typeof SAVED_RULES
) => renderHook(() => useAlertResources(alertType, sources, chosenSoFar));

describe('useAlertResources', () => {
  beforeEach(() => {
    mockGetAlertCapabilities.mockReset();
    mockGetAlertCapabilities.mockImplementation(answer);
  });

  it('asks the server about observability alerts by default', async () => {
    const { result } = renderResources();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAlertCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: CapabilitiesAlertType.Observability,
      })
    );
  });

  it('asks the server about notification alerts for notification alerts', async () => {
    const { result } = renderResources(AlertType.Notification);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAlertCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: CapabilitiesAlertType.Notification,
      })
    );
  });

  it('is loading until the server has answered for the first time', async () => {
    const { result } = renderResources();

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('shows the sections the selected sources support once the server answers', async () => {
    const { result } = renderResources(AlertType.Observability, TABLE);

    await waitFor(() =>
      expect(
        result.current.selection.support.supportedFilters?.map((f) => f.name)
      ).toEqual(['filterByFqn'])
    );

    expect(result.current.shouldShowFiltersSection).toBe(true);
    expect(result.current.shouldShowActionsSection).toBe(false);
  });

  it("keeps a saved alert's rules while the server cannot say what its sources support", async () => {
    mockGetAlertCapabilities.mockRejectedValue(new Error('boom'));
    const { result } = renderResources(
      AlertType.Observability,
      TABLE,
      SAVED_RULES
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.shouldShowFiltersSection).toBe(true);
    expect(result.current.shouldShowActionsSection).toBe(true);
  });

  it('shows both sections until a source is selected', async () => {
    const { result } = renderResources();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.shouldShowFiltersSection).toBe(true);
    expect(result.current.shouldShowActionsSection).toBe(true);
  });
});
