export function error(message: string): never {
    throw new Error(message);
}

export function setAll<K, V>(map: Map<K, V>, other: Iterable<[K, V]>): Map<K, V> {
    for (const [k, v] of other) {
        map.set(k, v);
    }
    return map;
}
