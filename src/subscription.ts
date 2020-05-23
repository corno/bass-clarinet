/* eslint
    max-classes-per-file: "off",
*/

export class Subscribers<T> {
    subscribers = new Array<T>()
    signal(callback: (t: T) => void): void {
        this.subscribers.forEach(s => callback(s))
    }
    subscribe(subscriber: T): void {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: T): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class NoArgumentSubscribers {
    subscribers = new Array<() => void>()
    signal(): void {
        this.subscribers.forEach(s => s())
    }
    subscribe(subscriber: () => void): void {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class OneArgumentSubscribers<T> {
    subscribers = new Array<(t: T) => void>()
    signal(t: T): void {
        this.subscribers.forEach(s => s(t))
    }
    subscribe(subscriber: (t: T) => void): void {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class TwoArgumentsSubscribers<T, U> {
    subscribers = new Array<(t: T, u: U) => void>()
    signal(t: T, u: U): void {
        this.subscribers.forEach(s => s(t, u))
    }
    subscribe(subscriber: (t: T, u: U) => void): void {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}

export class ThreeArgumentsSubscribers<T, U, V> {
    subscribers = new Array<(t: T, u: U, v: V) => void>()
    signal(t: T, u: U, v: V): void {
        this.subscribers.forEach(s => s(t, u, v))
    }
    subscribe(subscriber: (t: T, u: U, v: V) => void): void {
        this.subscribers.push(subscriber)
    }
    unsubscribe(subscriber: () => void): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index !== -1) {
            this.subscribers.splice(index, 1)
        }
    }
}