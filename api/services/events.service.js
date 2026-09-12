import {EventEmitter} from 'events';

// Bus interno de eventos de domínio. O SSE (/events) subscreve isto
// para empurrar atualizações aos terminais e à caixa.
const bus = new EventEmitter();
bus.setMaxListeners(100); // vários terminais ligados em simultâneo

export const EventTypes = Object.freeze({
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    TABLE_UPDATED: 'table.updated',
    SESSION_UPDATED: 'session.updated',
});

export function emitEvent(type, payload = {}) {
    bus.emit('event', {type, payload, at: Date.now()});
}

export function subscribe(listener) {
    bus.on('event', listener);
    return () => bus.off('event', listener);
}
