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
import { fireEvent, render, screen } from '@testing-library/react';
import { HeaderVersionButton } from './HeaderVersionButton.component';

describe('HeaderVersionButton', () => {
  it('shows the version and opens the history when pressed', () => {
    const onClick = jest.fn();
    render(<HeaderVersionButton version="0.3" onClick={onClick} />);

    fireEvent.click(screen.getByTestId('version-btn'));

    expect(screen.getByTestId('version-btn')).toHaveTextContent('0.3');
    expect(onClick).toHaveBeenCalled();
  });
});
