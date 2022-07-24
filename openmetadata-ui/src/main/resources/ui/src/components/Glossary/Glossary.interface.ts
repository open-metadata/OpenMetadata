import { Glossary } from '../../generated/entity/data/glossary';
import { Paging } from '../../generated/type/paging';

export interface GlossaryProps {
  data: Array<Glossary>;
  paging: Paging;
  currentPage: number;
  onPageChange: (type: string | number, activePage?: number) => void;
}
