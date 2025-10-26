import { createHash, createHmac } from 'node:crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

type PutObjectParams = {
	ctx: IExecuteFunctions;
	body: Buffer;
	bucket: string;
	key: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	ttlSeconds: number;
	contentType: string;
	forcePathStyle: boolean;
	metadata?: Record<string, string>;
};

type SignRequestParams = {
	method: string;
	url: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	headers?: Record<string, string>;
	body?: Buffer;
};

const canonicalKey = (key: string) =>
	key
		.split('/')
		.map((segment) =>
			encodeURIComponent(segment)
				.replace(/!/g, '%21')
				.replace(/\*/g, '%2A')
				.replace(/\(/g, '%28')
				.replace(/\)/g, '%29')
				.replace(/'/g, '%27'),
		)
		.join('/');

const buildS3Url = (region: string, bucket: string, key: string, forcePathStyle: boolean) => {
	const encodedKey = canonicalKey(key);
	if (forcePathStyle || bucket.includes('.')) {
		return `https://s3.${region}.amazonaws.com/${bucket}/${encodedKey}`;
	}
	return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
};

const formatHeaderName = (name: string) =>
	name
		.split('-')
		.map((segment) => (segment.length > 0 ? segment[0].toUpperCase() + segment.slice(1) : segment))
		.join('-');

const getSigningKey = (secret: string, dateStamp: string, region: string) => {
	const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
	const kRegion = createHmac('sha256', kDate).update(region).digest();
	const kService = createHmac('sha256', kRegion).update('s3').digest();
	return createHmac('sha256', kService).update('aws4_request').digest();
};

const signS3Request = ({
	method,
	url,
	region,
	accessKeyId,
	secretAccessKey,
	headers = {},
	body,
}: SignRequestParams) => {
	const urlObj = new URL(url);
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
	const dateStamp = amzDate.slice(0, 8);
	const payload = body ?? Buffer.alloc(0);
	const payloadHash = createHash('sha256').update(payload).digest('hex');

	const canonicalHeadersMap: Record<string, string> = {
		host: urlObj.host,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzDate,
	};

	for (const [key, value] of Object.entries(headers)) {
		if (value !== undefined) {
			canonicalHeadersMap[key.toLowerCase()] = value;
		}
	}

	const headerNames = Object.keys(canonicalHeadersMap)
		.map((name) => name.toLowerCase())
		.sort();

	const canonicalHeaders = headerNames.map((name) => `${name}:${canonicalHeadersMap[name].trim()}\n`).join('');
	const signedHeaders = headerNames.join(';');

	const canonicalRequest = [
		method.toUpperCase(),
		urlObj.pathname || '/',
		urlObj.searchParams.toString(),
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join('\n');

	const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		createHash('sha256').update(canonicalRequest).digest('hex'),
	].join('\n');

	const signingKey = getSigningKey(secretAccessKey, dateStamp, region);
	const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

	const finalHeaders: Record<string, string> = {};
	for (const name of headerNames) {
		finalHeaders[formatHeaderName(name)] = canonicalHeadersMap[name];
	}
	finalHeaders.Authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	return finalHeaders;
};

const putObject = async ({
	ctx,
	body,
	bucket,
	key,
	region,
	accessKeyId,
	secretAccessKey,
	ttlSeconds,
	contentType,
	forcePathStyle,
	metadata = {},
}: PutObjectParams) => {
	const url = buildS3Url(region, bucket, key, forcePathStyle);
	const baseHeaders = {
		'cache-control': `max-age=${ttlSeconds}`,
		'content-length': `${body.length}`,
		'content-type': contentType,
		...metadata,
	};
	const signedHeaders = signS3Request({
		method: 'PUT',
		url,
		region,
		accessKeyId,
		secretAccessKey,
		headers: baseHeaders,
		body,
	});

	try {
		await ctx.helpers.httpRequest({
			method: 'PUT',
			url,
			headers: signedHeaders,
			body,
			encoding: 'arraybuffer',
		});
	} catch (error) {
		throw (error instanceof Error ? error : new Error('Failed to store object in S3'));
	}
};

type HeadObjectParams = Omit<PutObjectParams, 'body' | 'ttlSeconds' | 'contentType' | 'metadata'>;
type HeadObjectResult = {
	lastModified: Date;
	metadata: Record<string, string>;
	contentType?: string;
};

const normalizeHeaders = (headers: IDataObject | undefined) => {
	const normalized: Record<string, string> = {};
	if (!headers) {
		return normalized;
	}
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			normalized[key.toLowerCase()] = String(value[0]);
		} else {
			normalized[key.toLowerCase()] = String(value);
		}
	}
	return normalized;
};

