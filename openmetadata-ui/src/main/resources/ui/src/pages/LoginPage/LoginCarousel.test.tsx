/*
 *  Copyright 2022 Collate.
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
import loginClassBase from '../../constants/LoginClassBase';
import LoginCarousel from './LoginCarousel';

describe('Test LoginCarousel component', () => {
  it('renders the login video when a video is configured', () => {
    const videoSpy = jest
      .spyOn(loginClassBase, 'getLoginVideo')
      .mockReturnValue('test-video.mp4');

    render(<LoginCarousel />);

    const videos = screen.queryAllByTestId('login-video');

    expect(videos).toHaveLength(1);
    expect(videos[0].getAttribute('src')).toBe('test-video.mp4');

    videoSpy.mockRestore();
  });

  it('renders nothing when no video is configured', () => {
    const videoSpy = jest
      .spyOn(loginClassBase, 'getLoginVideo')
      .mockReturnValue(undefined);

    const { container } = render(<LoginCarousel />);

    expect(screen.queryAllByTestId('login-video')).toHaveLength(0);
    expect(container.childElementCount).toBe(0);

    videoSpy.mockRestore();
  });

  describe('dark theme', () => {
    afterEach(() => {
      document.documentElement.classList.remove('dark-mode');
      jest.restoreAllMocks();
    });

    it('plays the dark cut when the page is dark and one is configured', () => {
      document.documentElement.classList.add('dark-mode');
      jest.spyOn(loginClassBase, 'getLoginVideo').mockReturnValue('light.mp4');
      jest
        .spyOn(loginClassBase, 'getLoginDarkVideo')
        .mockReturnValue('dark.mp4');

      render(<LoginCarousel />);

      expect(screen.getByTestId('login-video')).toHaveAttribute(
        'src',
        'dark.mp4'
      );
    });

    it('falls back to the light video when no dark cut exists', () => {
      document.documentElement.classList.add('dark-mode');
      jest.spyOn(loginClassBase, 'getLoginVideo').mockReturnValue('light.mp4');
      jest
        .spyOn(loginClassBase, 'getLoginDarkVideo')
        .mockReturnValue(undefined);

      render(<LoginCarousel />);

      expect(screen.getByTestId('login-video')).toHaveAttribute(
        'src',
        'light.mp4'
      );
    });

    it('keeps the light video in light mode even when a dark cut exists', () => {
      jest.spyOn(loginClassBase, 'getLoginVideo').mockReturnValue('light.mp4');
      jest
        .spyOn(loginClassBase, 'getLoginDarkVideo')
        .mockReturnValue('dark.mp4');

      render(<LoginCarousel />);

      expect(screen.getByTestId('login-video')).toHaveAttribute(
        'src',
        'light.mp4'
      );
    });
  });
});
