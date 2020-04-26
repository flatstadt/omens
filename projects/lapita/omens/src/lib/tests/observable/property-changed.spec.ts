import { of } from 'rxjs';
import { take } from 'rxjs/operators';

import { PropertyChanged } from '../../observable/property-changed';

import createSpy = jasmine.createSpy;
interface PropertyMock {
    name: string;
    address: {
        street: string;
        number: number;
    };
}

class PropertyServiceMock extends PropertyChanged<PropertyMock> {
    constructor() {
        super({name: 'Matt', address: {street: 'Boulevar', number: 1}}, {bufferTime: 0});
    }
}

describe('Omens: PropertyChanged', () => {
    let service: PropertyServiceMock;

    beforeEach(() => {
        service = new PropertyServiceMock();
    });

    it('should have one history entry', () => {
        expect(service.historyLength).toBe(1);
    });

    it('should set property value', () => {
        service.setPropertyValue('name', 'John');
        expect(service.getPropertyValue('name')).toBe('John');
    });

    it('should undo one', () => {
        service.setPropertyValue('name', 'John');
        service.setPropertyValue('name', 'Will');
        service.undo();
        expect(service.getPropertyValue('name')).toBe('John');
    });

    it('should undo all', () => {
        service.setPropertyValue('name', 'John');
        service.setPropertyValue('name', 'Will');
        service.undoAll();
        expect(service.getPropertyValue('name')).toBe('Matt');
    });

    it('should redo', () => {
        service.setPropertyValue('name', 'John');
        service.setPropertyValue('name', 'Will');
        service.undoAll();
        service.redo();
        expect(service.getPropertyValue('name')).toBe('John');
    });

    it('should redo all', () => {
        service.setPropertyValue('name', 'John');
        service.setPropertyValue('name', 'Will');
        service.undoAll();
        service.redoAll();
        expect(service.getPropertyValue('name')).toBe('Will');
    });

    it('should return n properties', () => {
        const properties = service.properties;
        expect(properties.length).toBe(3);
    });

    it('should set properties value', () => {
        const value = {name: 'Tim', address: {street: 'Main Road', number: 2}};
        service.setPropertiesValue(value);
        expect(service.value).toEqual(value);
    });

    it('should receive event', () => {
        const spyFcn = createSpy('subscription', () => {});
        // BufferTime creates problems when testing it. This is a workaround
        of(service.listen(Symbol())).pipe(take(1)).subscribe(spyFcn);
        service.setPropertyValue('name', 'Tim', {source: Symbol()});
        expect(spyFcn).toHaveBeenCalled();
    });

    it('should receive a single event', () => {
        const spyFcn = createSpy('subscription', () => {});
        of(service.listen(Symbol())).pipe(take(1)).subscribe(spyFcn);
        service.beginUpdate();
        service.setPropertyValue('name', 'Tim', {source: Symbol()});
        service.setPropertyValue(['address', 'number'], 2, {source: Symbol()});
        service.endUpdate();
        expect(spyFcn).toHaveBeenCalledTimes(1);
    });
});
