#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Helper module to handle data sampling
for the profiler
"""
from typing import Optional, Union

from sqlalchemy.orm import DeclarativeMeta, Session, aliased
from sqlalchemy.orm.util import AliasedClass

from metadata.orm_profiler.orm.functions.random_num import RandomNumFn


class Sampler:
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(
        self,
        session: Session,
        table: DeclarativeMeta,
        profile_sample: Optional[float] = None,
    ):
        self.profile_sample = profile_sample
        self.session = session
        self.table = table

    def random_sample(self) -> Union[DeclarativeMeta, AliasedClass]:
        """
        Either return a sampled CTE of table, or
        the full table if no sampling is required.
        """

        if not self.profile_sample:
            # Use the full table
            return self.table

        # Add new RandomNumFn column
        rnd = self.session.query(self.table, (RandomNumFn() % 100).label("random")).cte(
            f"{self.table.__tablename__}_rnd"
        )

        # Prepare sampled CTE
        sampled = (
            self.session.query(rnd)
            .where(rnd.c.random <= self.profile_sample)
            .cte(f"{self.table.__tablename__}_sample")
        )

        # Assign as an alias
        return aliased(self.table, sampled)
