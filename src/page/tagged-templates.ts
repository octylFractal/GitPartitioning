import {MarkdownOptions, renderMarkdown} from "./util";

function render(strings: TemplateStringsArray, ...values: unknown[]): string {
    let result = "";
    for (let i = 0; i < strings.length; i++) {
        result += strings[i] + (values[i] || "");
    }
    return result;
}

type TemplateTag<R> = (strings: TemplateStringsArray, ...values: unknown[]) => R;

export function markdown(strings: TemplateStringsArray, ...values: unknown[]): string;
export function markdown(options: MarkdownOptions): TemplateTag<string>;

export function markdown(stringsOrOptions: TemplateStringsArray | MarkdownOptions,
                         ...values: unknown[]): string | TemplateTag<string> {
    if (isTemplateStringsArray(stringsOrOptions)) {
        return markdownHelper(stringsOrOptions, values);
    }
    return (strings, ...values): string => markdownHelper(strings, values, stringsOrOptions);
}

function markdownHelper(strings: TemplateStringsArray, values: unknown[], options?: MarkdownOptions): string {
    return renderMarkdown(render(strings, values).trim(), options);
}

function isTemplateStringsArray(v: unknown): v is TemplateStringsArray {
    return {}.hasOwnProperty.call(v, 'raw') && {}.hasOwnProperty.call(v, 'length');
}

/**
 * Tagged template that supports resolving promises in the values array, resulting in a promise.
 *
 * @param strings the array of strings
 * @param values the array of values, may include promises to be resolved
 */
export async function async(strings: TemplateStringsArray, ...values: unknown[]): Promise<string> {
    let result = "";
    for (let i = 0; i < strings.length; i++) {
        result += strings[i] + ((await values[i]) || "");
    }
    return result;
}
