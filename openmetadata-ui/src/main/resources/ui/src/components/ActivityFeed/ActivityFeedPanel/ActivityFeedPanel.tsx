import classNames from 'classnames';
import React, { FC, HTMLAttributes, useState } from 'react';

interface ActivityFeedPanelProp extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
}

const ActivityFeedPanel: FC<ActivityFeedPanelProp> = () => {
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);

  return (
    <div>
      {showSidePanel ? (
        <button className="tw-z-10 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40" />
      ) : null}
      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-w-2/5 tw-bg-white tw-fixed tw-h-full tw-shadow-md tw-transform tw-ease-in-out tw-duration-300',
          {
            'tw-translate-x-0': showSidePanel,
            'tw-translate-x-full': !showSidePanel,
          }
        )}>
        <header className="tw-font-semibold tw-px-4 tw-shadow-sm">
          {showSidePanel ? (
            <div className="tw-flex tw-justify-between tw-py-3">
              <p>ActivityFeedPanel</p>
              <svg
                className="tw-w-5 tw-h-5 tw-ml-1 tw-cursor-pointer"
                data-testid="closeDrawer"
                fill="none"
                stroke="#6B7280"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                onClick={() => setShowSidePanel(!showSidePanel)}>
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          ) : null}
          <hr className="tw--mx-4" />
        </header>
        <div className="tw-h-full tw-overflow-y-auto tw-p-4">
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Error,
            architecto aspernatur ex eligendi nulla molestiae laudantium
            repudiandae, totam est minus voluptatibus repellendus, natus
            similique? Quam, modi laborum voluptate illo iusto commodi! Odit
            sint inventore, id corrupti voluptatum blanditiis enim quos natus
            accusantium dolorem perferendis aliquid quam, possimus magnam velit
            nulla, magni delectus exercitationem. Deleniti temporibus,
            laudantium id perspiciatis iure accusamus tempore odio dolores
            maiores fuga modi eveniet soluta sunt quam animi rerum inventore!
            Quo ab sequi at quasi sapiente maxime, illo deserunt error quis.
            Nihil odit excepturi dolor quo fuga accusamus quidem, debitis ipsam.
            Voluptate voluptates dolores blanditiis ipsum hic itaque placeat
            ullam suscipit porro aut. Ducimus ex voluptates sed quae dolore
            velit molestias, omnis corrupti rerum, iste iure, non doloribus! Et
            dolores mollitia iure culpa eius excepturi, laudantium quos ad vero
            eveniet sint illum praesentium qui nostrum ut! Quae non
            reprehenderit magni odio voluptatem id rerum excepturi repellat, ad
            recusandae officiis dolorum. Omnis officiis in consequatur
            reiciendis neque modi fuga provident ipsam sed culpa. Dolore,
            provident libero! Odio nihil quisquam sit ut! Iure quasi, eligendi
            voluptas praesentium totam dicta odit neque aliquam aperiam et
            veniam cum voluptate impedit unde nulla, nobis illum modi sunt
            deleniti esse porro. Quasi architecto, quae eveniet id commodi
            laudantium magnam ratione! Laborum vero doloribus inventore ipsum!
            Sapiente nesciunt optio quis! Provident eligendi facere nobis autem
            vitae tenetur quae nesciunt necessitatibus aliquam officia,
            molestiae iusto distinctio! Quas enim facilis modi laboriosam libero
            animi reprehenderit explicabo repellendus consequatur expedita!
            Quia, tempore neque quisquam ea quis numquam natus accusamus
            consectetur harum, impedit beatae voluptas, suscipit saepe omnis
            illo nulla iure soluta non perspiciatis? Aut, minus, officia cum
            praesentium consectetur voluptas possimus perspiciatis ea nisi vitae
            sapiente recusandae, velit quibusdam non suscipit cupiditate?
            Deserunt cumque, quo recusandae inventore in optio laudantium facere
            ipsam eius saepe, fuga esse iste animi maiores minus quam
            consectetur ea! Dolore voluptate consequuntur sed, asperiores amet
            commodi omnis nobis rerum, vero maiores odio saepe consectetur
            laboriosam et voluptas animi dicta molestiae facere velit modi.
            Quisquam non odit sequi consequatur dolores autem velit
            necessitatibus tempore quaerat. Dolores commodi officiis eum omnis,
            ut numquam saepe necessitatibus tempore velit dolor iusto,
            perspiciatis assumenda recusandae quis qui rem ea reiciendis
            consequuntur expedita, enim totam aliquam temporibus exercitationem
            repudiandae! Doloremque consectetur quaerat vel maxime inventore
            laudantium a et odit non cupiditate quo laboriosam, ea eaque dolorem
            dolores, in doloribus corporis labore. Necessitatibus mollitia,
            vitae omnis aut expedita quaerat rem eligendi provident ipsa
            aperiam, labore modi praesentium illo quod saepe esse id, cupiditate
            nihil repellat! Possimus non odio aliquid reprehenderit magnam
            perspiciatis, omnis impedit accusantium quaerat ea quam repellat
            dolorum quisquam sunt facilis cum optio. Excepturi nemo mollitia
            molestiae, magnam dolor earum inventore exercitationem, voluptatum
            eos beatae natus. Ipsam hic adipisci totam rerum mollitia saepe
            asperiores rem corrupti quae velit aperiam ipsum, quia qui
            blanditiis autem facilis explicabo aliquam ad inventore sunt, et ea
            quaerat! Commodi recusandae rem molestiae consequatur perferendis
            magnam eligendi explicabo aliquid, reiciendis debitis dolorum unde
            quo exercitationem eos accusamus laboriosam aut molestias qui illo
            aperiam ducimus?
          </p>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedPanel;
