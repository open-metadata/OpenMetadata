"""
Uility classes for collections
"""


class CaseInsensitiveString(str):
    """
    A case-insensitive string. Useful for case-insensitive comparisons like SQL.
    """

    def __eq__(self, other):
        return self.casefold() == other.casefold()

    def __hash__(self):
        return hash(self.casefold())


class CaseInsensitiveList(list):
    """A case-insensitive list that treats all its string elements as case-insensitive.
    Non-string elements are treated with default behavior."""

    def __contains__(self, item):
        return (
            any(CaseInsensitiveString(x) == item for x in self)
            if isinstance(item, str)
            else any(x == item for x in self)
        )