const headObject = async ({
	ctx,
	bucket,
	key,
	region,
	accessKeyId,
	secretAccessKey,
	forcePathStyle,
}: HeadObjectParams): Promise<HeadObjectResult | null> => {
	const url = buildS3Url(region, bucket, key, forcePathStyle);
	const signedHeaders = signS3Request({
		method: 'HEAD',
		url,
		region,
		accessKeyId,
		secretAccessKey,
	});

	try {
		const response = (await ctx.helpers.httpRequest({
			method: 'HEAD',
			url,
			headers: signedHeaders,
			returnFullResponse: true,
			encoding: 'arraybuffer',
		})) as IDataObject;
		const headers = normalizeHeaders((response.headers as IDataObject) ?? {});
		const metadata: Record<string, string> = {};
		for (const [headerName, headerValue] of Object.entries(headers)) {
			if (headerName.startsWith('x-amz-meta-')) {
				metadata[headerName] = headerValue;
			}
		}
		const lastModifiedHeader = headers['last-modified'];
		return {
			lastModified: lastModifiedHeader ? new Date(lastModifiedHeader) : new Date(),
			metadata,
			contentType: headers['content-type'],
		};
	} catch {
		return null;
	}
};

type GetObjectParams = HeadObjectParams;

const bufferFromResponse = (data: unknown): Buffer | null => {
	if (!data) {
		return null;
	}
	if (Buffer.isBuffer(data)) {
		return data;
	}
	if (typeof ArrayBuffer !== 'undefined') {
		if (data instanceof ArrayBuffer) {
			return Buffer.from(new Uint8Array(data));
		}
		if (ArrayBuffer.isView(data as ArrayBufferView)) {
			return Buffer.from(data as ArrayBufferView);
		}
	}
	if (typeof data === 'string') {
		return Buffer.from(data, 'utf8');
	}

	if (typeof data === 'object' && 'body' in (data as IDataObject) && (data as IDataObject).body) {
		return bufferFromResponse((data as IDataObject).body);
	}

	return null;
};

const getObject = async ({
	ctx,
	bucket,
	key,
	region,
	accessKeyId,
	secretAccessKey,
	forcePathStyle,
}: GetObjectParams): Promise<Buffer | null> => {
	const url = buildS3Url(region, bucket, key, forcePathStyle);
	const signedHeaders = signS3Request({
		method: 'GET',
		url,
		region,
		accessKeyId,
		secretAccessKey,
	});

	try {
		const response = await ctx.helpers.httpRequest({
			method: 'GET',
			url,
			headers: signedHeaders,
			encoding: 'arraybuffer',
		});
		return bufferFromResponse(response);
	} catch {
		return null;
	}
};

