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
import { EventEmitter } from 'eventemitter3';
import { DependencyList, useEffect } from 'react';

type EventCallback<T = any> = (data: T) => void;
type UnsubscribeFunction = () => void;

const emitter = new EventEmitter();

export const useSub = <T = any>(
  event: string,
  callback: EventCallback<T>,
  dependencies?: DependencyList
): UnsubscribeFunction => {
  const unsubscribe = () => {
    emitter.off(event, callback);
  };

  useEffect(() => {
    emitter.on(event, callback);

    // If dependencies are provided, remove the callback when the component unmounts
    return () => {
      emitter.off(event, callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies ?? []);

  return unsubscribe;
};

export const usePub = () => {
  return <T = any>(event: string, data: T) => {
    emitter.emit(event, data);
  };
};
