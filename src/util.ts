export const asyncFilter: <T> (arr: T[], predicate: (arg0: T) => Promise<Boolean>) => Promise<T[]> = async (arr, predicate) => Promise.all(arr.map(predicate))
	.then((results) => arr.filter((_v, index) => results[index]));

export const asyncMap: <T, R> (arr: T[], predicate: (arg0: T) => Promise<R>) => Promise<R[]> = async (arr, predicate) => await Promise.all(arr.map(predicate))

export function hasDuplicates(array: any[]): boolean {
    return (new Set(array)).size !== array.length;
}