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
import { deleteEntity } from '../../../../rest/miscAPI';
import { BULK_ACTION_CONCURRENCY } from '../../../../utils/AsyncUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useDelete } from './useDelete';

jest.mock('../../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../DeleteModal/DeleteModal', () => ({
  DeleteModal: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete}>confirm-delete</button>
  ),
}));

type Entity = { id: string; name: string };

const makeEntities = (count: number): Entity[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `id-${index}`,
    name: `entity-${index}`,
  }));

const Harness = ({
  entities,
  onDeleteComplete,
}: {
  entities: Entity[];
  onDeleteComplete: () => void;
}) => {
  const { deleteModal } = useDelete({
    entityType: 'domains',
    entityLabel: 'Domain',
    selectedEntities: entities,
    onDeleteComplete,
  });

  return deleteModal;
};

const confirmDelete = async (
  entities: Entity[],
  onDeleteComplete = jest.fn()
) => {
  render(<Harness entities={entities} onDeleteComplete={onDeleteComplete} />);

  await act(async () => {
    fireEvent.click(screen.getByText('confirm-delete'));
  });

  return onDeleteComplete;
};

describe('useDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes every selected entity with a bounded number of requests in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    (deleteEntity as jest.Mock).mockImplementation(() => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);

      return Promise.resolve().then(() => {
        inFlight -= 1;
      });
    });
    const entities = makeEntities(BULK_ACTION_CONCURRENCY + 3);

    const onDeleteComplete = await confirmDelete(entities);

    expect(deleteEntity).toHaveBeenCalledTimes(entities.length);
    expect(maxInFlight).toBe(BULK_ACTION_CONCURRENCY);
    expect(showSuccessToast).toHaveBeenCalled();
    expect(onDeleteComplete).toHaveBeenCalled();
  });

  it('keeps deleting after one failure and reports it instead of completing', async () => {
    (deleteEntity as jest.Mock).mockImplementation((_type, id: string) =>
      id === 'id-1' ? Promise.reject(new Error('403')) : Promise.resolve()
    );
    const entities = makeEntities(3);

    const onDeleteComplete = await confirmDelete(entities);

    expect(deleteEntity).toHaveBeenCalledTimes(3);
    expect(showErrorToast).toHaveBeenCalledWith(
      'server.failed-to-delete-entities'
    );
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(onDeleteComplete).not.toHaveBeenCalled();
  });
});
