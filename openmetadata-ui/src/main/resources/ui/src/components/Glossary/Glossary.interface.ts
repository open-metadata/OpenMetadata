import { Glossary } from '../../generated/entity/data/glossary';
import { Paging } from '../../generated/type/paging';

export interface GlossaryProps {
  data: Array<Glossary>;
  paging: Paging;
  onPageChange: (type: string | number) => void;
}
