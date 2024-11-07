"""
This module provides utilties for building a collaborative constructor library.
"""

from abc import ABC


class Root:
    """Root class for any class that needs to implement a colllaborative constructor but
    might end up at the end of the inheritance chain. Since python's object.__init__ is not
    a collaborative constructor, we need to have a root class that has a collaborative constructor.
    """

    __terminal__ = {object, ABC}

    def __init__(self, *args, **kwargs):
        """Collaborative constructor"""
        super_class = None
        for cls, super_class in zip(
            self.__class__.mro()[:-1], self.__class__.mro()[1:]
        ):
            if cls is Root:
                break
        for cls in self.__terminal__:
            if super_class is cls:
                break
        else:
            super().__init__(*args, **kwargs)
