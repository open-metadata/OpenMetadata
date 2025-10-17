const path = require('path');
const { execSync } = require('child_process');

const outDir = path.resolve(__dirname, 'src/generated/antlr');

const grammarDir = path.resolve(
  __dirname,
  '../../../../../openmetadata-spec/src/main/antlr4/org/openmetadata/schema'
);

const grammarDiPosix = grammarDir.replace(/\\/g, '/');
const outDirPosix = outDir.replace(/\\/g, '/');

const command = `bash -c "antlr4 -Dlanguage=JavaScript -o "${outDirPosix}" "${grammarDiPosix}/*.g4"`;

try {
    console.log('Running:', command);
    execSync(command, { stdio: 'inherit' });
}
catch(err) {
    process.exit(1);
}