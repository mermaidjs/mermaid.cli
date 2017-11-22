#!/usr/bin/env node
const commander = require('commander')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const pkg = require('./package.json')

const error = (message) => {
  console.log(chalk.red(`\n${message}\n`))
  process.exit(1)
}

commander
  .version(pkg.version)
  .option('-t, --theme [name]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
  .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
  .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
  .option('-i, --input <input>', 'Input mermaid file. Required.')
  .option('-o, --output [output]', 'Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg"')
  .option('-b, --backgroundColor [backgroundColor]', 'Background color. Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
  .option('-c, --configFile [config]', 'JSON configuration file for mermaid. Optional')
  .option('-C, --cssFile [cssFile]', 'CSS alternate file for mermaid. Optional')
  .option('-T, --customTheme <customThemeCssFile>', 'CSS file replacing CSS injected into SVG container. Optional')
  .parse(process.argv)

let { theme, width, height, input, output, backgroundColor, configFile, cssFile, customTheme } = commander

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

if (configFile) {
  if (!fs.existsSync(configFile)) {
    error(`Configuration file "${configFile}" doesn't exist`)
  } else if (!/\.(?:json)$/.test(configFile)) {
    error(`Config file must end with ".json"`)
  }
}

if (cssFile) {
  if (!fs.existsSync(cssFile)) {
    error(`CSS file "${cssFile}" doesn't exist`)
  } else if (!/\.(?:css)$/.test(cssFile)) {
    error(`CSS file must end with ".css"`)
  }
}

if (customTheme) {
  if (!fs.existsSync(customTheme)) {
    error(`CSS file "${customTheme}" doesn't exist`)
  } else if (!/\.(?:css)$/.test(customTheme)) {
    error(`CSS file must end with ".css"`)
  }
}

// normalize args
width = parseInt(width)
height = parseInt(height)
backgroundColor = backgroundColor || 'white'

;(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  page.on('console', msg => console.log('PAGE LOG:', ...msg.args))
  page.setViewport({ width, height })
  await page.goto(`file://${path.join(__dirname, 'index.html')}`)

  await page.evaluate(`document.body.style.background = '${backgroundColor}'`)

  const definition = fs.readFileSync(input, 'utf-8')

  let myconfig, myCSS, myTheme

  if (configFile) {
    myconfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
  }

  if (cssFile) {
    myCSS = fs.readFileSync(cssFile, 'utf-8')
  }

  if (customTheme) {
    myTheme = fs.readFileSync(customTheme, 'utf-8')
  }

  await page.$eval('#container', (container, definition, theme, myconfig, myCSS, myTheme) => {
    container.innerHTML = definition
    window.mermaid_config = { theme }

    if (myconfig) {
    // See https://github.com/knsv/mermaid/blob/master/src/mermaidAPI.js
      window.mermaid.initialize(myconfig)
    }

    if (myCSS) {
      var head = window.document.head || window.document.getElementsByTagName('head')[0],
        style = document.createElement('style');

      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = myCSS;
      } else {
        style.appendChild(document.createTextNode(myCSS));
      }

      head.appendChild(style);
    }

    window.mermaid.init(undefined, container)

    if (myTheme) {
      // console.log('Replacing CSS with Custom Theme')
      window.document.getElementById('mermaidChart0').getElementsByTagName('style')[0].innerHTML = myTheme;
    }

  }, definition, theme, myconfig, myCSS, myTheme)

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

  browser.close()
})()
