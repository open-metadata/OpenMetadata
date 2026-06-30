export interface MemoryFilterOption {
  id: string;
  label: string;
  displayName?: string;
  name?: string;
  type?: string;
  fullyQualifiedName?: string;
}

export interface SearchOptionSource {
  id?: string;
  name?: string;
  displayName?: string;
  fullyQualifiedName?: string;
  entityType?: string;
  type?: string;
}

export interface MemoryCounts {
  totalVisible: number;
  pinnedVisible: number;
  createdByMeVisible: number;
}