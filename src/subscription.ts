
export class NoArgumentSubscribers {
    subscribers = new Array<() => void>()
    signal() {
        this.subscribers.forEach(s => s())
    }
    subscribe(subscriber: () => void) {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void) {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class OneArgumentSubscribers<T> {
    subscribers = new Array<(t: T) => void>()
    signal(t: T) {
        this.subscribers.forEach(s => s(t))
    }
    subscribe(subscriber: (t: T) => void) {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void) {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class TwoArgumentsSubscribers<T, U> {
    subscribers = new Array<(t: T, u: U) => void>()
    signal(t: T, u: U) {
        this.subscribers.forEach(s => s(t, u))
    }
    subscribe(subscriber: (t: T, u: U) => void) {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void) {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class ThreeArgumentsSubscribers<T, U, V> {
    subscribers = new Array<(t: T, u: U, v: V) => void>()
    signal(t: T, u: U, v: V) {
        this.subscribers.forEach(s => s(t, u, v))
    }
    subscribe(subscriber: (t: T, u: U, v: V) => void) {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void) {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}