/* eslint-disable */
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

const cwd = process.cwd();

const schemaDir =
  '../../../../../catalog-rest-service/src/main/resources/json/schema';

const rootDir = 'connTemp';
const srcDir = 'schema/entity/services/connections';
const destDir = 'src/jsons/connectionSchemas/connections';

const playDir = `${rootDir}/${srcDir}`;

const globalParserOptions = {
  continueOnError: true,
  dereference: {
    circular: true,
  },
};

async function parseSchema(filePath, destPath) {
  try {
    const fileDir = `${cwd}/${path.dirname(filePath)}`;
    const fileName = path.basename(filePath);
    process.chdir(fileDir);
    const parser = new $RefParser(globalParserOptions);
    const schema = await parser.parse(fileName);
    const api = await parser.bundle(schema);
    const dirname = `${cwd}/${path.dirname(destPath)}`;
    if (!fs.existsSync(dirname)) {
      try {
        fs.mkdirSync(dirname, { recursive: true });
      } catch (err) {
        console.log(err);
      }
    }
    fs.writeFileSync(`${cwd}/${destPath}`, JSON.stringify(api, null, 2));
  } catch (err) {
    console.log(err);
  } finally {
    process.chdir(cwd);
  }
}

async function traverseDirectory(Directory) {
  const Files = fs.readdirSync(Directory);
  for (const File of Files) {
    const Absolute = path.join(Directory, File);
    if (fs.statSync(Absolute).isDirectory()) {
      await traverseDirectory(Absolute);
    } else {
      const name = Absolute.replace(playDir, destDir);
      await parseSchema(Absolute, name);
    }
  }
}

function copySourceFiles() {
  try {
    fse.copySync(schemaDir, `${rootDir}/schema`);
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
    fs.mkdirSync(destDir, { recursive: true });
    copySourceFiles();

    await traverseDirectory(`${playDir}`);
  } catch (err) {
    console.log(err);
  }
}

main();
