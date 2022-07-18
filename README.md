# `@suitegeezus/eslint-sdf-xml-parser`

Custom ESLint parser for XML files generated by SDF. 

Based originally on [`eslint-html-parser`](https://www.npmjs.com/package/eslint-html-parser) but this project is very different -- and supports **no js parsing at 
all**

You can use this generically as an HTML parser if all you care about are the nodes mentioned below , nd you would 
like a visitor pattern.

## Installation

```terminal
$ npm install --save-dev eslint-sdf-xml-parser
```

- Requires ESLint 7.x or later (peer dependency)

## Usage

1. Add the `parser` option to your `.eslintrc.*` file.
2. Use glob patterns or the `--ext` CLI option to target sdf file (e.g. ) `Objects/**/cust*.xml`

```json
{
    "parser": "eslint-sdf-xml-parser"
}
```

```terminal
$ eslint "src/Objects/**/*.xml"
# or
$ eslint --ext .xml src/Objects
```

## Options

Within your `.eslintrc.*` file, the `parserOptions` property supports the same options as [htmlparser2](https://github.com/fb55/htmlparser2/wiki/Parser-options)

These are the default options (which already work great for SDF xml) -- yes it works better in xmlMode=false because 
of the other flags. 
```json
{
    "parser": "eslint-sdf-xml-parser",
    "parserOptions": {
        "xmlMode" : false,
        "decodeEntities" : true,
        "lowerCaseTags": false,
        "lowerCaseAttributeNames": false,
        "recognizeSelfClosing": true
    }
}
```

## Usage for custom rules/plugins

Xml files are parsed into an AST, which can be traversed, examined, and linted with the visitor pattern like any other 
ESLint source.  The Xml AST that is produced has the following types of nodes and structure:

- XmlElement
  - tagName: string
  - parent: XmlElement
  - attributes: XmlAttribute[]
  - children: (XmlElement | XmlText | XmlComment)[]

- XmlAttribute
  - parent: XmlElement
  - attribName: string
  - attribValue: string

- XmlText
  - parent: XmlElement
  - value: string

- XmlComment
  - parent: XmlElement
  - text: string

## More
You might want to also check out the private package:
[`@suitegeezus/eslint-plugin-sdfobjects`](https://www.npmjs.com/search?q=%40suitegeezus) 
