export class FlattenObject {

    constructor(private obj: object) {
        const collection: FlattenProperty[] = [];
        this.flattenProperties([], { ...this.obj }, collection);
        this.collection = collection;
    }
    private readonly collection: FlattenProperty[];

    private static flattenObject(collection: FlattenProperty[], usePathAsName: boolean): any {
        const obj = {};
        for (const item of collection) {
            if (obj.hasOwnProperty(item.name) || usePathAsName) {
                obj[item.path.join('_')] = item.value;
                continue;
            }
            obj[item.name] = item.value;
        }
        return obj;
    }

    flatten(usePathAsName: boolean = true): { [prop: string]: any } {
        return FlattenObject.flattenObject(this.collection, usePathAsName);
    }

    getProperties(): FlattenProperty[] {
        return this.collection;
    }

    private flattenProperties(path: string[], parent: any, collection: FlattenProperty[]) {
        const properties = Object.keys(parent);
        if (!properties || properties.length === 0) {
            return;
        }
        for (const property of properties) {
            const propertyValue = parent[property];
            if (propertyValue instanceof Array) {
                collection.push(new FlattenProperty([...path, property], property, propertyValue));
                continue;
            }
            if (propertyValue instanceof PropertyValue) {
                collection.push(new FlattenProperty([...path, property], property, propertyValue.value));
                continue;
            }
            if (propertyValue instanceof Object) {
                this.flattenProperties([...path, property], propertyValue, collection);
                continue;
            }
            collection.push(new FlattenProperty([...path, property], property, propertyValue));
        }
    }
}

export class FlattenProperty {
    readonly name: string;
    readonly path: string[];
    readonly value: any;

    constructor(path: string[], name: string, value: any) {
        this.path = path;
        this.name = name;
        this.value = value;
    }
}

export class PropertyValue<T extends any> {
    readonly value: T;
    constructor(value: T) {
        this.value = value;
    }
}
