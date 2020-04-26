export function coerce(value: any | any[]): any[] {
    return Array.isArray(value) ? value : [value];
}

export function flatten(array: any[][]): any[] {
    return array.reduce((result, item) => result.concat(item), []);
}
