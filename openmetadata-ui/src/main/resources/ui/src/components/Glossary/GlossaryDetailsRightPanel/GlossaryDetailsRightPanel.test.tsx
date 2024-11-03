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
import { render } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import GlossaryDetailsRightPanel from './GlossaryDetailsRightPanel.component';

jest.mock(
  '../../../components/common/UserSelectableList/UserSelectableList.component',
  () => ({
    UserSelectableList: jest
      .fn()
      .mockImplementation(() => <>testUserSelectableList</>),
  })
);
jest.mock(
  '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest
      .fn()
      .mockImplementation(() => <>testUserTeamSelectableList</>),
  })
);

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <>testProfilePicture</>);
});

describe('GlossaryDetailsRightPanel', () => {
  it('should render the GlossaryDetailsRightPanel component', () => {
    const { getByTestId } = render(
      <BrowserRouter>
        <GlossaryDetailsRightPanel onThreadLinkSelect={jest.fn()} />
      </BrowserRouter>
    );

    expect(getByTestId('glossary-right-panel-owner-link')).toHaveTextContent(
      'label.owner-plural'
    );
    expect(getByTestId('glossary-reviewer-heading-name')).toHaveTextContent(
      'label.reviewer-plural'
    );
    expect(getByTestId('glossary-tags-name')).toHaveTextContent(
      'label.tag-plural'
    );
  });
});
