"use strict";

let ANTLR_SERVICE = "/parse/";
// let ANTLR_SERVICE = "http://lab.antlr.org/parse/";
// let ANTLR_SERVICE = "http://localhost/parse/";

let SAMPLE_PARSER = "// test comment\n" +
    "parser grammar ExprParser;\n" +
    "options { tokenVocab=ExprLexer; }\n" +
    "\n" +
    "program\n" +
    "    : stat EOF\n" +
    "    | def EOF\n" +
    "    ;\n" +
    "\n" +
    //"foo : 'a' 'abc' 'a\\'b' '\\u34ab' 'ab\\ncd' ;\n" +
    "stat: ID '=' expr ';'\n" +
    "    | expr ';'\n" +
    "    ;\n" +
    "\n" +
    "def : ID '(' ID (',' ID)* ')' '{' stat* '}' ;\n" +
    "\n" +
    "expr: ID\n" +
    "    | INT\n" +
    "    | func\n" +
    "    | 'not' expr\n" +
    "    | expr 'and' expr\n" +
    "    | expr 'or' expr\n" +
    "    ;\n" +
    "\n" +
    "func : ID '(' expr (',' expr)* ')' ;"

let SAMPLE_LEXER = "lexer grammar ExprLexer;\n" +
    "\n" +
    "AND : 'and' ;\n" +
    "OR : 'or' ;\n" +
    "NOT : 'not' ;\n" +
    "EQ : '=' ;\n" +
    "COMMA : ',' ;\n" +
    "SEMI : ';' ;\n" +
    "LPAREN : '(' ;\n" +
    "RPAREN : ')' ;\n" +
    "LCURLY : '{' ;\n" +
    "RCURLY : '}' ;\n" +
    "\n" +
    "INT : [0-9]+ ;\n" +
    "ID: [a-zA-Z_][a-zA-Z_0-9]* ;\n" +
    "WS: [ \\t\\n\\r\\f]+ -> skip ;";


function processANTLRResults(response) {
    let parserSession = $("#grammar").data("parserSession")
    let lexerSession = $("#grammar").data("lexerSession")
    let g = parserSession.getValue()
    let lg = lexerSession.getValue();
    let I = $('#input')[0].innerText; // do this to preserve newlines
    let s = $('#start').text();

    if ( typeof(response.data)==="string" ) {
        // Didn't parse as json
        console.log("Bad JSON:")
        console.log(response.data);
        $("#tool_errors").html(`<span class="error">BAD JSON RESPONSE</span><br>`);
        $("#tool_errors").show();
        $("#tool_errors_header").show();
        return;
    }

    let result = response.data.result;
    console.log(result);

    if ( "arg_error" in response.data ) {
        $("#tool_errors").html(`<span class="error">${response.data.arg_error}</span><br>`);
        $("#tool_errors").show();
        $("#tool_errors_header").show();
        return;
    }

    if ( "exception" in response.data ) {
        $("#tool_errors").html(`<span class="error">${response.data.exception_trace}<br></span>`);
        $("#tool_errors").show();
        $("#tool_errors_header").show();
        return;
    }

    showToolErrors(response);

    if ( Object.keys(result).length===0 ) {
        return;
    }

    showParseErrors(response);

    let tokens = result.tokens;
    let symbols = result.symbols;
    let lex_errors = result.lex_errors;
    let parse_errors = result.parse_errors;

    let profile = result.profile;

    let chunks = chunkifyInput(I, tokens, symbols, lex_errors, parse_errors);
    chunks = chunks.map(c =>
         `<span ${'error' in c ? 'style="color:#E93A2B; text-decoration: underline dotted #E93A2B;"' : ""} class='tooltip' title='${c.tooltip}'>${c.chunktext}</span>`
    );
    let newInput = chunks.join('');

    $("#input").html(newInput);

    $('#input span').hover(function (event) {
        if ( !event.ctrlKey ) return;
        let oldStyle = $(this).css('text-decoration');
        if ( $(this).css("cursor")!=="pointer" ) {
            $(this).css('cursor','pointer');
        }
        $(this).data( "text-decoration", oldStyle ); // save
        $(this)
            .css('text-decoration', 'underline')
            .css('font-weight', 'bold')
            .css('text-decoration-color', 'darkgray').text();
    }, function () {
        let oldStyle = $(this).data( "text-decoration");
        if ( $(this).css("cursor")==="pointer" ) {
            $(this).css('cursor','auto');
        }
        $(this)
            .css('text-decoration', oldStyle)
            .css('font-weight', 'normal')
    });

    $('div span').tooltip({
        show: {duration: 0}, hide: {duration: 0}, tooltipClass: "mytooltip"
    });

    // $(document).tooltip("disable").tooltip("hide");
    $(document).keydown(
        e => e.ctrlKey ? $(document).tooltip("enable") : null
    );
    $(document).keyup(
        e => $(document).tooltip("disable")
    );
    $(document).tooltip("disable");

    let svgtree = result.svgtree;
    let tree = result.tree;
    let buf = ['<ul id="treeUL">'];
    walk(tree, result, I, buf);
    buf.push('</ul>');
    console.log(buf.join('\n'));
    $("#svgtree").html("<iframe style='border: none; overflow: auto; min-height: 15em; width: 100%' srcdoc='"+svgtree+"'></iframe>");
    // $("#svgtree").html("<iframe srcdoc='"+svgtree+"'></iframe>");
    $("#tree").html(buf.join('\n'))

    initParseTreeView();

    buildProfileTableView(profile.colnames, profile.data);
}

