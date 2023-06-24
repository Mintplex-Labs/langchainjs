const fs = require('fs')


const package = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const { exports: _exports, ...rest } = package

fs.writeFileSync('./package.json', JSON.stringify(rest, null, 2))
console.log('Complete.')