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

import { Spin } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { LearningResource } from '../../../rest/learningResourceAPI';
import './video-player.style.less';

interface VideoPlayerProps {
  resource: LearningResource;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ resource }) => {
  const [isLoading, setIsLoading] = useState(true);

  const embedUrl = useMemo(() => {
    const url = resource.source.url;

    let parsedUrl: URL | undefined;
    try {
      parsedUrl = new URL(url);
    } catch {
      // If URL parsing fails, fall back to the original URL.
      return url;
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    const isYouTubeHost =
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtu.be';

    if (isYouTubeHost) {
      // Handle different YouTube URL formats
      if (hostname === 'youtu.be') {
        // Short URL: https://youtu.be/<videoId>?...
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        const videoId = pathParts[0] || '';
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
        }
      } else if (parsedUrl.pathname.startsWith('/watch')) {
        // Watch URL: https://www.youtube.com/watch?v=<videoId>&...
        const videoId = parsedUrl.searchParams.get('v') || '';
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
        }
      } else if (parsedUrl.pathname.startsWith('/embed/')) {
        // Already an embed URL; preserve as-is.
        return url;
      }
    }

    const isVimeoHost =
      hostname === 'vimeo.com' ||
      hostname === 'www.vimeo.com' ||
      hostname === 'player.vimeo.com';

    if (isVimeoHost) {
      // Vimeo URL: https://vimeo.com/<videoId> or https://player.vimeo.com/video/<videoId>
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      // For both vimeo.com/<id> and player.vimeo.com/video/<id>, the last path segment is typically the video ID.
      const videoId = pathParts[pathParts.length - 1] || '';

      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }

    return url;
  }, [resource.source.url]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div className="video-player-wrapper">
      <div className="video-player-container">
        {isLoading && (
          <div className="video-player-loading">
            <Spin size="large" />
          </div>
        )}
        <iframe
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          className="video-player-iframe"
          frameBorder="0"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          src={embedUrl}
          title={resource.displayName || resource.name}
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
};
