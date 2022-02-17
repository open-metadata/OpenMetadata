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

import classNames from 'classnames';
import React, { FC, HTMLAttributes, useState } from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import { CSMode } from '../../enums/codemirror.enum';
import { SQLQuery, Table } from '../../generated/entity/data/table';
import { withLoader } from '../../hoc/withLoader';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import SchemaEditor from '../schema-editor/SchemaEditor';

interface TableQueriesProp extends HTMLAttributes<HTMLDivElement> {
  queries: Table['tableQueries'];
}
interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  query: SQLQuery;
}

const QueryCard: FC<QueryCardProp> = ({ className, query }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [, setIsCopied] = useState<boolean>(false);
  const [showCopiedText, setShowCopiedText] = useState<boolean>(false);

  const copiedTextHandler = () => {
    setShowCopiedText(true);
    setTimeout(() => {
      setShowCopiedText(false);
    }, 1000);
  };

  return (
    <div
      className={classNames(
        'tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md tw-mb-3',
        className
      )}>
      <div className="tw-mb-2">
        <div className="tw-flex tw-py-1 tw-justify-between">
          <p className="tw-flex">
            <span className="tw-text-grey-muted tw-mr-1">Duration:</span>
            <span>{query.duration} seconds</span>
          </p>
          <button onClick={() => setExpanded((pre) => !pre)}>
            {expanded ? (
              <i className="fas fa-angle-up tw-mr-4 tw-text-lg" />
            ) : (
              <i className="fas fa-angle-down tw-mr-4 tw-text-lg" />
            )}
          </button>
        </div>
        <hr className="tw-border-main tw-my-2 tw--mx-3" />
      </div>

      <div
        className={classNames('tw-overflow-hidden tw-h-10 tw-relative', {
          'tw-h-full': expanded,
        })}>
        <CopyToClipboard
          text={query.query ?? ''}
          onCopy={(_text, result) => {
            setIsCopied(result);
            if (result) copiedTextHandler();
          }}>
          <Button
            className="tw-h-8 tw-ml-4 tw-absolute tw-right-4 tw--mt-px tw-z-9999"
            data-testid="copy-query"
            size="custom"
            theme="default"
            title="Copy"
            variant="text">
            {showCopiedText ? (
              <span className="tw-mr-1 tw-text-success tw-bg-success-lite tw-px-1 tw-rounded-md">
                Copied!
              </span>
            ) : null}
            <SVGIcons alt="Copy" icon={Icons.COPY} width="14px" />
          </Button>
        </CopyToClipboard>

        <div className="tw-border tw-border-main tw-rounded-md tw-p-px">
          <SchemaEditor
            editorClass={classNames({ 'table-query-editor': !expanded })}
            mode={{ name: CSMode.SQL }}
            options={{
              styleActiveLine: false,
            }}
            value={query.query ?? ''}
          />
        </div>
      </div>
    </div>
  );
};

const TableQueries: FC<TableQueriesProp> = ({ queries, className }) => {
  return (
    <div className={className}>
      <div className="tw-my-6">
        {queries?.map((query, index) => (
          <QueryCard
            key={index}
            query={{
              ...query,
              query:
                index === 0
                  ? // eslint-disable-next-line
                    'with customers as (\n\n    select * from "dev"."jaffle_shop"."stg_customers"\n\n),\n\norders as (\n\n    select * from "dev"."jaffle_shop"."stg_orders"\n\n),\n\npayments as (\n\n    select * from "dev"."jaffle_shop"."stg_payments"\n\n),\n\ncustomer_orders as (\n\n        select\n        customer_id,\n\n        min(order_date) as first_order,\n        max(order_date) as most_recent_order,\n        count(order_id) as number_of_orders\n    from orders\n\n    group by customer_id\n\n),\n\ncustomer_payments as (\n\n    select\n        orders.customer_id,\n        sum(amount) as total_amount\n\n    from payments\n\n    left join orders on\n         payments.order_id = orders.order_id\n\n    group by orders.customer_id\n\n),\n\nfinal as (\n\n    select\n        customers.customer_id,\n        customers.first_name,\n        customers.last_name,\n        customer_orders.first_order,\n        customer_orders.most_recent_order,\n        customer_orders.number_of_orders,\n        customer_payments.total_amount as customer_lifetime_value\n\n    from customers\n\n    left join customer_orders\n        on customers.customer_id = customer_orders.customer_id\n\n    left join customer_payments\n        on  customers.customer_id = customer_payments.customer_id\n\n)\n\nselect * from final'
                  : query.query,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default withLoader<TableQueriesProp>(TableQueries);
