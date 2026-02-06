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
import React, { useCallback, useState } from 'react';
import { LearningResource } from '../../../rest/learningResourceAPI';
import './storylane-tour.less';

interface StorylaneTourProps {
  resource: LearningResource;
}

export const StorylaneTour: React.FC<StorylaneTourProps> = ({ resource }) => {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div className="storylane-tour-wrapper">
      <div className="storylane-tour-container">
        {isLoading && (
          <div className="storylane-tour-loading">
            <Spin size="large" />
          </div>
        )}
        <iframe
          className="storylane-tour-iframe"
          frameBorder="0"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
          src={resource.source.url}
          title={resource.displayName || resource.name}
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
};
