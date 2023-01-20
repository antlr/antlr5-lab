import React, {Component, MouseEvent, createRef} from "react";
import GrammarSample from "../data/GrammarSample";
import CSS from "csstype";
import {
    Button,
    ButtonGroup,
    Dropdown,
    FormCheck,
    FormControl,
    FormLabel,
    Image,
    OverlayTrigger,
    Popover
} from "react-bootstrap";
import DropdownToggle from "react-bootstrap/DropdownToggle";
import DropdownMenu from "react-bootstrap/DropdownMenu";
import DropdownItem from "react-bootstrap/DropdownItem";
// @ts-ignore
import help from "../assets/helpicon.png";
import AceEditor from "react-ace";
import {IAceEditor} from "react-ace/lib/types";
import "ace-builds/src-noconflict/theme-chrome";
import {SAMPLE_INPUT} from "../data/Samples";
import AntlrInput from "../antlr/AntlrInput";
import AntlrResponse from "../antlr/AntlrResponse";
import {AntlrError, LexerError, ParserError, ToolError} from "../antlr/AntlrError";
import {clearSessionExtras} from "../ace/AceUtils";
import Chunk, {chunkifyInput} from "../ace/Chunk";
import {Ace, Range} from "ace-builds";
import AntlrToken from "../antlr/AntlrToken";

interface IProps { sample: GrammarSample, onRun: (input: AntlrInput) => void }
interface IState { exampleName: string, startRule: string, profile: boolean, response: AntlrResponse, chunks: Chunk[] }

// const EXAMPLE_PREFIX = "https://raw.githubusercontent.com/antlr/grammars-v4/master/";

export default class InputStartRuleAndResults extends Component<IProps, IState> {

    editorRef: any;

    constructor(props: IProps) {
        super(props);
        this.editorRef = createRef();
        this.state = { exampleName: this.props.sample.examples[0], startRule: this.props.sample.start, profile: false, response: null, chunks: null };
    }

    componentDidMount() {
        this.initializeEditor();
        this.loadEditorWithInputSample();
    }

    get aceEditor(): IAceEditor {
        return (this.editorRef.current as AceEditor).editor;
    }

    initializeEditor() {
        this.aceEditor.setOptions({
            theme: 'ace/theme/chrome',
            "highlightActiveLine": false,
            "readOnly": false,
            "showLineNumbers": true,
            "showGutter": true,
            "printMargin": false
        });
    }

    loadEditorWithInputSample() {
        if(this.props.sample.name === "Sample")
            this.aceEditor.getSession().setValue(SAMPLE_INPUT);
        else {
            let url = this.props.sample.parser.substring(0, this.props.sample.parser.lastIndexOf("/"));
            url += "/examples/" + this.state.exampleName;
            fetch(url)
                .then(async response => {
                    const text = await response.text();
                    this.aceEditor.getSession().setValue(text);
                })
                .catch(reason => console.log(reason));
        }
    }

    componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>, snapshot?: any) {
        if(this.props.sample !== prevProps.sample) {
            this.setState({ exampleName: this.props.sample.examples[0], startRule: this.props.sample.start }, () => this.loadEditorWithInputSample());
        }
    }

    render() {
        // @ts-ignore
        return <div className="h-100">
            { this.renderHeader() }
            { this.renderEditor() }
            { this.renderStartRule() }
            { this.renderToolConsole() }
            { this.renderParserConsole() }
            { this.renderTree() }
        </div>;
    }

    renderHeader() {
        const style: CSS.Properties = {height: "32px" };
        return <div style={style}>
            <FormLabel className="selector-label">&nbsp;Input&nbsp;</FormLabel>
            <Dropdown as={ButtonGroup} className="selector" onSelect={(idx) => this.inputSelected(this.props.sample.examples[parseInt(idx)])}>
                <Button variant="secondary">{this.state.exampleName}</Button>
                <DropdownToggle split variant="secondary" />
                <DropdownMenu align="end">
                    { this.props.sample.examples.map((example, idx) => <DropdownItem key={idx} eventKey={idx}>{example}</DropdownItem>) }
                </DropdownMenu>
            </Dropdown>
            <OverlayTrigger overlay={props => this.showHelp(props)} placement="bottom" >
                <Image style={{width: "20px", height: "20px"}} src={help} alt="" />
            </OverlayTrigger>
        </div>;
    }

    inputSelected(example: string) {
        this.setState({ exampleName: example }, () => this.loadEditorWithInputSample());
    }

    showHelp(props: { [props: string]: any }) {
        return <Popover className="help-popover" {...props}>
            <Popover.Body >
                Enter text that follows the syntax described in your grammar. <br/>
                You can also drag and drop a text file. <br/>
                Or you can select a sample input  from the drop-down list.<br/>
                Then hit the Run button to test.<br/>
                You can then move mouse over text to see how the tokens were matched. <br/>
                Hover over red gutter annotation to see error messages.
            </Popover.Body>
        </Popover>;
    }

    renderEditor() {
        return <div onMouseUp={() => this.aceEditor.resize()} onMouseMove={e => this.showMarker(e)} onMouseLeave={() => this.clearMarker() }>
                    <AceEditor className="input-editor" ref={this.editorRef} width="calc(100%-10px)" height="300px" mode="text" editorProps={{$blockScrolling: Infinity}} onChange={()=>this.inputChanged()}/>
                </div>;
    }

    showMarker(event: MouseEvent) {

    }

    clearMarker() {

    }

    inputChanged() {
        clearSessionExtras(this.aceEditor.getSession());
    }

    renderStartRule() {
        return <>
                 <OverlayTrigger overlay={props => this.showHelpStartRule(props)} placement="bottom" >
                     <div className="run-label-box">
                         <h6 style={{float: "left", paddingLeft: "4px", paddingTop: "6px", paddingRight: "6px"}}>Start rule</h6>
                        <Image style={{width: "20px", height: "20px"}} src={help} alt="" />
                     </div>
                </OverlayTrigger>
                <div className="run-button-box">
                    <FormControl className="start-rule-input" value={this.state.startRule} onChange={e => this.setState({startRule: e.currentTarget.value})} />
                    <button type="button" className="run-button" onClick={()=>this.runAntlr()}>Run</button>
                    <OverlayTrigger overlay={props => this.showHelpProfiler(props)} placement="bottom" >
                        <FormCheck className="profiler-switch" type="switch" label="Show profiler" onClick={()=>this.setState({profile: !this.state.profile})}/>
                    </OverlayTrigger>
                </div>
                </>;
    }

    runAntlr() {
        const input: AntlrInput = {
            lexgrammar: null,
            grammar: null,
            start: this.state.startRule,
            input: this.aceEditor.getSession().getValue()
        }
        this.props.onRun(input);
    }

    showHelpStartRule(props: { [props: string]: any }) {
        return <Popover {...props}>
            <Popover.Body >
                Enter a rule name here from your grammar to the left where parsing should begin for the input specified above.<br/>
                Hit Run to test!
            </Popover.Body>
        </Popover>;
    }

    showHelpProfiler(props: { [props: string]: any }) {
        return <Popover {...props}>
            <Popover.Body >
                Info on the parsing decisions made by the parse for this input.<br/>
                The deeper the lookahead (max k), the more expensive the decision.
            </Popover.Body>
        </Popover>;
    }

    renderToolConsole() {
        let errors: ToolError[] = [];
        if(this.state.response) {
            if(this.state.response.parser_grammar_errors)
                errors = errors.concat(this.state.response.parser_grammar_errors);
            if(this.state.response.lexer_grammar_errors)
                errors = errors.concat(this.state.response.lexer_grammar_errors);
            if(this.state.response.warnings)
                errors = errors.concat(this.state.response.warnings);
        }
        if(errors.length) {
            return <>
                <div className="chunk-header">Tool console</div>
                <div className="console">
                    { errors.map((error, idx) => <><span key={idx} className="error-message">{error.msg}</span><br/></>) }
                </div>
            </>
        } else
            return null;
    }

    renderParserConsole() {
        let errors: AntlrError[] = [];
        if(this.state.response && this.state.response.result) {
            if(this.state.response.result.lex_errors)
                errors = errors.concat(this.state.response.result.lex_errors);
            if(this.state.response.result.parse_errors)
                errors = errors.concat(this.state.response.result.parse_errors);
        }
        if(errors.length) {
            return <>
                <div className="chunk-header">Parser console</div>
                <div className="console">
                    { errors.map((error,idx) => <><span key={idx} className="error-message">{"" + error.line + ":" + error.pos + " " + error.msg}</span><br/></>) }
                </div>
            </>
        } else
            return null;
    }

    renderTree() {
        return <div/>;
    }

    processResponse(response: AntlrResponse) {
        const session = this.aceEditor.getSession();
        clearSessionExtras(session);
        let annotations: Ace.Annotation[] = [];
        if(response.result.lex_errors)
            annotations = annotations.concat(InputStartRuleAndResults.addLexerMarkersAndAnnotations(session, response.result.lex_errors));
        if(response.result.lex_errors)
            annotations = annotations.concat(InputStartRuleAndResults.addParserMarkersAndAnnotations(session, response.result.parse_errors, response.result.tokens));
        session.setAnnotations(annotations);
        const chunks = chunkifyInput(session.getValue(), response.result);
        this.setState({response: response, chunks: chunks});
    }

    static addLexerMarkersAndAnnotations(session: Ace.EditSession, errors: LexerError[]): Ace.Annotation[] {
        const annotations = errors.map(error => {
            const a = session.doc.indexToPosition(error.startidx, 0);
            const b = session.doc.indexToPosition(error.erridx + 1, 0);
            const r = new Range(a.row, a.column, b.row, b.column);
            session.addMarker(r, "lexical_error_class", "text", false);
            return { row: a.row, text: `${error.line}:${error.pos} ${error.msg}`, type: "error"};
        });
        return annotations;
    }

    static addParserMarkersAndAnnotations(session: Ace.EditSession, errors: ParserError[], tokens: AntlrToken[]): Ace.Annotation[] {
        const annotations = errors.map(error => {
            const a = session.doc.indexToPosition(tokens[error.startidx].start, 0);
            const b = session.doc.indexToPosition(tokens[error.stopidx].stop + 1, 0);
            const r = new Range(a.row, a.column, b.row, b.column);
            session.addMarker(r, "syntax_error_class", "text", false);
            return { row: a.row, text: `${error.line}:${error.pos} ${error.msg}`, type: "error"};
        });
        return annotations;
    }

}
