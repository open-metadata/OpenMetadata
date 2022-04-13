/* eslint-disable */
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const path = require('path');
const fs = require('fs');

const destDir = 'src/jsons/connectionSchemas/connections';
const srcDir =
  '../../../../../catalog-rest-service/src/main/resources/json/schema/entity/services/connections';

const globalParserOptions = {
  continueOnError: true,
  dereference: {
    circular: true,
  },
};

async function parseSchema(filePath, destPath) {
  try {
    const parser = new $RefParser(globalParserOptions);
    const schema = await parser.parse(filePath);
    const api = await parser.bundle(schema);
    const dirname = path.dirname(destPath);
    if (!fs.existsSync(dirname)) {
      try {
        fs.mkdirSync(dirname, { recursive: true });
      } catch (err) {
        console.log(err);
      }
    }
    fs.writeFileSync(destPath, JSON.stringify(api, null, 2));
  } catch (err) {
    console.log(err);
  }
}

function traverseDirectory(Directory) {
  fs.readdirSync(Directory).forEach((File) => {
    const Absolute = path.join(Directory, File);
    if (fs.statSync(Absolute).isDirectory()) {
      return traverseDirectory(Absolute);
    } else {
      const name = Absolute.replace(srcDir, destDir);
      return parseSchema(Absolute, name);
    }
  });
}

function main() {
  try {
    fs.rmdirSync(destDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });
  } catch (err) {
    console.log(err);
  }

  traverseDirectory(srcDir);
}

main();
