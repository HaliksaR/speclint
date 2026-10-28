const UNESCAPED = new Set(['"', "'", "`", "\\"]);

export const literals = (text: string, file: string) => {
  const python = file.endsWith(".py");
  const js = /\.[cm]?[jt]sx?$/.test(file);
  const go = file.endsWith(".go");
  const open = python ? /([rRbBuUfF]*)("""|'''|"|')/y : js ? /()("|'|`)/y : /(#*)("""|"|'|`)/y;
  const found: string[] = [];
  const end = (s: string, from: number) => {
    const k = text.indexOf(s, from);
    return k < 0 ? text.length : k + s.length;
  };
  let i = 0;
  let last = -1;
  while (i < text.length) {
    open.lastIndex = i;
    const m = python ? null : text.startsWith("//", i) ? "//" : text.startsWith("/*", i) ? "/*" : null;
    const q = !m && !(python && text[i] === "#") ? open.exec(text) : null;
    if (m === "//" || (python && text[i] === "#")) i = end("\n", i);
    else if (m === "/*") i = end("*/", i + 2);
    else if (js && text[i] === "/" && (last < 0 || "(,=:[!&|?{};".includes(text[last]) || /\breturn$/.test(text.slice(Math.max(0, last - 6), last + 1)))) {
      let j = i + 1;
      for (let set = false; j < text.length && text[j] !== "\n" && (set || text[j] !== "/"); j++) {
        if (text[j] === "\\") j++;
        else if (text[j] === "[" || text[j] === "]") set = text[j] === "[";
      }
      i = j + 1;
      last = j;
    } else if (!q) {
      if (text[i] > " ") last = i;
      i++;
    } else if (q[2] === "`" && !js && !go) i = Math.min(end("`", i + 1), end("\n", i));
    else {
      const raw = python ? /r/i.test(q[1]) : q[1].length > 0 || (go && q[2] === "`");
      const close = q[2] + (python ? "" : q[1]);
      const single = q[2].length === 1 && q[2] !== "`";
      let s = "";
      let j = i + q[0].length;
      while (j < text.length && !text.startsWith(close, j) && !(single && text[j] === "\n")) {
        if (text[j] === "\\" && (!raw || python)) {
          const next = text[j + 1] ?? "";
          s += !raw && UNESCAPED.has(next) ? next : `\\${next}`;
          j += 2;
        } else s += text[j++];
      }
      if (text.startsWith(close, j)) {
        found.push(s);
        j += close.length;
      }
      i = j;
      last = j - 1;
    }
  }
  return found;
};
