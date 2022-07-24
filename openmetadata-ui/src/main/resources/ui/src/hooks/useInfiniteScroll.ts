/*
 *  Copyright 2021 Collate
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

import { useEffect, useRef, useState } from 'react';

export const useInfiniteScroll = (options: IntersectionObserverInit) => {
  const elementRef = useRef<Element>(null);

  const [isInView, setIsInView] = useState(false);

  const handleObserve = (entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;

    setIsInView(entry.isIntersecting);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserve, options);
    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [elementRef, options]);

  return [elementRef, isInView];
};
