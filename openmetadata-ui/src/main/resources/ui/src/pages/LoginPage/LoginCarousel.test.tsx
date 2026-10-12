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

import { fireEvent, render, screen } from '@testing-library/react';
import loginClassBase from '../../constants/LoginClassBase';
import LoginCarousel from './LoginCarousel';

describe('Test LoginCarousel component', () => {
  let playSpy: jest.SpyInstance;
  let videoSpy: jest.SpyInstance;

  beforeEach(() => {
    playSpy = jest
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    videoSpy = jest
      .spyOn(loginClassBase, 'getLoginVideo')
      .mockReturnValue('test-video.mp4');
  });

  afterEach(() => {
    playSpy.mockRestore();
    videoSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('does not autoplay or preload the video from markup', () => {
    render(<LoginCarousel />);

    const video = screen.getByTestId('login-video');

    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.getAttribute('preload')).toBe('none');
  });

  it('starts playback right away when the page has already loaded', () => {
    render(<LoginCarousel />);

    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('waits for the window load event before starting playback', () => {
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');

    render(<LoginCarousel />);

    expect(playSpy).not.toHaveBeenCalled();

    fireEvent.load(window);

    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('does not play when the user prefers reduced motion', () => {
    jest.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);

    render(<LoginCarousel />);

    expect(playSpy).not.toHaveBeenCalled();
  });

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
});
