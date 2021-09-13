from typing import Optional

import nbformat

from great_expectations import DataContext
from great_expectations.render.renderer.renderer import Renderer
from great_expectations.util import lint_code


class BaseNotebookRenderer(Renderer):
    """
    Abstract base class for methods that help with rendering a jupyter notebook.
    """

    def __init__(self, context: Optional[DataContext] = None):
        super().__init__()
        self.context = context
        # Add cells to this notebook, then render by implementing a
        # self.render() and/or self.render_to_disk() method(s):
        self._notebook: Optional[nbformat.NotebookNode] = None

    def add_code_cell(self, code: str, lint: bool = False) -> None:
        """
        Add the given code as a new code cell.
        Args:
            code: Code to render into the notebook cell
            lint: Whether to lint the code before adding it

        Returns:
            Nothing, adds a cell to the class instance notebook
        """
        if lint:
            code: str = lint_code(code).rstrip("\n")

        cell = nbformat.v4.new_code_cell(code)
        self._notebook["cells"].append(cell)

    def add_markdown_cell(self, markdown: str) -> None:
        """
        Add the given markdown as a new markdown cell.
        Args:
            markdown: Code to render into the notebook cell

        Returns:
            Nothing, adds a cell to the class instance notebook
        """
        cell = nbformat.v4.new_markdown_cell(markdown)
        self._notebook["cells"].append(cell)

    @classmethod
    def write_notebook_to_disk(
        cls, notebook: nbformat.NotebookNode, notebook_file_path: str
    ) -> None:
        """
        Write a given Jupyter notebook to disk.
        Args:
            notebook: Jupyter notebook
            notebook_file_path: Location to write notebook
        """
        with open(notebook_file_path, "w") as f:
            nbformat.write(notebook, f)

    def render(self):
        """
        Render a notebook from parameters.
        """
        raise NotImplementedError

    def render_to_disk(
        self,
        notebook_file_path: str,
    ) -> None:
        """
        Render a notebook to disk from arguments
        """
        raise NotImplementedError
