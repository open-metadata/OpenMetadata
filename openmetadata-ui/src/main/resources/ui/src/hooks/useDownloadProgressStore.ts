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
import { create } from 'zustand';

interface DownloadProgressStore {
  progress: number;
  updateProgress: (percentage: number) => void;
  reset: () => void;
}

export const useDownloadProgressStore = create<DownloadProgressStore>()(
  (set) => ({
    progress: 0,
    updateProgress: (percentage: number) => {
      set({ progress: percentage });
    },
    reset: () => {
      set({ progress: 0 });
    },
  })
);
