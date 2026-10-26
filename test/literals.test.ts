import { describe, expect, it } from "vitest";
import { literals } from "../src/literals.js";

describe("string literal lexer", () => {
  it("unescapes quotes and backslash and keeps other escapes as written", () => {
    expect(literals(String.raw`f("say \"hi\"", 'it\'s', "a\\b", "x\ny")`, "A.kt")).toEqual(['say "hi"', "it's", "a\\b", "x\\ny"]);
  });

  it("ignores quotes inside comments", () => {
    expect(literals(`// "no"\n/* "no" 'no' */ x("yes")`, "A.java")).toEqual(["yes"]);
    expect(literals(`# "no"\nx = "yes" // 2`, "test_a.py")).toEqual(["yes"]);
    expect(literals(`f("a // b", "c # d")`, "a.test.ts")).toEqual(["a // b", "c # d"]);
  });

  it("reads multiline strings", () => {
    expect(literals(`x("""\n  WHEN "a"\n""")`, "A.kt")).toEqual(['\n  WHEN "a"\n']);
    expect(literals(`x('''a\n"b"''', """c""")`, "test_a.py")).toEqual(['a\n"b"', "c"]);
    expect(literals("x(`a\n${b}`)", "a.test.ts")).toEqual(["a\n${b}"]);
  });

  it("keeps interpolation and prefixed strings as written", () => {
    expect(literals(String.raw`f"WHEN {x}", r"a\"b\\", rb'c'`, "test_a.py")).toEqual(["WHEN {x}", String.raw`a\"b\\`, "c"]);
    expect(literals(String.raw`x(#"a "b" \(c)"#, ##"d"#e"##, "\(f)")`, "ATests.swift")).toEqual([String.raw`a "b" \(c)`, 'd"#e', String.raw`\(f)`]);
  });

  it("drops a single-line string left open at the end of the line and goes on", () => {
    expect(literals(`x("open\ny("closed")`, "A.kt")).toEqual(["closed"]);
    expect(literals(`x("""never closed`, "A.kt")).toEqual([]);
  });

  it("skips JS regular expressions with quotes and keeps division", () => {
    expect(literals("const r = /['\"`]x\\/[/]/g; f(\"a\")", "a.test.ts")).toEqual(["a"]);
    expect(literals("return /'/.test(s) ? 'b' : 'c'", "a.test.js")).toEqual(["b", "c"]);
    expect(literals("x = a / 2 + b / 'c'.length", "a.test.ts")).toEqual(["c"]);
  });

  it("does not take Kotlin and Swift backtick names as strings", () => {
    expect(literals("fun `WHEN \"x\"`() {}", "A.kt")).toEqual([]);
  });
});
