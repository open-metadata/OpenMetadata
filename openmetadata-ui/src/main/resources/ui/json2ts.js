/* eslint-disable */
const $RefParser = require('@apidevtools/json-schema-ref-parser');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { compileFromFile } = require('json-schema-to-typescript');

const cwd = process.cwd();
let bannerComment = '';
const licensingFile = 'types-licensing.txt';

const schemaDir =
  '../../../../../catalog-rest-service/src/main/resources/json/schema';

const rootDir = 'schema';
const destDir = 'src/generated';

const globalParserOptions = {
  continueOnError: true,
  dereference: {
    circular: true,
  },
};

async function generateTS(filePath, destPath) {
  try {
    const fileDir = `${cwd}/${path.dirname(filePath)}`;
    const tsTypes = await compileFromFile(filePath, {
      bannerComment,
      cwd: fileDir,
    });
    const dirname = `${cwd}/${path.dirname(destPath)}`;
    // if (!fs.existsSync(dirname)) {
    //   try {
    //     fs.mkdirSync(dirname, { recursive: true });
    //   } catch (err) {
    //     console.log(err);
    //   }
    // }
    // fs.writeFileSync(`${cwd}/${destPath}`, JSON.stringify(api, null, 2));
    if (!fs.existsSync(dirname)) {
      try {
        fs.mkdirSync(dirname, { recursive: true });
      } catch (err) {
        console.log(err);
      }
    }
    fs.writeFileSync(`${cwd}/${destPath}`, tsTypes);
  } catch (err) {
    console.log(err);
  }
}

async function traverseDirectory(Directory) {
  // fs.readdir(Directory, (err, Files) => {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     Files.forEach(async (File) => {
  //       const Absolute = path.join(Directory, File);
  //       if (fs.statSync(Absolute).isDirectory()) {
  //         return await traverseDirectory(Absolute);
  //       } else {
  //         const name = Absolute.replace(rootDir, destDir).replace(
  //           '.json',
  //           '.ts'
  //         );
  //         // return parseSchema(Absolute, name);
  //         // console.log(Absolute);
  //         // console.log(name);
  //         await generateTS(Absolute, name);
  //       }
  //     });
  //   }
  // });

  const Files = fs.readdirSync(Directory);
  // console.log(Files);
  for (const File of Files) {
    const Absolute = path.join(Directory, File);
    if (fs.statSync(Absolute).isDirectory()) {
      await traverseDirectory(Absolute);
    } else {
      const name = Absolute.replace(rootDir, destDir).replace('.json', '.ts');
      await generateTS(Absolute, name);
    }
  }
}

function copySourceFiles() {
  try {
    fse.copySync(schemaDir, `${rootDir}`);
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
    bannerComment = fs.readFileSync(licensingFile, 'utf8');
    // console.log(bannerComment);
  } catch (err) {
    console.log(err);
  }

  await traverseDirectory(`${rootDir}`);
}

main();
