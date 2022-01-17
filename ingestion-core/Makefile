generate:
	mkdir -p src/metadata/generated
	python3 -m pip install --upgrade pip setuptools
	python3 -m pip install --upgrade -r requirements-dev.txt
	datamodel-codegen --input ../catalog-rest-service/src/main/resources/json --input-file-type jsonschema --output src/metadata/generated

clean:
	rm -rf src/metadata/generated
	rm -rf build
	rm -rf dist

bump-version-dev:
	python -m incremental.update metadata --dev

publish: clean generate
	python setup.py install sdist bdist_wheel
	twine check dist/*
	twine upload -r testpypi dist/*
