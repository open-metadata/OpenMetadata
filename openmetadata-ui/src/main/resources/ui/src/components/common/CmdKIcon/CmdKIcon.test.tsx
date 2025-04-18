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
import { act, render, screen } from '@testing-library/react';
import { NavigatorHelper } from '../../../utils/NavigatorUtils';
import CmdKIcon from './CmdKIcon.component';

jest.mock('../../../utils/NavigatorUtils', () => ({
  NavigatorHelper: {
    isMacOs: jest.fn(),
  },
}));

describe('CmdKIcon', () => {
  it('should render CmdKIcon', async () => {
    await act(async () => {
      render(<CmdKIcon />);
    });

    expect(screen.getByTestId('cmdicon-container')).toBeInTheDocument();
  });

  it('should render CmdButton when isMacOs is true', () => {
    (NavigatorHelper.isMacOs as jest.Mock).mockReturnValue(true);
    const { getByTestId, queryByTestId } = render(<CmdKIcon />);

    expect(getByTestId('cmd-button')).toBeInTheDocument();
    expect(queryByTestId('ctrl-button')).toBeNull();
  });

  it('should render CtrlButton when isMacOs is false', () => {
    (NavigatorHelper.isMacOs as jest.Mock).mockReturnValue(false);
    const { getByTestId, queryByTestId } = render(<CmdKIcon />);

    expect(getByTestId('ctrl-button')).toBeInTheDocument();
    expect(queryByTestId('cmd-button')).toBeNull();
  });
});
