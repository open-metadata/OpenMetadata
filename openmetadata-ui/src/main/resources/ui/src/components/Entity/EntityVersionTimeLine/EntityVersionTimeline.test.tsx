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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ChangeDescription } from '../../../generated/entity/type';
import { VersionButton } from './EntityVersionTimeLine';

jest.mock('../../common/PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({ userName }: { userName: string }) => <p>{userName}</p>,
}));

const user = {
  name: 'John Doe displayName',
  displayName: 'John Doe displayName',
};

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockImplementation(() => [false, false, user]),
}));

jest.mock('../../../utils/EntityVersionUtils', () => ({
  __esModule: true,
  getSummary: jest.fn().mockReturnValue('Some change description'),
  isMajorVersion: jest.fn().mockReturnValue(false),
}));

describe('VersionButton', () => {
  const version = {
    updatedBy: 'John Doe',
    version: '1.0',
    changeDescription: {} as ChangeDescription,
    updatedAt: 123,
    glossary: '',
  };

  const onVersionSelect = jest.fn();
  const selected = false;
  const isMajorVersion = false;

  it('renders version number', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionNumber = screen.getByText('v1.0');

    expect(versionNumber).toBeInTheDocument();
  });

  it('renders change description', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const changeDescription = screen.getByText('Some change description');

    expect(changeDescription).toBeInTheDocument();
  });

  it('should render updatedBy with UserPopoverCard', async () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );

    const ownerDisplayName = await screen.findByText('John Doe');

    expect(ownerDisplayName).toBeInTheDocument();
  });

  it('calls onVersionSelect when clicked', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionButton = screen.getByTestId('version-selector-v1.0');
    fireEvent.click(versionButton);

    expect(onVersionSelect).toHaveBeenCalledWith('1.0');
  });
});