function walk(t, result, input, buf) {
    if (t == null) return;

    if ( 'error' in t ) {
        buf.push(`<li class="tree-token" style="color: #905857">&lt;error:${t.error}&gt;</li>`);
        return;
    }

    let symbols = result.symbols;
    let rulenames = result.rules;
    let tokens = result.tokens;
    let ruleidx = t.ruleidx;
    let alt = t.alt;
    // console.log(rulenames[ruleidx]);
    buf.push('<li><span class="tree-root expanded-tree">'+rulenames[ruleidx]+'</span>')
    if ( 'kids' in t && t.kids.length > 0) {
        buf.push('<ul class="nested active">');
        for (let i = 0; i < t.kids.length; i++) {
            let kid = t.kids[i];
            if (typeof (kid) == 'number') {
                let a = tokens[kid].start;
                let b = tokens[kid].stop;
                buf.push(`<li class="tree-token">${input.slice(a, b + 1)}</li>`);
                // console.log(`${symbols[tokens[kid].type]}:${input.slice(a, b + 1)}`);
            }
            else {
                walk(kid, result, input, buf);
            }
        }
        buf.push('</ul>');
    }
}

async function run_antlr() {
    let parserSession = $("#grammar").data("parserSession")
    let lexerSession = $("#grammar").data("lexerSession")
    let g = parserSession.getValue()
    let lg = lexerSession.getValue();
    let I = $('#input')[0].innerText; // do this to preserve newlines
    let s = $('#start').text();

    $("#profile_choice").show();

    await axios.post(ANTLR_SERVICE,
        {grammar: g, lexgrammar: lg, input: I, start: s}
    )
        .then(processANTLRResults)
        .catch((error) => {
            if( error.response ){
                console.log(error.response.data); // => the response payload
            }
        });
}

function initParseTreeView() {
    $("#svgtreetab").show();
    $("#treetab").show();
    // $("#svgtree_header").show();
    // $("#tree_header").show();
    let toggler = document.getElementsByClassName("tree-root");
    for (let i = 0; i < toggler.length; i++) {
	// add event handler to open/close
        toggler[i].addEventListener("click", function () {
            let nested = this.parentElement.querySelector(".nested");
            if (nested != null) {
                nested.classList.toggle("active");
            }
            this.classList.toggle("expanded-tree");
        });
    }
}

function buildProfileTableView(colnames, rows) {
    let table = "<table class='profile-table'>\n";
    table += "<thead>\n";
    table += "  <tr>\n";
    for (const name of colnames) {
        table += "<th>"+name+"</th>";
    }
    table += "  </tr>\n";
    table += "</thead>\n";

    table += "<tbody>\n";
    for (const row of rows) {
        table += "      <tr>";
        for (const v of row) {
            table += "<td>"+v+"</td>";
        }
        table += "</tr>\n";
    }
    table += "</tbody>\n";
    table += "</table>\n";
    $("#profile").html(table)
}

