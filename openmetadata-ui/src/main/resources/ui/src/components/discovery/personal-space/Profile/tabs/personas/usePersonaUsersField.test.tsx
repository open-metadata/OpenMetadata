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

import { FieldTypes } from '@openmetadata/ui-core-components';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { searchQuery } from '../../../../../../rest/searchAPI';
import {
  getPersonaUserRefs,
  PersonaUserOption,
  PERSONA_USERS_FIELD,
  usePersonaUsersField,
} from './usePersonaUsersField';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

interface FieldPropsShape {
  'data-testid': string;
  filterOption: () => boolean;
  multiple: boolean;
  onFocus: () => void;
  onSearchChange: (text: string) => void;
  options: PersonaUserOption[];
}

const USERS = [
  {
    id: 'u1',
    name: 'alice',
    displayName: 'Alice A',
    fullyQualifiedName: 'alice',
  },
  { id: 'u2', name: 'bob' },
];

const mockSearchResponse = (users = USERS) =>
  (searchQuery as jest.Mock).mockResolvedValue({
    hits: { hits: users.map((user) => ({ _source: user })) },
  });

const fieldProps = (result: { current: { props?: unknown } }) =>
  result.current.props as FieldPropsShape;

describe('usePersonaUsersField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchResponse();
  });

  it('describes a multi-select user field with the given test id', () => {
    const { result } = renderHook(() => usePersonaUsersField('my-users'));

    expect(result.current).toEqual(
      expect.objectContaining({
        id: `root/${PERSONA_USERS_FIELD}`,
        name: 'users',
        label: 'label.user-plural',
        required: false,
        type: FieldTypes.USER_TEAM_SELECT,
      })
    );
    expect(fieldProps(result)['data-testid']).toBe('my-users');
    expect(fieldProps(result).multiple).toBe(true);
    expect(fieldProps(result).filterOption()).toBe(true);
    expect(fieldProps(result).options).toEqual([]);
    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('fetches non-bot users on focus and maps hits to user reference options', async () => {
    const { result } = renderHook(() => usePersonaUsersField('my-users'));

    act(() => fieldProps(result).onFocus());

    await waitFor(() => expect(fieldProps(result).options).toHaveLength(2));

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        query: '',
        searchIndex: SearchIndex.USER,
        queryFilter: expect.objectContaining({
          query: expect.anything(),
        }),
      })
    );
    expect(
      JSON.stringify((searchQuery as jest.Mock).mock.calls[0][0].queryFilter)
    ).toContain('"isBot":"false"');

    const [alice, bob] = fieldProps(result).options;

    expect(alice).toEqual(
      expect.objectContaining({
        id: 'u1',
        label: 'Alice A',
        supportingText: 'alice',
        value: {
          id: 'u1',
          type: 'user',
          name: 'alice',
          displayName: 'Alice A',
          fullyQualifiedName: 'alice',
        },
      })
    );
    expect(bob).toEqual(
      expect.objectContaining({
        id: 'u2',
        label: 'bob',
        supportingText: 'user',
        value: {
          id: 'u2',
          type: 'user',
          name: 'bob',
          displayName: undefined,
          fullyQualifiedName: undefined,
        },
      })
    );
  });

  it('clears options when the search fails', async () => {
    const { result } = renderHook(() => usePersonaUsersField('my-users'));

    act(() => fieldProps(result).onFocus());
    await waitFor(() => expect(fieldProps(result).options).toHaveLength(2));

    (searchQuery as jest.Mock).mockRejectedValueOnce(new Error('down'));
    act(() => fieldProps(result).onFocus());

    await waitFor(() => expect(fieldProps(result).options).toEqual([]));
  });

  it('debounces search text before querying', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => usePersonaUsersField('my-users'));

    act(() => {
      fieldProps(result).onSearchChange('al');
      fieldProps(result).onSearchChange('ali');
    });

    expect(searchQuery).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'ali' })
    );

    jest.useRealTimers();
  });
});

describe('getPersonaUserRefs', () => {
  it('returns the user references carried by the options', () => {
    const refs = [
      { id: 'u1', type: 'user', name: 'alice' },
      { id: 'u2', type: 'user', name: 'bob' },
    ];
    const options = refs.map((value) => ({
      id: value.id,
      label: value.name,
      value,
    }));

    expect(getPersonaUserRefs(options)).toEqual(refs);
  });

  it('returns an empty list when nothing is selected', () => {
    expect(getPersonaUserRefs()).toEqual([]);
    expect(getPersonaUserRefs([])).toEqual([]);
  });
});
