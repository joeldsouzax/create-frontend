#!/usr/bin/env node

//@ts-check

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2), { string: ['_'] });
const prompts = require('prompts');
const {
  yellow,
  green,
  cyan,
  blue,
  magenta,
  lightRed,
  red,
  reset,
} = require('kolorist');

const cwd = process.cwd();

const ERROR_MESSAGE = red('✖') + ' Operation cancelled';

const PROJECTTYPES = [
  {
    name: 'csr',
    color: yellow,
    variants: [{ name: 'react', display: 'typescript-vite', color: yellow }],
  },
];

const TEMPLATES = PROJECTTYPES.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), []);

const renameFiles = {
  _gitignore: '.gitignore',
  _prettierignore: '.prettierignore',
  ['_pretterrc.json']: '.prettierrc.json',
};

async function init() {
  let targetDir = argv._[0];
  let template = argv.template || argv.t;

  const defaultProjectName = !targetDir ? 'react-project' : targetDir;

  let result = {};

  try {
    result = await prompts(
      [
        {
          type: targetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultProjectName,
          onState: (state) =>
            (targetDir = state.value.trim() || defaultProjectName),
        },
        {
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm',
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir}`) +
            ` is not empty. Remove existing files and continue?`,
        },
        {
          // @ts-ignore
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) {
              throw new Error(ERROR_MESSAGE);
            }
            return null;
          },
          name: 'overwriteChecker',
        },
        {
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name: '),
          initial: () => toValidPackageName(targetDir),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name',
        },

        {
          type: template && TEMPLATES.includes(template) ? null : 'select',
          name: 'projectType',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? reset(
                  `"${template}" isn't a valid template. please choose from below: `
                )
              : reset('Select a project type:'),
          initial: 0,
          choices: PROJECTTYPES.map((projectType) => {
            const projectColor = projectType.color;
            return {
              title: projectColor(projectType.name),
              value: projectType,
            };
          }),
        },

        {
          type: (projectType) =>
            projectType && projectType.variants ? 'select' : null,
          name: 'variant',
          message: reset('Select a variant'),
          choices: (projectType) =>
            projectType.variants.map((variant) => {
              const variantColor = variant.color;
              return {
                title: variantColor(variant.name),
                value: variant.name,
              };
            }),
        },
      ],
      {
        onCancel: () => {
          throw new Error(ERROR_MESSAGE);
        },
      }
    );
  } catch (cancelled) {
    console.log(cancelled.message);
    return;
  }

  const { projectType, overwrite, packageName, variant } = result;

  const root = path.join(cwd, targetDir);

  if (overwrite) {
    emptyDir(root);
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root);
  }

  template = variant || projectType || template;

  console.log(`\nScaffolding project in ${root}...`);

  const templateDir = path.join(__dirname, `template-${template}`);

  const write = (file, content) => {
    const targetPath = renameFiles[file]
      ? path.join(root, renameFiles[file])
      : path.join(root, file);

    if (content) {
      fs.writeFileSync(targetPath, content);
    } else {
      copy(path.join(templateDir, file), targetPath);
    }
  };

  const files = fs.readdirSync(templateDir);

  for (const file in files.filter((f) => f !== 'package.json')) {
    write(file);
  }

  const pkg = require(path.join(templateDir, `package.json`));

  pkg.name = packageName || targetDir;

  write('package.json', JSON.stringify(pkg, null, 2));

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent);
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm';

  console.log(`\nDone. Now run:\n`);

  if (root !== cwd) {
    console.log(` cd ${path.relative(cwd, root)}`);
  }

  switch (pkgManager) {
    case 'yarn':
      console.log(' yarn');
      console.log(' yarn dev');
      break;
    default:
      console.log(` ${pkgManager} install`);
      console.log(` ${pkgManager} run dev`);
      break;
  }

  console.log();
}

function isEmpty(targetDir) {
  return fs.readdirSync(targetDir).length === 0;
}
function isValidPackageName(targetDir) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    targetDir
  );
}

function toValidPackageName(targetDir) {
  return targetDir
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-');
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const file of fs.readdirSync(dir)) {
    const abs = path.resolve(dir, file);
    if (fs.lstatSync(abs).isDirectory()) {
      emptyDir(abs);
      fs.rmdirSync(abs);
    } else {
      fs.unlinkSync(abs);
    }
  }
}

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
}

function pkgFromUserAgent(userAgent) {
  if (!userAgent) return undefined;
  const pkgSpec = userAgent.split(' ')[0];
  const pkgSpecArr = pkgSpec.split('/');
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1],
  };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const srcFile = path.resolve(src, file);
    const destFile = path.resolve(dest, file);
    copy(srcFile, destFile);
  }
}

init().catch((e) => console.error(e));