function chunkifyInput(input, tokens, symbols, lex_errors, parse_errors) {
    let charToChunk = new Array(input.length);
    for (let ti in tokens) {
        let t = tokens[ti];
        let toktext = input.slice(t.start, t.stop + 1);
        let tooltipText = `#${ti} Type ${symbols[t.type]} Line ${t.line}:${t.pos}`;
        let chunk = {tooltip:tooltipText, chunktext:toktext};
        for (let i = t.start; i <= t.stop; i++) {
            charToChunk[i] = chunk;
        }
    }
    for (let ei in lex_errors) {
        let e = lex_errors[ei];
        let errtext = input.slice(e.startidx, e.erridx + 1);
        let tooltipText = `${e.line}:${e.pos} ${e.msg}`;
        let chunk = {tooltip:tooltipText, chunktext:errtext, error:true};
        for (let i = e.startidx; i <= e.erridx; i++) {
            charToChunk[i] = chunk;
        }
    }
    // augment tooltip for any tokens covered by parse error range
    for (let ei in parse_errors) {
        let e = parse_errors[ei];
        let tooltipText = `${e.line}:${e.pos} ${e.msg}`;
        for (let i = tokens[e.startidx].start; i <= tokens[e.stopidx].stop; i++) {
            charToChunk[i].tooltip += '\n'+tooltipText;
            charToChunk[i].error = true;
        }
    }

    // chunkify skipped chars (adjacent into one chunk)
    let i = 0;
    while ( i<input.length ) {
        if ( charToChunk[i]==null ) {
            let a = i;
            while ( charToChunk[i]==null && i<input.length ) {
                i++;
            }
            let b = i;
            let skippedText = input.slice(a, b);
            let chunk = {tooltip:"Skipped", chunktext:skippedText};
            for (let i = a; i < b; i++) {
                charToChunk[i] = chunk;
            }
        }
        else {
            i++;
        }
    }

    // Walk input again to get unique chunks
    i = 0;
    let chunks = [];
    let previousChunk = null;
    while ( i<input.length ) {
        let currentChunk = charToChunk[i];
        if ( currentChunk!=previousChunk ) {
            chunks.push(currentChunk);
        }
        previousChunk = currentChunk;
        i++;
    }
    console.log(chunks);
    return chunks;
}

function showToolErrors(response) {
    if (response.data.parser_grammar_errors.length > 0 ||
        response.data.lexer_grammar_errors.length > 0 ||
        response.data.warnings.length > 0)
    {
        let errors = "";
        response.data.parser_grammar_errors.forEach( function(e) {
            errors += `<span class="error">${e.msg}</span><br>`;
        });
        response.data.lexer_grammar_errors.forEach( function(e) {
            errors += `<span class="error">${e.msg}</span><br>`;
        });
        response.data.warnings.forEach( function(w) {
            errors += `<span class="error">${w.msg}</span><br>`;
        });
        errors += "\n";
        $("#tool_errors").html(errors);
        $("#tool_errors").show();
        $("#tool_errors_header").show();
    }
    else {
        $("#tool_errors").hide();
        $("#tool_errors_header").hide();
    }
}

function showParseErrors(response) {
    if (response.data.result.lex_errors.length > 0 ||
        response.data.result.parse_errors.length > 0 )
    {
        let errors = "";
        response.data.result.lex_errors.forEach( function(e) {
            errors += `<span class="error">${e.line}:${e.pos} ${e.msg}</span><br>`;
        });
        response.data.result.parse_errors.forEach( function(e) {
            errors += `<span class="error">${e.line}:${e.pos} ${e.msg}</span><br>`;
        });
        errors += "\n";
        $("#parse_errors").html(errors);
        $("#parse_errors").show();
        $("#parse_errors_header").show();
    }
    else {
        $("#parse_errors").hide();
        $("#parse_errors_header").hide();
    }
}

function createAceANTLRMode() {
    var ANTLR4HighlightRules = function() {
        var keywordMapper = this.createKeywordMapper({
            "keyword.control": "grammar|options|header|parser|lexer|returns|fragment",
        }, "identifier");
        this.$rules = {
            "start": [
                { token : "string",  regex : '[\'](?:(?:\\\\.)|(?:\\\\u....)|(?:[^\'\\\\]))*?[\']' },
                { token : "comment.line", regex : "//.*$" },
                { token: keywordMapper, regex: "[a-zA-Z][a-zA-Z0-9_]*" },
                { token : "punctuation.operator", regex : "\\?|\\:|\\||\\;" },
                { token : "paren.lparen", regex : "[[({]" },
                { token : "paren.rparen", regex : "[\\])}]" },
            ]
        };
    };

    var ANTLR4Mode = function() {
        this.HighlightRules = ANTLR4HighlightRules;
    };

    ace.define('ace/mode/antlr4-mode',
        ["require", "exports", "module", "ace/lib/oop", "ace/mode/text",
            "ace/mode/text_highlight_rules", "ace/worker/worker_client"],
        function (require, exports, module) {
            var oop = require("ace/lib/oop");
            var TextMode = require("ace/mode/text").Mode;
            var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

            oop.inherits(ANTLR4HighlightRules, TextHighlightRules);
            oop.inherits(ANTLR4Mode, TextMode);

            exports.Mode = ANTLR4Mode;
        });
}

