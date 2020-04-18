export function coerce(value: any | any[]): any[] {
    return  Array.isArray(value) ? value : [value];
}
