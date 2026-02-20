import random

import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootModelFactory
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type.basic import FullyQualifiedEntityName


class ColumnNameFactory(RootModelFactory):
    root = factory.fuzzy.FuzzyText(prefix="column_", length=4)

    class Meta:
        model = ColumnName


class ColumnFullyQualifiedNameFactory(RootModelFactory):
    root = factory.LazyAttribute(
        lambda obj: FullyQualifiedEntityName(
            root=f"{obj.service}.{obj.database}.{obj.schema}.{obj.table}.{obj.name}"
        )
    )

    class Meta:
        model = FullyQualifiedEntityName

    class Params:
        service = factory.fuzzy.FuzzyText(prefix="service_", length=3)
        database = factory.fuzzy.FuzzyText(prefix="db_", length=3)
        schema = factory.fuzzy.FuzzyText(prefix="schema_", length=3)
        table = factory.fuzzy.FuzzyText(prefix="table_", length=3)
        name = factory.fuzzy.FuzzyText(prefix="column_", length=3)


class ColumnFactory(factory.Factory):
    name = factory.LazyAttribute(lambda obj: ColumnName(root=obj.column_name))
    dataType = factory.fuzzy.FuzzyChoice(DataType)
    arrayDataType = factory.LazyAttribute(
        lambda a: random.choice([d for d in DataType])
        if a.dataType is DataType.ARRAY
        else None
    )
    fullyQualifiedName = factory.LazyAttribute(
        lambda obj: FullyQualifiedEntityName(
            root=f"{obj.service}.{obj.database}.{obj.schema}.{obj.table}.{obj.column_name}"
        )
    )
    tags = factory.LazyFunction(list)
    constraint = None

    class Meta:
        model = Column

    class Params:
        service = factory.fuzzy.FuzzyText(prefix="service_", length=3)
        database = factory.fuzzy.FuzzyText(prefix="db_", length=3)
        schema = factory.fuzzy.FuzzyText(prefix="schema_", length=3)
        table = factory.fuzzy.FuzzyText(prefix="table_", length=3)
        column_name = factory.fuzzy.FuzzyText(prefix="column_", length=3)