export class S3cache implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'S3 Cache',
		name: 's3cache',
		icon: 'file:s3cache.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Read and write cached objects backed by Amazon S3',
		defaults: {
			name: 'S3cache',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs:
			'={{$parameter["operation"] === "cacheStore" ? [{"type":"main"}] : [{"type":"main","displayName":"Hit"},{"type":"main","displayName":"Miss"}]}}',
		credentials: [{ name: 's3', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Cache Check',
						value: 'cacheCheck',
						action: 'Verify whether a cache entry exists',
						description: 'Verify whether a cache entry exists',
					},
					{
						name: 'Cache Store',
						value: 'cacheStore',
						action: 'Store or update a cache entry',
						description: 'Store or update a cache entry',
					},
				],
				default: 'cacheCheck',
			},
			{
				displayName: 'Cache ID',
				name: 'cacheId',
				type: 'string',
				required: true,
				default: '',
				description: 'Unique identifier used as the cache key',
			},
			{
				displayName: 'TTL (Seconds)',
				name: 'ttl',
				type: 'number',
				required: true,
				default: 300,
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						operation: ['cacheStore'],
					},
				},
				description: 'How long the cached data should remain valid when storing a value',
			},
			{
				displayName: 'Payload Source',
				name: 'dataSource',
				type: 'options',
				options: [
					{
						name: 'JSON',
						value: 'json',
					},
					{
						name: 'Binary',
						value: 'binary',
					},
				],
				default: 'json',
				displayOptions: {
					show: {
						operation: ['cacheStore'],
					},
				},
				description: 'Choose whether to store JSON data or binary file content',
			},
			{
				displayName: 'JSON Data',
				name: 'jsonData',
				type: 'json',
				default: '={{$json}}',
				displayOptions: {
					show: {
						operation: ['cacheStore'],
						dataSource: ['json'],
					},
				},
				description: 'JSON payload to cache. Defaults to the entire incoming JSON item.',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						operation: ['cacheStore'],
						dataSource: ['binary'],
					},
				},
				description: 'Name of the binary property on the incoming item to store',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const configuredOperation = this.getNode().parameters.operation;
		const defaultOperation =
			typeof configuredOperation === 'string' && configuredOperation === 'cacheStore'
				? 'cacheStore'
				: 'cacheCheck';
		const returnData: INodeExecutionData[][] =
			defaultOperation === 'cacheStore' ? [[]] : [[], []];
		const getOutputBucket = (index: number) => {
			if (!returnData[index]) {
				returnData[index] = [];
			}
			return returnData[index];
		};

		if (items.length === 0) {
			return returnData;
		}

		const credentials = (await this.getCredentials('s3')) as IDataObject | null;

		if (!credentials) {
			throw new NodeOperationError(this.getNode(), 'S3 credentials are missing.');
		}

		const { accessKeyId, secretAccessKey, region, bucketName, folderName, forcePathStyle } = credentials;

		if (
			typeof accessKeyId !== 'string' ||
			typeof secretAccessKey !== 'string' ||
			typeof region !== 'string' ||
			typeof bucketName !== 'string'
		) {
			throw new NodeOperationError(
				this.getNode(),
				'S3 credentials must include Access Key, Secret Key, Region, and Bucket Name.',
			);
		}

		const usePathStyle = Boolean(forcePathStyle);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const operation = this.getNodeParameter('operation', itemIndex) as 'cacheCheck' | 'cacheStore';
			const cacheId = this.getNodeParameter('cacheId', itemIndex) as string;

			if (!cacheId) {
				throw new NodeOperationError(this.getNode(), 'Cache ID is required to store data.', {
					itemIndex,
				});
			}

			const sanitizedFolder =
				typeof folderName === 'string' && folderName.trim().length > 0
					? folderName.replace(/^\/+|\/+$/g, '')
					: '';
			const objectKey = sanitizedFolder ? `${sanitizedFolder}/${cacheId}` : cacheId;

			if (operation === 'cacheStore') {
				const ttl = this.getNodeParameter('ttl', itemIndex) as number;
				const dataSource = this.getNodeParameter('dataSource', itemIndex, 'json') as 'json' | 'binary';
				let body: Buffer;
				let contentType = 'application/json';
				let binaryPropertyName = 'data';

				if (dataSource === 'json') {
					const jsonPayload = this.getNodeParameter('jsonData', itemIndex, {}) as
						| IDataObject
						| IDataObject[]
						| string;
					const serialized =
						typeof jsonPayload === 'string' ? jsonPayload : JSON.stringify(jsonPayload ?? {});

					if (serialized === undefined) {
						throw new NodeOperationError(this.getNode(), 'JSON payload resolved to undefined.', {
							itemIndex,
						});
					}

					body = Buffer.from(serialized, 'utf8');
				} else {
					binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
					const binaryProperty = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
					body = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
					contentType = binaryProperty.mimeType ?? 'application/octet-stream';
				}

				const metadataHeaders: Record<string, string> = {
					'x-amz-meta-cache-ttl-seconds': `${ttl}`,
					'x-amz-meta-cache-data-type': dataSource,
					'x-amz-meta-cache-content-type': contentType,
				};

				if (dataSource === 'binary') {
					metadataHeaders['x-amz-meta-cache-binary-property'] = binaryPropertyName;
				}

				try {
					await putObject({
						ctx: this,
						body,
						bucket: bucketName,
						key: objectKey,
						region,
						accessKeyId,
						secretAccessKey,
						ttlSeconds: ttl,
						contentType,
						forcePathStyle: usePathStyle,
						metadata: metadataHeaders,
					});
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						error instanceof Error ? error.message : 'Failed to store object in S3',
						{ itemIndex },
					);
				}

				getOutputBucket(0).push(item);
				continue;
			}

			const headInfo = await headObject({
				ctx: this,
				bucket: bucketName,
				key: objectKey,
				region,
				accessKeyId,
				secretAccessKey,
				forcePathStyle: usePathStyle,
			});

			if (!headInfo) {
				getOutputBucket(1).push(item);
				continue;
			}

			const ttlHeader = headInfo.metadata['x-amz-meta-cache-ttl-seconds'];
			const ttlSeconds = ttlHeader ? Number.parseInt(ttlHeader, 10) : Number.NaN;
			const ageSeconds = (Date.now() - headInfo.lastModified.getTime()) / 1000;

			if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ageSeconds > ttlSeconds) {
				getOutputBucket(1).push(item);
				continue;
			}

			const cachedBuffer = await getObject({
				ctx: this,
				bucket: bucketName,
				key: objectKey,
				region,
				accessKeyId,
				secretAccessKey,
				forcePathStyle: usePathStyle,
			});

			if (!cachedBuffer) {
				getOutputBucket(1).push(item);
				continue;
			}

			const dataType = headInfo.metadata['x-amz-meta-cache-data-type'] ?? 'json';

			if (dataType === 'binary') {
				const binaryPropertyName =
					headInfo.metadata['x-amz-meta-cache-binary-property'] ?? 'data';
				const mimeType =
					headInfo.metadata['x-amz-meta-cache-content-type'] ??
					headInfo.contentType ??
					'application/octet-stream';

				const binaryData = cachedBuffer.toString('base64');

				getOutputBucket(0).push({
					json: {},
					binary: {
						[binaryPropertyName]: {
							data: binaryData,
							mimeType,
						},
					},
					pairedItem: { item: itemIndex },
				});
				continue;
			}

			const jsonString = cachedBuffer.toString('utf8');
			let parsedJson: unknown;

			try {
				parsedJson = JSON.parse(jsonString);
			} catch {
				parsedJson = jsonString;
			}

			const jsonPayload =
				parsedJson && typeof parsedJson === 'object'
					? (parsedJson as IDataObject)
					: ({ data: parsedJson } as IDataObject);

			getOutputBucket(0).push({
				json: jsonPayload,
				pairedItem: { item: itemIndex },
			});
		}

		return returnData;
	}
}
