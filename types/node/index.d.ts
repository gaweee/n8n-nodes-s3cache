declare interface Buffer extends Uint8Array {
	toString(encoding?: string): string;
	length: number;
}

type BufferEncoding = 'utf8' | 'hex' | 'base64';
type BinaryLike = string | Buffer | ArrayBuffer | ArrayBufferView;

declare const Buffer: {
	from(data: string, encoding?: BufferEncoding): Buffer;
	from(data: ArrayBuffer | ArrayBufferView): Buffer;
	concat(chunks: Buffer[]): Buffer;
	byteLength(data: BinaryLike): number;
	alloc(size: number): Buffer;
};

declare module 'crypto' {
	interface Hash {
		update(data: BinaryLike): Hash;
		digest(): Buffer;
		digest(encoding: 'hex'): string;
	}

	interface Hmac {
		update(data: BinaryLike): Hmac;
		digest(): Buffer;
		digest(encoding: 'hex'): string;
	}

	function createHash(algorithm: string): Hash;

	function createHmac(algorithm: string, key: BinaryLike): Hmac;
}

declare module 'node:crypto' {
	export * from 'crypto';
}

declare class URLSearchParams {
	constructor(init?: string | Record<string, string> | string[][]);
	toString(): string;
}

declare class URL {
	constructor(input: string, base?: string);
	readonly href: string;
	readonly host: string;
	readonly hostname: string;
	readonly pathname: string;
	readonly searchParams: URLSearchParams;
}
