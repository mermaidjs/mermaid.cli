const path = require('path')
const fs = require('fs')

{
  const pathToMermaid = require.resolve('mermaid')
  fs.symlinkSync(path.join(pathToMermaid,  '..', 'mermaid.min.js'), path.join(__dirname, 'mermaid.min.js'))
}
{
  const pathToMermaid = require.resolve('@fortawesome/fontawesome-free-webfonts')
  fs.symlinkSync(path.join(pathToMermaid, '../../'), path.join(__dirname, 'fontawesome'))
}
