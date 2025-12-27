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
import './VideoPlayer.less';

interface VideoPlayerProps {
  resource: LearningResource;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ resource }) => {
  const [isLoading, setIsLoading] = useState(true);

  const embedUrl = useMemo(() => {
    const url = resource.source.url;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('watch?v=')) {
        videoId = url.split('watch?v=')[1].split('&')[0];
      } else if (url.includes('embed/')) {
        return url;
      }

      return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
    }

    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1].split('?')[0];

      return `https://player.vimeo.com/video/${videoId}`;
    }

    return url;
  }, [resource.source.url]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
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
        src={embedUrl}
        title={resource.displayName || resource.name}
        onLoad={handleLoad}
      />
    </div>
  );
};
