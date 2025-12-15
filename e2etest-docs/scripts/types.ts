
export interface TestStep {
  name: string;
  line: number;
}

export interface TestCase {
  name: string;
  line: number;
  steps: TestStep[];
  description?: string;
  isSkipped: boolean;
}

export interface TestDescribe {
  name: string;
  tests: TestCase[];
  nestedDescribes: TestDescribe[];
  line: number;
}

export interface TestFile {
  path: string;
  fileName: string;
  describes: TestDescribe[];
  rootTests: TestCase[];
  totalTests: number;
  totalSteps: number;
  totalScenarios: number;
}

export interface Component {
  name: string;
  slug: string;
  files: TestFile[];
  totalTests: number;
  totalSteps: number;
  totalScenarios: number;
}

export interface ParsedStats {
  components: number;
  files: number;
  tests: number;
  steps: number;
  scenarios: number;
}
