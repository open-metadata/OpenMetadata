import { EventDataNode, Key } from 'rc-tree/lib/interface';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface GlossaryTermsProps {
  allowAccess: boolean;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  glossaryDetails: Glossary;
  glossaryTermsDetails: Array<GlossaryTerm>;
  activeGlossaryTerm: GlossaryTerm | undefined;
  activeTab: number;
  showGlossaryDetails: boolean;
  selectedKeys: string;
  expandedKeys: string[];
  queryParams: string;
  tagList: string[];
  isTagLoading: boolean;
  fetchTags: () => void;
  activeTabHandler: (value: number) => void;
  updateGlossaryDescription: (value: Glossary) => void;
  updateReviewer: (value: Glossary) => void;
  handleSelectedKey: (value: string) => void;
  handleGlossaryTermUpdate: (data: GlossaryTerm) => void;
  handleExpand: (
    expandedKeys: Key[],
    info?: {
      node: EventDataNode;
      expanded: boolean;
      nativeEvent: MouseEvent;
    }
  ) => void;
  handleActiveGlossaryTerm: (
    term: GlossaryTerm | undefined,
    id: string
  ) => void;
}
