import { BasicEvaluator } from "conductor/dist/conductor/runner";
import { IRunnerPlugin } from "conductor/dist/conductor/runner/types";
import { RustLexer } from "./parser/src/RustLexer";
import { RustParser } from "./parser/src/RustParser";
import { CharStream, CommonTokenStream, ParseTree } from "antlr4ng";
import { Bytecode, DONE, RustVirtualMachine } from "./RustVirtualMachine";
import { RustCompilerVisitor } from "./RustCompiler";

export class RustEvaluator extends BasicEvaluator {
    private compilerVisitor: RustCompilerVisitor;

    constructor(conductor: IRunnerPlugin) {
        super(conductor);
        this.compilerVisitor = new RustCompilerVisitor();
    }

    compile(tree: ParseTree): Bytecode[] {
        const bytecode = this.compilerVisitor.visit(tree);
        bytecode.push(DONE());
        return bytecode;
    }

    async evaluateChunk(chunk: string): Promise<void> {
        try {
            // Create the lexer and parser
            const inputStream = CharStream.fromString(chunk);
            const lexer = new RustLexer(inputStream);
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new RustParser(tokenStream);
            
            // Compile the expression
            const tree = parser.statement();
            // console.log('tree', tree.toStringTree(parser));
            console.log(prettyPrint(tree.toStringTree(parser)));
            return;
            const bytecode = this.compile(tree);

            // Run the bytecode
            const vm = new RustVirtualMachine(bytecode);
            console.log('bytecode', bytecode);
            const result = vm.run();

            // Send the result to the REPL
            this.conductor.sendOutput(`Result of expression: ${result}`);
        }  catch (error) {
            // Handle errors and send them to the REPL
            // Print stack trace for debugging
            console.error(error);
            if (error instanceof Error) {
                this.conductor.sendOutput(`Error: ${error.message}`);
            } else {
                this.conductor.sendOutput(`Error: ${String(error)}`);
            }
        }
    }
}

function prettyPrint(input: string): string {
    // Tokenize the input into an array of tokens (parentheses or non‐whitespace strings)
    const tokens = input.match(/[\(\)]|[^()\s]+/g) || [];

    // Recursively parse tokens into a nested array structure.
    function parse(tokens: string[]): any {
        const res: any[] = [];
        while (tokens.length > 0) {
            const token = tokens.shift();
            if (token === "(") {
                res.push(parse(tokens));
            } else if (token === ")") {
                return res;
            } else {
                res.push(token);
            }
        }
        return res;
    }
    
    const parsed = parse(tokens);

    // Recursively format the parsed structure into a pretty-printed string.
    function format(tree: any, indent: number): string {
        if (typeof tree === "string") return tree;
        let result = "";
        for (let i = 0; i < tree.length; i++) {
            const item = tree[i];
            if (Array.isArray(item)) {
                // Format nested arrays on their own indented lines.
                result += "\n" + " ".repeat(indent) + "(" + format(item, indent + 2) + "\n" + " ".repeat(indent) + ")";
            } else {
                // For non-array tokens, add a space between tokens unless it's the first token.
                result += (i === 0 ? "" : " ") + item;
            }
        }
        return result;
    }
    
    return format(parsed, 0);
}