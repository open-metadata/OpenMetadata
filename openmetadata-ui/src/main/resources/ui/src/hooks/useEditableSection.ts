/*
 *  Copyright 2025 Collate.
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
import { isEqual } from 'lodash';
import { useEffect, useState } from 'react';

interface UseEditableSectionReturn<T> {
  isEditing: boolean;
  isLoading: boolean;
  popoverOpen: boolean;
  displayData: T;
  setDisplayData: React.Dispatch<React.SetStateAction<T>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
  startEditing: () => void;
  cancelEditing: () => void;
  completeEditing: () => void;
}

export const useEditableSection = <T>(
  initialData: T
): UseEditableSectionReturn<T> => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [displayData, setDisplayData] = useState<T>(initialData);

  useEffect(() => {
    setDisplayData((prev) => {
      if (!isEqual(prev, initialData)) {
        return initialData;
      }

      return prev;
    });
  }, [initialData]);

  const startEditing = () => {
    setIsEditing(true);
    setPopoverOpen(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setPopoverOpen(false);
  };

  const completeEditing = () => {
    setTimeout(() => {
      setIsEditing(false);
      setIsLoading(false);
      setPopoverOpen(false);
    }, 500);
  };

  return {
    isEditing,
    isLoading,
    popoverOpen,
    displayData,
    setDisplayData,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    cancelEditing,
    completeEditing,
  };
};