function createdAceEditor(parserSession) {
    var editor = ace.edit("grammar");
    editor.setSession(parserSession);
    editor.setOptions({
        "highlightActiveLine": false,
        "readOnly": false,
        "showLineNumbers": true,
        "showGutter": true
    });
    // $("#grammar").resize()

    // ace.define('ace/mode/my-mode',
    //     ["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/text_highlight_rules",
    //                  "ace/worker/worker_client" ],
    //     function(require, exports, module) {
    //     var oop = require("ace/lib/oop");
    //     var TextMode = require("ace/mode/text").Mode;
    //     var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;
    //     var DocCommentHighlightRules = require("ace/mode/doc_comment_highlight_rules").DocCommentHighlightRules;
    //
    //     var MyHighlightRules = function() {
    //         var keywordMapper = this.createKeywordMapper({
    //             "keyword.control": "grammar|parser|lexer|options|@parser::header|@header|returns|fragment",
    //         }, "identifier");
    //         this.$rules = {
    //             "start": [
    //                 { token : "comment.line", regex : "//.*$" },
    //                 // { token : "comment.block", regex : "/\\*.*?\\*/" },
    //                 // DocCommentHighlightRules.getStartRule("doc-start"),
    //                 {
    //                     token : "comment", // multi line comment
    //                     regex : "\\/\\*",
    //                     next : "comment"
    //                 },
    //                 { token : "string",  regex : '[\'](?:(?:\\\\.)|(?:[^"\\\\]))*?[\']' },
    //                 { token : "punctuation.operator", regex : "\\?|\\:|\\||\\;" },
    //                 { token : "paren.lparen", regex : "[[({]" },
    //                 { token : "paren.rparen", regex : "[\\])}]" },
    //                 { token : "text", regex : "\\s+" },
    //                 { token: keywordMapper, regex: "[a-zA-Z_$][a-zA-Z0-9_$]*\\b" },
    //                 { token: "variable", regex: "[a-zA-Z_$][a-zA-Z0-9_$]*\\b" }
    //             ]
    //         };
    //         this.embedRules(DocCommentHighlightRules, "doc-",
    //             [ DocCommentHighlightRules.getEndRule("start") ]);
    //     };
    //     oop.inherits(MyHighlightRules, TextHighlightRules);
    //
    //     var MyMode = function() {
    //         this.HighlightRules = MyHighlightRules;
    //     };
    //     oop.inherits(MyMode, TextMode);
    //
    //     (function() {
    //
    //         this.$id = "ace/mode/my-mode";
    //
    //     }).call(MyMode.prototype);
    //
    //     exports.Mode = MyMode;
    // });

    createAceANTLRMode()
    editor.getSession().setMode("ace/mode/antlr4-mode");

    return editor;
}

function setupGrammarTabs() {
    var parserSession = ace.createEditSession(SAMPLE_PARSER);
    var lexerSession = ace.createEditSession(SAMPLE_LEXER);
    var editor = createdAceEditor(parserSession);

    $("#grammar").data("parserSession", parserSession);
    $("#grammar").data("lexerSession", lexerSession);


    $("#parsertab").addClass("tabs-header-selected");
    $("#lexertab").removeClass("tabs-header-selected");

    $("#parsertab").click(function () {
        editor.setSession(parserSession);
        $("#parsertab").addClass("tabs-header-selected");
        $("#lexertab").removeClass("tabs-header-selected");
    });
    $("#lexertab").click(function () {
        editor.setSession(lexerSession);
        $("#parsertab").removeClass("tabs-header-selected");
        $("#lexertab").addClass("tabs-header-selected");
    });
}

function setupTreeTabs() {
    // $("#svgtree_header").hide();
    // $("#tree_header").hide();
    $("#svgtreetab").hide();
    $("#treetab").hide();
    $("#svgtreetab").addClass("tabs-header-selected");
    $("#treetab").removeClass("tabs-header-selected");
    $("#svgtree").show();
    $("#tree").hide();

    $("#svgtreetab").click(function () {
        $("#svgtree").show();
        $("#tree").hide();
        $("#svgtreetab").addClass("tabs-header-selected");
        $("#treetab").removeClass("tabs-header-selected");
    });
    $("#treetab").click(function () {
        $("#svgtree").hide();
        $("#tree").show();
        $("#svgtreetab").removeClass("tabs-header-selected");
        $("#treetab").addClass("tabs-header-selected");
    });
}

// MAIN
$(document).ready(function() {
    String.prototype.sliceReplace = function (start, end, repl) {
        return this.substring(0, start) + repl + this.substring(end);
    };

    $(document).tooltip();

    setupGrammarTabs();

    setupTreeTabs();

    $("#profile_choice").hide();
    $("#profile_header").hide();
    $("#profile").hide();
    $("#profile_choice").click(function () {
        if ( $("#profile_choice").text().startsWith("Show") ) {
            $("#profile_choice").text("Hide profiler");
            $("#profile_header").show();
            $("#profile").show();
        }
        else {
            $("#profile_choice").text("Show profiler");
            $("#profile_header").hide();
            $("#profile").hide();
        }
    });

    $("#tool_errors").hide();
    $("#parse_errors").hide();
    $("#tool_errors_header").hide();
    $("#parse_errors_header").hide();
});
