# `@suitegeezus/eslint-sdf-xml-parser`

Custom ESLint parser for XML files generated by SDF.

Intended to be used as the parser for EsLint rules for SDF (e.g. private package 
[`@suitegeezus/eslint-plugin-sdfobjects`](https://www.npmjs.com/search?q=%40suitegeezus)) but can be used more 
generically.  

Based originally on [`eslint-html-parser`](https://www.npmjs.com/package/eslint-html-parser) but this project is very different -- and supports **no js parsing at 
all** by design because SDF XML never has js in it. 

You can use this generically as an HTML parser if all you care about are the nodes mentioned below , and you would 
like a visitor pattern that supports selectors decently and all eslint native token methods (ie. `ESLint.Rule.
RuleContext` ) are supported.

## Installation

```terminal
$ npm install --save-dev eslint-sdf-xml-parser
```

- Requires ESLint 7.x - 9.x (as peer dependency)

## Usage

1. In `.eslintrc.*` add a config section or `overrides` and point it at relevant `files` globs.  (e.g. ) `Objects/**/cust*.xml`
   - use `--ext` on the command line
2. Add the `parser` option to your section file and point it at this package.
3. Add an `parserOptions` you desire.
4. Create any rules and configure them as desired. This plugin is pretty useless w/o custom rules.

```json
{
  "parser": "@suitegeezus/eslint-sdf-xml-parser"
}
```

```terminal
$ eslint "src/Objects/**/*.xml"
# or
$ eslint --ext .xml src/Objects
```

## Options

Within your `.eslintrc.*` file, the `parserOptions` property supports the same options as [htmlparser2](https://github.com/fb55/htmlparser2/wiki/Parser-options)
as well as some new options

These are the default options (which already work great for SDF xml) -- yes it works better in xmlMode=false because 
of the other flags. 
```json
{
    "parser": "@suitegeezus/eslint-sdf-xml-parser",
    "parserOptions": {
        "xmlMode" : false,
        "decodeEntities" : false,
        "lowerCaseTags": false,
        "lowerCaseAttributeNames": false,
        "recognizeSelfClosing": true
    }
}
```

| option                  | value | description                                                                                                                                        |
|:------------------------|:-----:|:---------------------------------------------------------------------------------------------------------------------------------------------------|
| xmlMode                 | true  | seems to be helpful for the tokenizer                                                                                                              |
| decodeEntities          | false | SDF will already decode them and double-decoding is a problem                                                                                      |
| lowerCaseTags           | false | e.g. `entryForm` -- do not get me started                                                                                                          |
| lowerCaseAttributeNames | false | no need                                                                                                                                            |
| recognizeSelfClosing    | true  | Tags like `label` will often appear as `<label/>` when it could be `<label></label>`                                                               |
| tab                     |  '2'  | What represents a tab ('4','2','tab') for the tokenizer                                                                                            |
| attrProperties          | true  | Whether to represent attributes as aliased properties on the tag. e.g. scriptid becomes $scriptid                                                  |
| commentNodes            | false | Whether to additionally expose Comments as Nodes (via `tag.children[]`). <br/> They are always exposed via tag.comments in a eslint-compatible way |

note: `commentNodes` and `attrProperties` are not yet settable

## ESlint Rule Creation

Rule creation should be straightforward and flexible. 

There is a sample rule in the git repository.  Note:
- using selectors is supported (see EsLint AST Selectors)
- using context.options.getSourceCode() object and all its helper methods is fully supported
- Eslint's rule of no overlap between tokens and comments is adhered to.  Note: that this means the AST nodes might 
  appear to be incomplete BUT you simply use the getSourceCode methods above as EsLint docs suggest.

## ESLint Rule Suppression
Because comments are supported as eslint-native comments you can do something like: 

```xml
<sometag></sometag>
 <!-- eslint-disable-next line @suitegeezus/sdfobjects/remove-empty-lines-between-tags --> 

<someothertag></someothertag>
 ```

or if you create a multi-line component then you can suppress rules over for the entire block

```js
 <!-- 
 eslint-disable @suitegeezus/sdfobjects/remove-empty-lines-between-tags 
 --> 
<whenever></whenever>
<sometag></sometag>

<someothertag></someothertag>
```

## AST Info

Xml files are parsed into an AST, which can be traversed, examined, and linted with the visitor pattern like any other 
ESLint source.  The Xml AST that is produced has the following types of nodes and structure:

- Tag
  - tagName: string
  - comments: (Line|Block)[] (braces free version)
  - parent: Tag
  - attributes: Attr[]
  - children: ( Tag | Text )[] (optionally `CommentNode` per option )
  - $scriptid: string - (when relevant attributes are aliased/prefaced with `$` like this)
  - isClosed : boolean
  - innerHTML : string (like value but without the tags)
  - value: string

- Attr
  - parent: Tag
  - attrName: AttrName
  - attrValue: AttrVal
  - name: string

- AttrName
  - parent: Attr
  - value: string

- AttrVal
  - parent: Attr
  - value: string
  - quote: string

- Text
  - parent: Tag
  - value: string

- CommentNode (if commentsNodes= true)
  - parent: Tag
  - value: string

### Whitespace and Layout Rules
Use native Eslint functions to worry about whitespace between things like 
make sure to create these rules as 'layout' meta type and then use the native Eslint functions available to 
calculate whitespace.

## More
You might want to also check out the private package:
[`@suitegeezus/eslint-plugin-sdfobjects`](https://www.npmjs.com/search?q=%40suitegeezus) 
