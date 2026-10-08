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

import { useEffect, useRef } from 'react';
import loginClassBase from '../../constants/LoginClassBase';

const LoginCarousel = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const loginVideo = loginClassBase.getLoginVideo();

  // The video is a decorative loop of several MB. Starting it only after the
  // window `load` event keeps it from competing with the app bundle for
  // bandwidth on a cold load; until then the card's background gradient
  // (LoginClassBase.getLoginVideoCardClassName) stands in for it.
  useEffect(() => {
    const video = videoRef.current;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (!video || reduceMotion) {
      return;
    }

    const play = () => {
      video.play().catch(() => undefined);
    };
    if (document.readyState === 'complete') {
      play();

      return;
    }
    window.addEventListener('load', play, { once: true });

    return () => window.removeEventListener('load', play);
  }, [loginVideo]);

  if (!loginVideo) {
    return null;
  }

  return (
    <video
      aria-hidden
      loop
      muted
      playsInline
      className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:object-cover"
      data-testid="login-video"
      preload="none"
      ref={videoRef}
      src={loginVideo}
    />
  );
};

export default LoginCarousel;
