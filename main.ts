import{readdirSync as r,readFileSync as f,mkdirSync as m,writeFileSync as w}from'node:fs';
import{solve}from'./solver.js';
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const d of r(I).sort()){m(O+'/'+d,{recursive:true});w(O+'/'+d+'/solution.txt',(solve(f(I+'/'+d+'/level.txt','utf8')).moves??'')+'\n')}
