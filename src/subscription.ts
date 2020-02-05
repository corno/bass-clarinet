
export class NoArgumentSubscribers {
    subscribers = new Array<() => void>()
    signal() {
        this.subscribers.forEach(s => s())
    }
    subscribe(subscriber: () => void) {
        this.subscribers.push(subscriber)
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
}

export class TwoArgumentsSubscribers<T, U> {
    subscribers = new Array<(t: T, u: U) => void>()
    signal(t: T, u: U) {
        this.subscribers.forEach(s => s(t, u))
    }
    subscribe(subscriber: (t: T, u: U) => void) {
        this.subscribers.push(subscriber)
    }
}