/* @flow */
import fs from 'fs';
import path from 'path';
import util from 'util';
import makeDebug from 'debug';
import postcss from 'postcss';
import loadConfig from 'postcss-load-config';
import {
  dirname,
  extname,
  resolve,
  join,
} from 'path';

import {
  execFileSync,
  spawn,
} from 'child_process';

// note: socket path is important to keep short as it will be truncated if it
// exceeds certain platform limits. for this reason, we're writing to /tmp
// instead of using os.tmpdir (which can, on platforms like darwin, be quite
// long & per-process).
const projectId = process.cwd().toLowerCase().replace(/[^a-z]/ig, '');
const socketName = `bptp-${projectId}.sock`;
const socketPath = join('/tmp', socketName);
const tmpPath = join('/tmp', `bptp-${projectId}`);

// const nodeExecutable = process.argv[0];
// const clientExcutable = join(__dirname, 'postcss-client.js');
// const serverExcutable = join(__dirname, 'postcss-server.js');

// let server;

// const startServer = () => {
//   server = spawn(nodeExecutable, [serverExcutable, socketPath, tmpPath], {
//     env: process.env, // eslint-disable-line no-process-env
//     stdio: 'inherit',
//   });

//   server.unref();
// };

// const stopServer = () => {
//   if (!server) { return; }

//   server.kill();
//   server = null;
//   process.removeListener('exit', stopServer);
// };

// const launchServer = () => {
//   if (server) { return; }

//   startServer();

//   process.on('exit', stopServer);
// };

const extensions = ['.css'];

const getStylesFromStylesheet =async function(stylesheetPath: string, file: any,
  config: any): any {
  console.log("getStylesFromStylesheet");
  const stylesheetExtension = extname(stylesheetPath);

  if (extensions.indexOf(stylesheetExtension) !== -1) {
    let tokens, cache;
    const requiringFile = file.opts.filename;
    const cssFile = resolve(dirname(requiringFile), stylesheetPath);
    const data = JSON.stringify({ cssFile, config });

    const source =   fs.readFileSync(cssFile, 'utf8');
    const extractModules = (_, resultTokens: any) => {
      console.log("extractModules=====================");
      // console.log(arguments);
      // console.log(resultTokens);
        tokens = resultTokens;
    };

    let configPath = path.dirname(cssFile);

    if (config) {
      configPath = path.resolve(config);
    }
    // console.log(config);
    // console.log(configPath);

    const { plugins, options } =    await loadConfig({ extractModules }, configPath);
    // const config_r =    await loadConfig({ extractModules }, configPath);    
    // console.log(config_r);
    console.log(plugins);
    console.log(options);
    console.log(postcss);
    
    const runner = postcss(plugins);


    await runner.process(source, Object.assign({
      from: cssFile,
      to: cssFile, // eslint-disable-line id-length
    }, options));
    // console.log(cssFile);
    // console.log(source);
    // console.log(tokens);
    const result=JSON.stringify(tokens);
    console.log(result);
    console.log("before return 2")
    return JSON.parse(result || '{}');
  }
  console.log("before return")
  return undefined;
};

export default function transformPostCSS({ types: t }: any): any {

  return {
    visitor: {
      CallExpression(path: any, { file }: any) {
        const { callee: { name: calleeName }, arguments: args } = path.node;

        if (calleeName !== 'require' ||
            !args.length ||
            !t.isStringLiteral(args[0])) {
          return;
        }

        const [{ value: stylesheetPath }] = args;
        const { config } = this.opts;
        const tokens = getStylesFromStylesheet(stylesheetPath, file, config);
        console.log("===getStylesFromStylesheet finish===");
        if (tokens !== undefined) {
          const expression = path.findParent((test) => (
            test.isVariableDeclaration() ||
              test.isExpressionStatement()
          ));

          expression.addComment(
            'trailing', ` @related-file ${stylesheetPath}`, true
          );

          path.replaceWith(t.objectExpression(
            Object.keys(tokens).map(
              (token) => t.objectProperty(
                t.stringLiteral(token),
                t.stringLiteral(tokens[token])
              )
            )
          ));
        }
      },
      ImportDeclaration(path: any, { file }: any) {
        const stylesheetPath = path.node.source.value;
        // console.log(path.node.specifiers);
        // console.log(path.node);
        
        if (path.node.specifiers.length !== 1) {
          return;
        }

        const { config } = this.opts;
        const tokens = getStylesFromStylesheet(stylesheetPath, file, config);
        console.log("===getStylesFromStylesheet finish===");
        if (tokens) {
          const styles = t.objectExpression(
            Object.keys(tokens).map(
              (token) => t.objectProperty(
                t.stringLiteral(token),
                t.stringLiteral(tokens[token])
              )
            )
          );
          /* eslint-disable new-cap */

          const variableDeclaration = t.VariableDeclaration('var',
            [t.VariableDeclarator(path.node.specifiers[0].local, styles)]);

          /* eslint-enable new-cap */
          path.addComment('trailing', ` @related-file ${stylesheetPath}`, true);
          path.replaceWith(variableDeclaration);
        }
      },
    },
  };
}

// export {
//   startServer,
//   stopServer,
// };
