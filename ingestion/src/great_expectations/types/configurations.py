from great_expectations.marshmallow__shade import Schema, fields


class ClassConfig:
    """Defines information sufficient to identify a class to be (dynamically) loaded for a DataContext."""

    def __init__(self, class_name, module_name=None):
        self._class_name = class_name
        self._module_name = module_name

    @property
    def class_name(self):
        return self._class_name

    @property
    def module_name(self):
        return self._module_name


class ClassConfigSchema(Schema):
    class_name = fields.Str()
    module_name = fields.Str(allow_none=True)


classConfigSchema = ClassConfigSchema()
