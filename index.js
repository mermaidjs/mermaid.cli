#!/usr/bin/env node
const commander = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const pkg = require('./package.json')

const logMessage = (color, message, details) => {
  console.log(chalk[color](`\n${message}\n`))
  if (details) {
    console.log(details)
  }
}

const logError = (message, details) => logMessage('red', message, details)
const logWarning = (message, details) => logMessage('yellow', message, details)

const rethrowError = (message, error, exitCode) => {
  const newError = new Error(message)
  newError.details = error.message
  newError.exitCode = exitCode
  throw newError
}

const error = message => {
  logError(message)
  process.exit(1)
}

const checkConfigFile = file => {
  if (!fs.existsSync(file)) {
    error(`Configuration file "${file}" doesn't exist`)
  }
}

commander
  .version(pkg.version)
  .option('-t, --theme [theme]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
  .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
  .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
  .option('-i, --input <input>', 'Input mermaid file. Required.')
  .option('-o, --output [output]', 'Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg"')
  .option('-b, --backgroundColor [backgroundColor]', 'Background color. Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
  .option('-c, --configFile [configFile]', 'JSON configuration file for mermaid. Optional')
  .option('-C, --cssFile [cssFile]', 'CSS file for the page. Optional')
  .option('-p --puppeteerConfigFile [puppeteerConfigFile]', 'JSON configuration file for puppeteer. Optional')
  .parse(process.argv)

let { theme, width, height, input, output, backgroundColor, configFile, cssFile, puppeteerConfigFile } = commander

// check input file
if (!input) {
  error('Please specify input file: -i <input>')
}
if (!fs.existsSync(input)) {
  error(`Input file "${input}" doesn't exist`)
}

// check output file
if (!output) {
  output = input + '.svg'
}
if (!/\.(?:svg|png|pdf)$/.test(output)) {
  error(`Output file must end with ".svg", ".png" or ".pdf"`)
}
const outputDir = path.dirname(output)
if (!fs.existsSync(outputDir)) {
  error(`Output directory "${outputDir}/" doesn't exist`)
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

let browser

const openBrowserPage = async () => {
  try {
    browser = await puppeteer.launch(puppeteerConfig)
    const page = await browser.newPage()
    page.setViewport({ width, height })
    await page.goto(`file://${path.join(__dirname, 'index.html')}`)
    await page.evaluate(`document.body.style.background = '${backgroundColor}'`)
    return page
  } catch (error) {
    rethrowError('Launching Chrome in the headless mode failed.', error, 2)
  }
}

const loadGraphDefinition = async page => {
  try {
    const definition = fs.readFileSync(input, 'utf-8')

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
  } catch (error) {
    rethrowError('Processing the graph definition failed.', error, 3)
  }
}

const saveGraphOutput = async page => {
  try {
    if (output.endsWith('svg')) {
      const svg = await page.$eval('#container', container => container.innerHTML)
      fs.writeFileSync(output, svg)
    } else if (output.endsWith('png')) {
      const clip = await page.$eval('svg', svg => {
        const react = svg.getBoundingClientRect()
        return { x: react.left, y: react.top, width: react.width, height: react.height }
      })
      await page.screenshot({ path: output, clip, omitBackground: backgroundColor === 'transparent' })
    } else { // pdf
      await page.pdf({ path: output, printBackground: backgroundColor !== 'transparent' })
    }
  } catch (error) {
    rethrowError('Saving the graph output failed.', error, 4)
  }
}

const closeBrowser = async () => {
  try {
    if (browser) {
      await browser.close()
    }
  } catch ({ message }) {
    logWarning('Closing Chrome failed.', message)
  }
}

(async () => {
  try {
    const page = await openBrowserPage()
    await loadGraphDefinition(page)
    await saveGraphOutput(page)
  } catch ({ message, details, exitCode }) {
    logError(message, details)
    process.exitCode = exitCode || 1
  } finally {
    await closeBrowser()
  }
})()
