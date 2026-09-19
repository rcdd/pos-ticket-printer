import {EventEmitter} from 'events';

// Internal domain event bus. The SSE endpoint (/events) subscribes to it
// to push updates to the terminals and the register.
const bus = new EventEmitter();
bus.setMaxListeners(100); // several terminals connected at once

export const EventTypes = Object.freeze({
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    TABLE_UPDATED: 'table.updated',
    SESSION_UPDATED: 'session.updated',
    CATALOG_UPDATED: 'catalog.updated',
});

export function emitEvent(type, payload = {}) {
    bus.emit('event', {type, payload, at: Date.now()});
}

export function subscribe(listener) {
    bus.on('event', listener);
    return () => bus.off('event', listener);
}
