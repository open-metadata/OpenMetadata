/* eslint-disable */
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

const cwd = process.cwd();

const schemaDir =
  '../../../../../catalog-rest-service/src/main/resources/json/schema';

const rootDir = 'ingTemp';
const srcDir = 'schema/metadataIngestion';
const destDir = 'src/jsons/ingestionSchemas/metadataIngestion';

const playDir = `${rootDir}/${srcDir}/${rootDir}`;

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
    const dirname = `${cwd}/${path.dirname(destPath)}`;
    if (!fs.existsSync(dirname)) {
      try {
        fs.mkdirSync(dirname, { recursive: true });
      } catch (err) {
        console.log(err);
      }
    }
    fs.writeFileSync(`${cwd}/${destPath}`, JSON.stringify(api, null, 2));

    console.log('Abs: ', filePath);
    console.log('Name: ', destPath);
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
      const name = Absolute.replace(`${rootDir}/${srcDir}`, destDir);
      return parseSchema(Absolute, name);
    }
  });
}

function copySourceFiles() {
  try {
    fse.copySync(schemaDir, `${rootDir}/schema`);
    fse.copySync(schemaDir, `${playDir}/schema`);
  } catch (err) {
    console.error(err);
  }
}

function main() {
  try {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
    fs.mkdirSync(destDir, { recursive: true });
    copySourceFiles();
  } catch (err) {
    console.log(err);
  }

  process.chdir(`${cwd}/${playDir}/..`);

  // fs.readdir(srcDir, (err, Files) => {
  //   if (err) console.log(err);
  //   else {
  //     Files.forEach((File, index) => {
  //       const Absolute = path.join(srcDir, File);
  //       if (fs.statSync(Absolute).isDirectory()) {
  //         traverseDirectory(Absolute);
  //       }
  //     });
  //   }
  // });
  traverseDirectory(`${rootDir}/${srcDir}`);
}

main();
