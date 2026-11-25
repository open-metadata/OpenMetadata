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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppScreenshots } from './AppScreenshots';

const screenshots = [
  <img alt="First screenshot" key="first" src="first.png" />,
  <img alt="Second screenshot" key="second" src="second.png" />,
];

describe('AppScreenshots', () => {
  it('rotates screenshots and stops when paused', () => {
    render(<AppScreenshots screenshots={screenshots} />);

    expect(screen.getByRole('img', { name: 'First screenshot' })).toBeVisible();
    expect(
      screen.queryByRole('img', { name: 'Second screenshot' })
    ).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(3000));

    expect(
      screen.getByRole('img', { name: 'Second screenshot' })
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.pause' }));
    act(() => jest.advanceTimersByTime(3000));

    expect(
      screen.getByRole('img', { name: 'Second screenshot' })
    ).toBeVisible();
  });

  it('switches to the selected screenshot without changing its identity', () => {
    render(<AppScreenshots screenshots={screenshots} />);
    fireEvent.click(screen.getByRole('button', { name: 'label.page 2' }));

    expect(
      screen.getByRole('img', { name: 'Second screenshot' })
    ).toBeVisible();
  });

  it('keeps autoplay stopped while focus remains after hover ends', () => {
    render(<AppScreenshots screenshots={screenshots} />);
    const gallery = screen.getByRole('region');
    const control = screen.getByRole('button', { name: 'label.page 1' });

    fireEvent.mouseEnter(gallery);
    fireEvent.focus(control);
    fireEvent.mouseLeave(gallery);
    act(() => jest.advanceTimersByTime(3000));

    expect(
      screen.getByRole('img', { name: 'First screenshot' })
    ).toBeInTheDocument();

    fireEvent.blur(control);
    act(() => jest.advanceTimersByTime(3000));

    expect(
      screen.getByRole('img', { name: 'Second screenshot' })
    ).toBeInTheDocument();
  });

  it('keeps a screenshot visible when the screenshot list shrinks', () => {
    const { rerender } = render(<AppScreenshots screenshots={screenshots} />);
    fireEvent.click(screen.getByRole('button', { name: 'label.page 2' }));

    rerender(<AppScreenshots screenshots={screenshots.slice(0, 1)} />);

    expect(
      screen.getByRole('img', { name: 'First screenshot' })
    ).toBeInTheDocument();
  });

  it('does not offer rotation controls for one screenshot', () => {
    render(<AppScreenshots screenshots={screenshots.slice(0, 1)} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
