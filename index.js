#!/usr/bin/env node
const commander = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const stream = require('stream')
const puppeteer = require('puppeteer')

const pkg = require('./package.json')

const error = message => {
  console.log(chalk.red(`\n${message}\n`))
  process.exit(1)
}

const checkConfigFile = file => {
  if (!fs.existsSync(file)) {
    error(`Configuration file "${file}" doesn't exist`)
  }
}

const readStreamToString = async (inputStream, encoding) => {
  return new Promise((resolve, reject) => {
    let chunks = ''
    inputStream.setEncoding(encoding)
    inputStream
      .on('error', reject)
      .on('data', chunk => (chunks += chunk))
      .on('end', () => resolve(chunks))
  })
}

const createMemoryStream = input => {
  const stringStream = new stream.Readable()
  stringStream.push(input)
  stringStream.push(null)
  return stringStream
}

const writeStreamToStream = async (inputStream, outputStream) => {
  const stdout = outputStream === process.stdout
  return new Promise((resolve, reject) => {
    outputStream
      .on('error', reject)
      .on('finish', () => outputStream.close(resolve))
    inputStream
      .on('error', reject)
      .on('end', () => stdout && process.nextTick(resolve))
      .pipe(outputStream)
      .on('error', reject)
  })
}

commander
  .version(pkg.version)
  .option('-t, --theme [theme]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
  .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
  .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
  .option('-f, --format [format]', 'Output format. Optional. Default: inferred from the file extension or svg')
  .option('-i, --input [input]', 'Input mermaid file. Optional. Default: standard input')
  .option('-o, --output [output]', 'Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg" or standard output')
  .option('-b, --backgroundColor [backgroundColor]', 'Background color. Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
  .option('-c, --configFile [configFile]', 'JSON configuration file for mermaid. Optional')
  .option('-C, --cssFile [cssFile]', 'CSS file for the page. Optional')
  .option('-p --puppeteerConfigFile [puppeteerConfigFile]', 'JSON configuration file for puppeteer. Optional')
  .parse(process.argv)

let { theme, width, height, format, input, output, backgroundColor, configFile, cssFile, puppeteerConfigFile } = commander

// check input file or use standard input
let inputStream
if (input) {
  if (!fs.existsSync(input)) {
    error(`Input file "${input}" doesn't exist`)
  }
  inputStream = fs.createReadStream(input)
} else {
  inputStream = process.stdin
}

// check format
if (format) {
  if (!/^svg|png|pdf$/.test(format)) {
    error('Output format must be "svg", "png" or "pdf"')
  }
}

// check output file
if (!output && input) {
  output = input + '.' + (format || 'svg')
}
if (output) {
  if (!/\.(?:svg|png|pdf)$/.test(output)) {
    error('Output file must end with ".svg", ".png" or ".pdf"')
  }
  const outputDir = path.dirname(output)
  if (!fs.existsSync(outputDir)) {
    error(`Output directory "${outputDir}/" doesn't exist`)
  }
  format = path.extname(output).substr(1)
}

// check config files
let mermaidConfig = { theme }
if (configFile) {
  checkConfigFile(configFile)
  mermaidConfig = Object.assign(mermaidConfig, JSON.parse(fs.readFileSync(configFile, 'utf-8')))
}
let puppeteerConfig = {}
if (puppeteerConfigFile) {
  checkConfigFile(puppeteerConfigFile)
  puppeteerConfig = JSON.parse(fs.readFileSync(puppeteerConfigFile, 'utf-8'))
}

// check cssFile
let myCSS
if (cssFile) {
  if (!fs.existsSync(cssFile)) {
    error(`CSS file "${cssFile}" doesn't exist`)
  }
  myCSS = fs.readFileSync(cssFile, 'utf-8')
}

// normalize args
width = parseInt(width)
height = parseInt(height)
backgroundColor = backgroundColor || 'white';

(async () => {
  const browser = await puppeteer.launch(puppeteerConfig)
  const page = await browser.newPage()
  page.setViewport({ width, height })
  await page.goto(`file://${path.join(__dirname, 'index.html')}`)
  await page.evaluate(`document.body.style.background = '${backgroundColor}'`)
  const definition = await readStreamToString(inputStream, 'utf8')

  await page.$eval('#container', (container, definition, mermaidConfig, myCSS) => {
    container.innerHTML = definition
    window.mermaid.initialize(mermaidConfig)

    if (myCSS) {
      const head = window.document.head || window.document.getElementsByTagName('head')[0]
      const style = document.createElement('style')
      style.type = 'text/css'
      if (style.styleSheet) {
        style.styleSheet.cssText = myCSS
      } else {
        style.appendChild(document.createTextNode(myCSS))
      }
      head.appendChild(style)
    }

    window.mermaid.init(undefined, container)
  }, definition, mermaidConfig, myCSS)

  let content
  if (!format || format === 'svg') {
    content = await page.$eval('#container', container => container.innerHTML)
  } else if (format === 'png') {
    const clip = await page.$eval('svg', svg => {
      const react = svg.getBoundingClientRect()
      return { x: react.left, y: react.top, width: react.width, height: react.height }
    })
    content = await page.screenshot({ clip, omitBackground: backgroundColor === 'transparent' })
  } else { // pdf
    content = await page.pdf({ printBackground: backgroundColor !== 'transparent' })
  }
  content = createMemoryStream(content)

  const target = output ? fs.createWriteStream(output) : process.stdout
  await writeStreamToStream(content, target)

  browser.close()
})()
