import logging
import warnings

logger = logging.getLogger(__name__)


class MetaMetricProvider(type):
    """MetaMetricProvider registers metrics as they are defined."""

    def __new__(cls, clsname, bases, attrs):
        newclass = super().__new__(cls, clsname, bases, attrs)
        newclass._register_metric_functions()
        return newclass


# The following is based on "https://stackoverflow.com/questions/9008444/how-to-warn-about-class-name-deprecation".
class DeprecatedMetaMetricProvider(MetaMetricProvider):
    """
    Goals:
        Instantiation of a deprecated class should raise a warning;
        Subclassing of a deprecated class should raise a warning;
        Support isinstance and issubclass checks.
    """

    # TODO: <Alex>All logging/warning directives should be placed into a common module to be imported as needed.</Alex>
    warnings.simplefilter("default", category=DeprecationWarning)

    # Arguments: True -- suppresses the warnings; False -- outputs the warnings (to stderr).
    logging.captureWarnings(False)

    def __new__(cls, name, bases, classdict, *args, **kwargs):
        alias = classdict.get("_DeprecatedMetaMetricProvider__alias")

        if alias is not None:

            def new(cls, *args, **kwargs):
                alias = getattr(cls, "_DeprecatedMetaMetricProvider__alias")

                if alias is not None:
                    warnings.warn(
                        f"""{cls.__name__} has been renamed to {alias} -- the alias {cls.__name__} will be \
deprecated in the future.
""",
                        DeprecationWarning,
                        stacklevel=2,
                    )

                return alias(*args, **kwargs)

            classdict["__new__"] = new
            classdict["_DeprecatedMetaMetricProvider__alias"] = alias

        fixed_bases = []

        for b in bases:
            alias = getattr(b, "_DeprecatedMetaMetricProvider__alias", None)

            if alias is not None:
                warnings.warn(
                    f"""{b.__name__} has been renamed to {alias.__name__} -- the alias {b.__name__} will be deprecated \
in the future.
""",
                    DeprecationWarning,
                    stacklevel=2,
                )

            # Avoid duplicate base classes.
            b = alias or b
            if b not in fixed_bases:
                fixed_bases.append(b)

        fixed_bases = tuple(fixed_bases)

        return super().__new__(cls, name, fixed_bases, classdict, *args, **kwargs)

    def __instancecheck__(cls, instance):
        return any(
            cls.__subclasscheck__(c) for c in {type(instance), instance.__class__}
        )

    def __subclasscheck__(cls, subclass):
        if subclass is cls:
            return True
        else:
            return issubclass(
                subclass, getattr(cls, "_DeprecatedMetaMetricProvider__alias")
            )
