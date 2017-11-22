# mermaid.cli

Command-line interface for [mermaid](https://mermaidjs.github.io/).

This CLI tool takes a mermaid definition file as input and generates svg/png/pdf file as output.


## Installation

```sh
yarn global add mermaid.cli
```

 Or

```sh
npm install -g mermaid.cli
```

Please install via `npm` instead of `yarn` if you encounter [this issue](https://github.com/yarnpkg/yarn/issues/2224).


## Examples

```sh
mmdc -i input.mmd -o output.svg
```

```sh
mmdc -i input.mmd -o output.png
```

```sh
mmdc -i input.mmd -o output.pdf
```

```sh
mmdc -i input.mmd -o output.svg -w 1024 -H 768
```

```sh
mmdc -i input.mmd -t forest
```

```sh
mmdc -i input.mmd -o output.png -b '#FFF000'
```

```sh
mmdc -i input.mmd -o output.png -b transparent
```


## Options

Please run the following command to see the latest options:

```sh
mmdc -h
```

The following is for your quick reference (may not be the latest version):

```text
Usage: mmdc [options]

  Options:

    -V, --version                            output the version number
    -t, --theme [name]                       Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default
    -w, --width [width]                      Width of the page. Optional. Default: 800
    -H, --height [height]                    Height of the page. Optional. Default: 600
    -i, --input <input>                      Input mermaid file. Required.
    -o, --output [output]                    Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg"
    -b, --backgroundColor [backgroundColor]  Background color. Example: transparent, red, '#F0F0F0'. Optional. Default: white
    -c, --configFile [config]                JSON configuration file for mermaid. Optional
    -C, --cssFile [cssFile]                  CSS alternate file for mermaid. Optional
    -T, --customTheme <customThemeCssFile>   CSS file replacing CSS injected into SVG container. Optional
    -h, --help                               output usage information
```
