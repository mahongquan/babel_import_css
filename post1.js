import fs from 'fs';
import path from 'path';
import util from 'util';
import makeDebug from 'debug';
import postcss from 'postcss';
function func1(cssFileName,json,outputFilName){
  console.log(arguments);
}
postcss([
  require('postcss-modules')({
  getJSON:func1})
  ]);