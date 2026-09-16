---
name: copyable-snippets
description: Formats code, commands, configuration, or other snippets as independently copyable Markdown fenced blocks, with a language tag and optional file path context. Use when the user explicitly asks for a copyable snippet, a clipboard-ready block, or multiple blocks they can copy separately; do not use merely because a normal answer contains code.
---

# Copyable Snippets

When the user asks for clipboard-ready or independently copyable content:

- Put each independently usable snippet in its own fenced Markdown block.
- Add the most specific accurate language identifier after the opening fence, such as `ts`, `json`, `bash`, `html`, or `text`.
- If a file path is useful or requested, place it as a short plain-text label immediately before its block. Do not put the path inside the snippet unless it is part of the file content.
- Keep explanations, labels, and usage notes outside the fence so copying the block yields only the intended content.
- Make each block self-contained for its stated purpose. Do not use line numbers, editorial markers, or omitted sections inside it unless the user requests them.
- Preserve the requested format. Use a diff only when the user asks for a patch or diff; otherwise provide the resulting content.
- If the user requests several files or alternatives, use one labeled fence per file or alternative.

Do not apply this presentation contract to ordinary responses just because they contain code. Preserve normal concise prose and inline code unless the user asks for copyable blocks.
